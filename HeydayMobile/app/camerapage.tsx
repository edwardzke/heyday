import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📷 Camera Mode</Text>
      <Text style={styles.subtitle}>Soon: AR placement and plant recognition!</Text>

      <Link href="/dashboard" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>← Back to Dashboard</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F5E9' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#388E3C', marginBottom: 30 },
  button: { backgroundColor: '#81C784', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
