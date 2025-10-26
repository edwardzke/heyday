import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";

export default function CameraPage() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [showManualButton, setShowManualButton] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const CLASSIFY_URL = "https://6140210fa1a4.ngrok-free.app/upload/classify/";
  const UPLOAD_URL = "https://6140210fa1a4.ngrok-free.app/upload/";

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // 1️⃣ Classify plant (no upload)
  const classifyPlant = async () => {
    if (!cameraRef.current) {
      Alert.alert("Camera not ready!");
      return;
    }
    setLoading(true);
    setShowSaveButton(false);
    setShowManualButton(false);

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: false });
      setImageUri(photo.uri);

      const formData = new FormData();
      formData.append("photo", {
        uri: photo.uri,
        type: "image/jpeg",
        name: "plant.jpg",
      } as any);

      const response = await fetch(CLASSIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const message = data?.error || `Server error ${response.status}`;
        setResult(`⚠️ ${message}`);
        setShowManualButton(true);
        return;
      }

      // 🌿 Confidence check with fallback options
      if (!data.class) {
        setResult("❌ Could not identify this plant.");
        setShowManualButton(true);
        return;
      }

      const confidence = data.score ? (data.score * 100).toFixed(1) : "N/A";
      const predictedClass = data.class || "Unknown plant";

      if (data.score < 0.7) {
        // 🟡 Low confidence → show all options
        setResult(
          `⚠️ Low confidence: ${confidence}% sure this is ${predictedClass}.\nYou can choose to save, add manually, or retake.`
        );
        setShowSaveButton(true);
        setShowManualButton(true);
        return;
      }

      setPlantData(data);
      setResult(
        `🌱 ${data.common_name || data.class}\nConfidence: ${(data.score * 100).toFixed(1)}%`
      );
      setShowSaveButton(true);
    } catch (err: any) {
      console.error("❌ Classification failed:", err);
      Alert.alert("Error", err.message || "Classification failed.");
      setShowManualButton(true);
    } finally {
      setLoading(false);
    }
  };

  // 2️⃣ Save to S3 (after classification)
  const savePlantToCollection = async () => {
    if (!imageUri) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("photo", {
        uri: imageUri,
        type: "image/jpeg",
        name: "plant_saved.jpg",
      } as any);

      const response = await fetch(UPLOAD_URL, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const message = data?.error || `Server error ${response.status}`;
        Alert.alert("⚠️ Upload failed", message);
        return;
      }

      Alert.alert("✅ Success", "Plant added to your collection!", [
        {
          text: "Go to Dashboard",
          onPress: () => router.push("/dashboard"),
        },
      ]);
    } catch (err: any) {
      console.error("❌ Upload failed:", err);
      Alert.alert("Error", err.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  // 3️⃣ Add manually
  const goToManualAdd = () => {
    if (!imageUri) return;
    router.push({
      pathname: "/addplant",
      params: { photoUri: imageUri },
    });
  };

  const resetCamera = () => {
    setImageUri(null);
    setResult(null);
    setShowSaveButton(false);
    setShowManualButton(false);
  };

  if (hasPermission === null) return <Text>Requesting camera permission...</Text>;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  return (
    <View style={styles.container}>
      {!imageUri ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={classifyPlant}>
              <Text style={styles.buttonText}>🔍 Classify Plant</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.resultContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          {loading ? (
            <ActivityIndicator size="large" color="#2E7D32" />
          ) : (
            <>
              <Text style={styles.result}>{result || "Ready!"}</Text>

              {showSaveButton && (
                <TouchableOpacity style={styles.primaryButton} onPress={savePlantToCollection}>
                  <Text style={styles.buttonText}>💾 Save to My Collection</Text>
                </TouchableOpacity>
              )}

              {showManualButton && (
                <TouchableOpacity style={styles.secondaryButton} onPress={goToManualAdd}>
                  <Text style={styles.buttonText}>✏️ Add Manually</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={resetCamera} style={styles.button}>
                <Text style={styles.buttonText}>↩️ Retake</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9" },
  camera: { flex: 1, justifyContent: "flex-end" },
  buttonContainer: { alignItems: "center", marginBottom: 50 },
  primaryButton: {
    backgroundColor: "#0b4d26",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#66BB6A",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 18 },
  resultContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  preview: { width: 300, height: 400, borderRadius: 12, marginBottom: 20 },
  result: { fontSize: 16, fontWeight: "bold", color: "#2E7D32", textAlign: "center", marginBottom: 20 },
});
