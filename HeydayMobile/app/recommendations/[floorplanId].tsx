import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase, PlantRecommendation as SupabasePlantRecommendation } from "../../lib/supabase";

interface PlantRecommendationWithData extends SupabasePlantRecommendation {
  recommended_location: {
    room: string;
    placement?: string;
    plant_name: string;
    light_need?: string;
    watering?: string;
    common_name?: string;
    scientific_name?: string;
    watering_general_benchmark?: string;
    watering_interval_days?: number;
    sunlight?: string;
    maintenance_category?: string;
    poison_human?: boolean;
    poison_pets?: boolean;
    default_image_url?: string;
    care_notes?: string;
  };
}

interface GroupedRecommendations {
  [room: string]: PlantRecommendationWithData[];
}

export default function RecommendationsScreen() {
  const { floorplanId } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<PlantRecommendationWithData[]>([]);
  const [groupedRecs, setGroupedRecs] = useState<GroupedRecommendations>({});

  useEffect(() => {
    loadRecommendations();
  }, [floorplanId]);

  async function loadRecommendations() {
    try {
      const { data, error } = await supabase
        .from("plant_recommendations")
        .select("*")
        .eq("floorplan_id", floorplanId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRecommendations((data as PlantRecommendationWithData[]) || []);

      // Group by room
      const grouped: GroupedRecommendations = {};
      for (const rec of (data as PlantRecommendationWithData[]) || []) {
        const room = rec.recommended_location?.room || "Unknown Room";
        if (!grouped[room]) grouped[room] = [];
        grouped[room].push(rec);
      }
      setGroupedRecs(grouped);
    } catch (e: any) {
      console.error("Failed to load recommendations:", e);
      Alert.alert("Error", `Failed to load recommendations: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function acceptRecommendation(rec: PlantRecommendationWithData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in");

      // Update recommendation status
      const { error: updateError } = await supabase
        .from("plant_recommendations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", rec.id);

      if (updateError) throw updateError;

      // Add to user_plants
      const loc = rec.recommended_location;
      const { error: insertError } = await supabase
        .from("user_plants")
        .insert({
          user_id: user.id,
          plant_id: rec.plant_id,
          floorplan_id: floorplanId as string,
          nickname: loc.common_name || loc.plant_name,
          notes: loc.care_notes || null,
          location_meta: { room: loc.room, placement: loc.placement },
          watering_frequency_days: loc.watering_interval_days || null,
          started_at: new Date().toISOString().split("T")[0],
        });

      if (insertError) throw insertError;

      Alert.alert("Added!", `${loc.common_name || loc.plant_name} has been added to your collection.`);
      loadRecommendations(); // Reload to remove from pending list
    } catch (e: any) {
      console.error("Failed to accept recommendation:", e);
      Alert.alert("Error", `Failed to add plant: ${e.message}`);
    }
  }

  async function dismissRecommendation(rec: PlantRecommendationWithData) {
    try {
      const { error } = await supabase
        .from("plant_recommendations")
        .update({
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
        })
        .eq("id", rec.id);

      if (error) throw error;

      loadRecommendations(); // Reload to remove from pending list
    } catch (e: any) {
      console.error("Failed to dismiss recommendation:", e);
      Alert.alert("Error", `Failed to dismiss: ${e.message}`);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading recommendations...</Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No pending recommendations.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plant Recommendations</Text>
        <Text style={styles.headerSubtitle}>
          {recommendations.length} suggestion{recommendations.length !== 1 ? "s" : ""} for your space
        </Text>
      </View>

      {Object.entries(groupedRecs).map(([room, recs]) => (
        <View key={room} style={styles.roomSection}>
          <Text style={styles.roomTitle}>{room}</Text>

          {recs.map((rec) => {
            const loc = rec.recommended_location;
            return (
              <View key={rec.id} style={styles.plantCard}>
                {loc.default_image_url && (
                  <Image
                    source={{ uri: loc.default_image_url }}
                    style={styles.plantImage}
                    resizeMode="cover"
                  />
                )}

                <View style={styles.plantInfo}>
                  <Text style={styles.plantName}>
                    {loc.common_name || loc.plant_name}
                  </Text>
                  {loc.scientific_name && (
                    <Text style={styles.scientificName}>{loc.scientific_name}</Text>
                  )}

                  {loc.placement && (
                    <Text style={styles.detailText}>📍 {loc.placement}</Text>
                  )}
                  {loc.light_need && (
                    <Text style={styles.detailText}>☀️ {loc.light_need}</Text>
                  )}
                  {loc.watering && (
                    <Text style={styles.detailText}>💧 {loc.watering}</Text>
                  )}
                  {loc.maintenance_category && (
                    <Text style={styles.detailText}>
                      🛠️ {loc.maintenance_category} maintenance
                    </Text>
                  )}

                  {(loc.poison_human || loc.poison_pets) && (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningText}>
                        ⚠️{" "}
                        {loc.poison_human && loc.poison_pets
                          ? "Toxic to humans and pets"
                          : loc.poison_human
                          ? "Toxic to humans"
                          : "Toxic to pets"}
                      </Text>
                    </View>
                  )}

                  {rec.reason && (
                    <Text style={styles.reasonText}>💡 {rec.reason}</Text>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.acceptButton]}
                    onPress={() => acceptRecommendation(rec)}
                  >
                    <Text style={styles.buttonText}>✓ Add to Garden</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.dismissButton]}
                    onPress={() => dismissRecommendation(rec)}
                  >
                    <Text style={styles.buttonText}>✕ Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  roomSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#e8f5e9",
    marginBottom: 8,
  },
  plantCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  plantImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#f0f0f0",
  },
  plantInfo: {
    padding: 16,
  },
  plantName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 4,
  },
  scientificName: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 6,
  },
  warningBox: {
    backgroundColor: "#fff3cd",
    borderLeftWidth: 4,
    borderLeftColor: "#ff9800",
    padding: 8,
    marginVertical: 8,
  },
  warningText: {
    fontSize: 13,
    color: "#856404",
    fontWeight: "600",
  },
  reasonText: {
    fontSize: 13,
    color: "#555",
    fontStyle: "italic",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  actionButtons: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
  },
  dismissButton: {
    backgroundColor: "#f44336",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  doneButton: {
    backgroundColor: "#2196F3",
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
