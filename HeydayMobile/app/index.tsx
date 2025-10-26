import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';

export default function LandingScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require('../assets/images/background.jpeg')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>Welcome to Heyday 🌿</Text>
        <Text style={styles.subtitle}>Grow smarter with AR gardening</Text>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/dashboard')}
          >
            <Text style={styles.linkButtonText}>View Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/addplant')}
          >
            <Text style={styles.linkButtonText}>+ Add Plant</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 20,
  },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#c8e6c9', fontSize: 18, marginBottom: 40 },
  buttonGroup: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  button: {
    backgroundColor: '#81C784',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  quickActions: {
    marginTop: 40,
    gap: 10,
    alignItems: 'center',
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
