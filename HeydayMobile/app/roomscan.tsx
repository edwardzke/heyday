import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { NativeModules } from "react-native";
import { supabase } from "../lib/supabase";
import { createScanSession, uploadRoomPlanJSON, generateRecommendations, cleanupSession } from "../lib/backend-api";

const { ARRoomScanner } = NativeModules;

export default function RoomScanPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("Opening room scanner...");

  useEffect(() => {
    (async () => {
      try {
        // Step 1: Get scan data from AR scanner
        const payloadString: string = await ARRoomScanner.scanRoom();

        let payload: any;
        try {
          payload = JSON.parse(payloadString);
        } catch (err) {
          console.error("❌ Failed to parse payload:", err);
          Alert.alert("Scan error", "Invalid data returned from scanner.");
          router.back();
          return;
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        const roomJson: string | undefined = payload.roomJson;
        if (!roomJson) {
          throw new Error("No RoomPlan JSON data received from scanner");
        }

        console.log("🟢 RoomPlan JSON received, length:", roomJson.length);

        // Step 2: Get current user from Supabase
        setStatusMessage("Getting user information...");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("No authenticated user found. Please log in.");
        }

        console.log("🟢 User ID:", user.id);

        // Step 3: Create Django scan session
        setStatusMessage("Creating scan session...");
        const session = await createScanSession(`Room scan ${new Date().toLocaleString()}`);
        console.log("🟢 Created scan session:", session.id);

        // Step 4: Upload RoomPlan JSON to Django
        setStatusMessage("Uploading room data...");
        const uploadResult = await uploadRoomPlanJSON(session.id, roomJson);
        console.log("🟢 Uploaded RoomPlan JSON:", uploadResult.upload_token);

        // Step 5: Generate AI recommendations
        setStatusMessage("Generating plant recommendations...");
        const recommendations = await generateRecommendations(session.id, user.id);
        console.log("🟢 Recommendations generated:", recommendations);
        console.log("🟢 Floorplan SVG URL:", recommendations.floorplan_svg_url);

        // Step 6: Save to Supabase floorplans table
        setStatusMessage("Saving floorplan...");
        const { data: floorplan, error: floorplanError } = await supabase
          .from("floorplans")
          .insert({
            user_id: user.id,
            name: `Room scan ${new Date().toLocaleString()}`,
            roomplan_json: JSON.parse(roomJson),
            floorplan_svg_url: recommendations.floorplan_svg_url,
          })
          .select()
          .single();

        if (floorplanError) {
          console.error("❌ Failed to save floorplan:", floorplanError);
          throw new Error(`Failed to save floorplan: ${floorplanError.message}`);
        }

        console.log("🟢 Saved floorplan:", floorplan.id);

        // Step 7: Save recommendations to Supabase
        setStatusMessage("Saving recommendations...");
        const recommendationInserts = [];

        for (const [roomName, roomData] of Object.entries(recommendations.recommendations)) {
          for (const plant of (roomData as any).plants || []) {
            const perenualData = plant.perenual_data;

            // Upsert plant to catalog if we have Perenual data
            let plantId = null;
            if (perenualData?.perenual_id) {
              const { data: catalogPlant, error: plantError } = await supabase
                .from("plants")
                .upsert(
                  {
                    perenual_id: perenualData.perenual_id,
                    common_name: perenualData.common_name,
                    scientific_name: perenualData.scientific_name,
                    watering_general_benchmark: perenualData.watering_general_benchmark,
                    watering_interval_days: perenualData.watering_interval_days,
                    sunlight: perenualData.sunlight,
                    maintenance_category: perenualData.maintenance_category,
                    poison_human: perenualData.poison_human,
                    poison_pets: perenualData.poison_pets,
                    default_image_url: perenualData.default_image_url,
                    care_notes: perenualData.care_notes,
                  },
                  { onConflict: "perenual_id" }
                )
                .select()
                .single();

              if (!plantError && catalogPlant) {
                plantId = catalogPlant.id;
              }
            }

            recommendationInserts.push({
              user_id: user.id,
              plant_id: plantId,
              floorplan_id: floorplan.id,
              source: recommendations.source_model,
              reason: (roomData as any).reasoning || null,
              recommended_location: {
                room: roomName,
                placement: (roomData as any).placement || null,
                plant_name: plant.name,
                light_need: plant.light_need,
                watering: plant.watering,
                ...perenualData,
              },
              status: "pending",
            });
          }
        }

        if (recommendationInserts.length > 0) {
          const { error: recError } = await supabase
            .from("plant_recommendations")
            .insert(recommendationInserts);

          if (recError) {
            console.error("❌ Failed to save recommendations:", recError);
            throw new Error(`Failed to save recommendations: ${recError.message}`);
          }

          console.log("🟢 Saved", recommendationInserts.length, "recommendations");
        }

        // Step 8: Clean up Django session data
        setStatusMessage("Cleaning up...");
        try {
          await cleanupSession(session.id);
          console.log("🟢 Django session cleaned up");
        } catch (e) {
          console.warn("⚠️ Failed to cleanup Django session:", e);
          // Don't throw - cleanup failure shouldn't block user flow
        }

        // Step 9: Navigate to floorplan screen
        Alert.alert(
          "Scan Complete!",
          `Found ${recommendationInserts.length} plant recommendations for your space.`,
          [
            {
              text: "View Floorplan",
              onPress: () => {
                router.push(`/floorplan?id=${floorplan.id}` as any);
              },
            },
          ]
        );
      } catch (e: any) {
        if (e?.code === "CANCELLED") {
          router.back();
          return;
        }
        console.error("❌ Room scan workflow failed:", e);
        Alert.alert("Scan failed", e?.message ?? "Unknown error");
        router.back();
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>{statusMessage}</Text>
    </View>
  );
}