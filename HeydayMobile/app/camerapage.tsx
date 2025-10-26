import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from "react-native";
import { Camera, CameraView } from "expo-camera";

export default function CameraPage() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // ✅ Ask for permission
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // ✅ Capture and upload
  const takeAndUploadPhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert("Camera not ready!");
      return;
    }

    setUploading(true);

    try {
      // 1️⃣ Capture image
      const photo = await cameraRef.current.takePictureAsync({ base64: false });
      setImageUri(photo.uri);

      // 2️⃣ Create form data
      const formData = new FormData();
      formData.append("photo", {
        uri: photo.uri,
        type: "image/jpeg",
        name: "upload.jpg",
      } as any);

      // 3️⃣ Send to your Django backend
      const response = await fetch("https://8691afe51afc.ngrok-free.app/upload/", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const result = await response.json();
      console.log("✅ Upload response:", result);

      if (result.file_url) {
        setUploadResponse(`Uploaded to: ${result.file_url}`);
      } else {
        setUploadResponse(`Upload failed: ${JSON.stringify(result)}`);
      }
    } catch (error: any) {
      console.error("❌ Upload failed:", error);
      Alert.alert("Upload error", error.message || "Something went wrong.");
    } finally {
      setUploading(false);
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
          {uploading ? (
            <ActivityIndicator size="large" color="#2E7D32" />
          ) : (
            <Text style={styles.result}>{uploadResponse || "Ready!"}</Text>
          )}
          <TouchableOpacity
            onPress={() => {
              setImageUri(null);
              setUploadResponse(null);
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
  buttonContainer: { alignItems: "center", marginBottom: 50 },
  button: {
    backgroundColor: "#66BB6A",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 18 },
  resultContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  preview: { width: 300, height: 400, borderRadius: 12, marginBottom: 20 },
  result: { fontSize: 16, fontWeight: "bold", color: "#2E7D32", textAlign: "center" },
});
