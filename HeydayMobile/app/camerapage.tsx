import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";

export default function CameraPage() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const BACKEND_URL = "https://imposingly-lighter-marylee.ngrok-free.dev/upload/classify/";


  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // ✅ Capture photo and redirect to add plant page
  const takePhotoForPlant = async () => {
    if (!cameraRef.current) {
      Alert.alert("Camera not ready!");
      return;
    }

    try {
      // Capture image
      const photo = await cameraRef.current.takePictureAsync({ base64: false });

      // Navigate to addplant page with the photo URI
      router.push({
        pathname: '/addplant',
        params: { photoUri: photo.uri },
      });
    } catch (error: any) {
      console.error("❌ Photo capture failed:", error);
      Alert.alert("Capture error", error.message || "Something went wrong.");
    }
  };

  // ✅ Capture and upload (original functionality)
  const takeAndUploadPhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert("Camera not ready!");
      return;
    }
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: false });
      setImageUri(photo.uri);

      const formData = new FormData();
      formData.append("photo", {
        uri: photo.uri,
        type: "image/jpeg",
        name: "plant.jpg",
      } as any);

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        body: formData,
      });

      let data: any = null;
      let rawBody: string | null = null;
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          rawBody = await response.text();
        }
      } catch (err) {
        rawBody = rawBody ?? "[unreadable response]";
        console.error("❌ Failed to parse response:", err);
      }

      if (!response.ok || (data && data.error)) {
        const message =
          (data && data.error) ||
          rawBody ||
          `Server error ${response.status}`;
        setResult(`⚠️ ${message}`);
        return;
      }

      if (data?.class) {
        setResult(
          `🌱 ${data.common_name || data.class}\nConfidence: ${(data.score * 100).toFixed(1)}%`
        );
      } else {
        setResult("❌ Could not identify plant.");
      }
    } catch (err: any) {
      console.error("❌ Upload failed:", err);
      Alert.alert("Error", err.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) return <Text>Requesting camera permission...</Text>;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  return (
    <View style={styles.container}>
      {!imageUri ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={takeAndUploadPhoto}>
              <Text style={styles.buttonText}>📸 Capture & Upload</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.resultContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          {loading ? (
            <ActivityIndicator size="large" color="#2E7D32" />
          ) : (
            <Text style={styles.result}>{result || "Ready!"}</Text>
          )}
          <TouchableOpacity
            onPress={() => {
              setImageUri(null);
              setResult(null);
            }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>↩️ Retake</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9" },
  camera: { flex: 1, justifyContent: "flex-end" },
  buttonContainer: { alignItems: "center", marginBottom: 50, gap: 12 },
  primaryButton: {
    backgroundColor: "#0b4d26",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  button: {
    backgroundColor: "#66BB6A",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 18 },
  resultContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  preview: { width: 300, height: 400, borderRadius: 12, marginBottom: 20 },
  result: { fontSize: 16, fontWeight: "bold", color: "#2E7D32", textAlign: "center" },
});
