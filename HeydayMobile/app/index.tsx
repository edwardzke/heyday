import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function StartScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.header}>
          <Image
            source={require('../assets/images/welcome.png')}
            style={styles.welcomeImage}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Grow smarter with AR gardening</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/signup')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Get started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/login')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF7F4',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 60,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  welcomeImage: {
    width: 262,
    height: 193,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#B9B6B4',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    width: 200,
    gap: 20,
  },
  primaryButton: {
    backgroundColor: '#349552',
    borderRadius: 48,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FCF7F4',
    lineHeight: 20,
  },
  secondaryButton: {
    backgroundColor: '#B9B6B4',
    borderRadius: 48,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FCF7F4',
    lineHeight: 20,
  },
});
