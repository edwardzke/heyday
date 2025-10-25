import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { Link } from 'expo-router';

export default function LandingScreen() {
  return (
    <ImageBackground
      source={require('../assets/images/background.jpeg')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>Welcome to Heyday 🌿</Text>
        <Text style={styles.subtitle}>Grow smarter with AR gardening</Text>
        <Link href="/dashboard" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#c8e6c9', fontSize: 18, marginBottom: 30 },
  button: { backgroundColor: '#81C784', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
