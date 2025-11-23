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
        const jsonString = await ARRoomScanner.scanRoom();
        const data = JSON.parse(jsonString);

        // TODO: upload to backend
        // await fetch("https://your-backend/floorplans", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify(data),
        // });

        router.back(); // go back to dashboard afterwards
      } catch (e: any) {
        if (e?.code === "CANCELLED") {
          router.back();
          return;
        }
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
