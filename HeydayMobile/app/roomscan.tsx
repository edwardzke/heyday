import { useEffect } from "react";
import { View, ActivityIndicator, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { NativeModules } from "react-native";

const { ARRoomScanner } = NativeModules;
console.log("NativeModules.ARRoomScanner =", ARRoomScanner);

export default function RoomScanPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // 1) Get the raw string from native
        const payloadString: string = await ARRoomScanner.scanRoom();
        // console.log("🔵 Scanner returned raw:", payloadString);

        // 2) Parse it
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

        const usdzPath: string | undefined = payload.usdzPath;
        const roomJson: string | undefined = payload.roomJson;

        console.log("🟢 usdzPath:", usdzPath);
        console.log("🟢 roomJson length:", roomJson?.length);

        // 👉 TODO: upload usdzPath + roomJson to your backend
        // const fileUri = `file://${usdzPath}`;
        // const formData = new FormData();
        // formData.append("file", {
        //   uri: fileUri,
        //   type: "model/vnd.usdz+zip",
        //   name: "room.usdz",
        // } as any);
        // formData.append("roomJson", roomJson || "{}");
        //
        // const resp = await fetch("https://your-backend/room/upload", {
        //   method: "POST",
        //   body: formData,
        // });
        // if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);

        Alert.alert("Scan complete", `3D file saved at:\n${usdzPath ?? "unknown"}`);

        router.back(); // go back to dashboard afterwards
      } catch (e: any) {
        if (e?.code === "CANCELLED") {
          router.back();
          return;
        }
        console.error("❌ Room scan failed:", e);
        Alert.alert("Scan failed", e?.message ?? "Unknown error");
        router.back();
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Opening room scanner...</Text>
    </View>
  );
}