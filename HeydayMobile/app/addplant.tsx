import React, { useState, useEffect } from 'react';
import {
  Alert,
  Image,
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

export default function AddPlantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [species, setSpecies] = useState('');
  const [age, setAge] = useState('');
  const [nickname, setNickname] = useState('');
  const [wateringSchedule, setWateringSchedule] = useState('1.0');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Check if a photo was passed from the camera page
  useEffect(() => {
    if (params.photoUri && typeof params.photoUri === 'string') {
      setImageUri(params.photoUri);
    }
  }, [params.photoUri]);

  const pickImage = async () => {
    // Request permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a plant image.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    // Request camera permissions
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your camera to take a photo.');
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleImageUpload = () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Library',
          onPress: pickImage,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
    try {
      // Get the file extension
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `plant-images/${fileName}`;

      // Create form data for upload
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: `image/${ext}`,
        name: fileName,
      } as any);

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('plant-images')
        .upload(filePath, formData, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('plant-images')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!species.trim()) {
      Alert.alert('Missing Information', 'Please enter a plant species.');
      return;
    }

    if (!age.trim()) {
      Alert.alert('Missing Information', 'Please enter the plant age.');
      return;
    }

    // Validate watering schedule
    const wateringNum = parseFloat(wateringSchedule);
    if (isNaN(wateringNum) || wateringNum < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid watering schedule (e.g., 1.5 for 1.5 waters per day).');
      return;
    }

    setSubmitting(true);

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Authentication Required',
          'You need to be logged in to add plants. Would you like to sign up or log in?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In', onPress: () => router.push('/login') },
          ]
        );
        return;
      }

      // Upload image if present
      let imageUrl = null;
      if (imageUri) {
        imageUrl = await uploadImageToSupabase(imageUri);
        if (!imageUrl) {
          Alert.alert('Warning', 'Image upload failed, but plant will still be saved.');
        }
      }

      // Insert plant into database
      const { data, error } = await supabase
        .from('plants')
        .insert([
          {
            user_id: user.id,
            species: species.trim(),
            age: age.trim(),
            nickname: nickname.trim() || null,
            watering_schedule: wateringNum,
            notes: notes.trim() || null,
            image_url: imageUrl,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      Alert.alert(
        'Plant Added!',
        `Successfully added ${species}${nickname ? ` (${nickname})` : ''} to your collection.`,
        [
          {
            text: 'OK',
            onPress: () => router.push('/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error adding plant:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to add plant. Please try again.'
      );
    } finally {
      setSubmitting(false);
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
            <Text style={styles.headerTitle}>Add New Plant</Text>
            <Text style={styles.headerSubtitle}>
              Create a new entry for your plant collection
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Plant Species <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Monstera deliciosa"
                placeholderTextColor="rgba(15, 49, 29, 0.4)"
                value={species}
                onChangeText={setSpecies}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Age <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2 years, 6 months"
                placeholderTextColor="rgba(15, 49, 29, 0.4)"
                value={age}
                onChangeText={setAge}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nickname (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Monty"
                placeholderTextColor="rgba(15, 49, 29, 0.4)"
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Watering Schedule <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.photoHint}>Waters per day (e.g., 1.0, 0.5, 2.0)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1.0"
                placeholderTextColor="rgba(15, 49, 29, 0.4)"
                value={wateringSchedule}
                onChangeText={setWateringSchedule}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add care notes, observations, or reminders..."
                placeholderTextColor="rgba(15, 49, 29, 0.4)"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Plant Photo (optional)</Text>
              <Text style={styles.photoHint}>Add a photo for easy identification</Text>

              {imageUri ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setImageUri(null)}
                    style={styles.removePhotoButton}
                  >
                    <Text style={styles.removePhotoText}>× Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleImageUpload}
                  style={styles.photoUploadButton}
                >
                  <Text style={styles.photoUploadIcon}>📷</Text>
                  <Text style={styles.photoUploadText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleSubmit}
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#f5f7f4" />
              ) : (
                <Text style={styles.submitButtonText}>Add Plant</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={styles.cancelButton}
              onPress={() => router.push('/dashboard')}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Quick Tips</Text>
            <Text style={styles.infoText}>
              • Be specific with species names for better care recommendations
            </Text>
            <Text style={styles.infoText}>
              • Age helps track growth milestones
            </Text>
            <Text style={styles.infoText}>
              • Nicknames make it easier to identify your plants
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
  required: {
    color: '#d32f2f',
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
  textArea: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
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
  cancelButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(11, 77, 38, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0b4d26',
    letterSpacing: 0.3,
  },
  infoCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 77, 38, 0.05)',
    gap: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0b4d26',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(15, 49, 29, 0.7)',
  },
  photoHint: {
    fontSize: 13,
    color: 'rgba(15, 49, 29, 0.5)',
    marginTop: -4,
    marginBottom: 8,
  },
  photoUploadButton: {
    height: 160,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(11, 77, 38, 0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(11, 77, 38, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoUploadIcon: {
    fontSize: 32,
  },
  photoUploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0b4d26',
  },
  photoPreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(11, 77, 38, 0.1)',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(211, 47, 47, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  removePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
