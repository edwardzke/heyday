import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌻 Your Garden Dashboard</Text>
      <Text style={styles.subtitle}>Monitor your plants and explore AR planting</Text>

      <Link href="/camerapage" asChild>
        <TouchableOpacity style={styles.cameraButton}>
          <Text style={styles.cameraButtonText}>Open Camera</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#C8E6C9' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1B5E20', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#33691E', marginBottom: 30, textAlign: 'center' },
  cameraButton: { backgroundColor: '#4CAF50', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10 },
  cameraButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
