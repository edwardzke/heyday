import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        throw error;
      }

      // Navigate to dashboard on success
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Welcome Back</Text>
            <Text style={styles.headerSubtitle}>
              Sign in to access your plant collection
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="rgba(15, 49, 29, 0.4)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="rgba(15, 49, 29, 0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleLogin}
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#f5f7f4" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => router.push('/signup')}
            >
              <Text style={styles.secondaryButtonText}>Create New Account</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Don't have an account? Sign up to start tracking your plants and
              connect with friends!
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef6f1',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 24,
    gap: 24,
  },
  header: {
    marginTop: 16,
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f311d',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(15, 49, 29, 0.6)',
    lineHeight: 20,
  },
  form: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f311d',
    letterSpacing: 0.2,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(11, 77, 38, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f311d',
    backgroundColor: '#ffffff',
  },
  submitButton: {
    marginTop: 8,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0b4d26',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(11, 77, 38, 0.5)',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f7f4',
    letterSpacing: 0.4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(11, 77, 38, 0.15)',
  },
  dividerText: {
    fontSize: 14,
    color: 'rgba(15, 49, 29, 0.5)',
    fontWeight: '500',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(11, 77, 38, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0b4d26',
    letterSpacing: 0.3,
  },
  infoCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 77, 38, 0.05)',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(15, 49, 29, 0.7)',
    textAlign: 'center',
  },
});
