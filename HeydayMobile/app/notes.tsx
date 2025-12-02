import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Design tokens from Figma
const colors = {
  background: '#FCF7F4',
  primary: '#349552',
  dark: '#191919',
  white: '#FFFFFF',
};

export default function NotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Get plant info from params (passed from dashboard)
  const plantId = params.plantId as string;
  const plantName = params.plantName as string || 'Plant';
  
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Format current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Handle save note
  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      Alert.alert('Empty Note', 'Please write something before saving.');
      return;
    }

    setIsSaving(true);

    try {
      // ============================================
      // TODO: DATABASE INTEGRATION
      // ============================================
      // The code to save the note to the database would go here.
      // 
      // Expected implementation:
      // 1. Get the current user from Supabase auth
      // 2. Update the user_plants table's "photos" JSONB array
      //    (which stores progress notes and photos)
      // 3. Or create a separate "plant_notes" table if preferred
      //
      // Example structure for the note:
      // {
      //   id: uuid,
      //   plant_id: plantId,
      //   user_id: user.id,
      //   note_text: noteText,
      //   created_at: new Date().toISOString(),
      //   type: 'text_note'  // vs 'photo_note'
      // }
      //
      // Sample code (commented out):
      // 
      // import { supabase } from '../lib/supabase';
      // 
      // const { data: { user } } = await supabase.auth.getUser();
      // 
      // // Option 1: Update photos JSONB array in user_plants
      // const { data: plantData } = await supabase
      //   .from('user_plants')
      //   .select('photos')
      //   .eq('id', plantId)
      //   .single();
      // 
      // const existingPhotos = plantData?.photos || [];
      // const newNote = {
      //   type: 'note',
      //   notes: noteText,
      //   taken_at: new Date().toISOString(),
      // };
      // 
      // await supabase
      //   .from('user_plants')
      //   .update({ photos: [...existingPhotos, newNote] })
      //   .eq('id', plantId);
      //
      // ============================================

      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 500));

      Alert.alert(
        'Note Saved!',
        `Your progress note for ${plantName} has been saved.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.dark} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title and Date */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Note</Text>
            <Text style={styles.date}>{currentDate}</Text>
            {plantName && (
              <Text style={styles.plantLabel}>for {plantName}</Text>
            )}
          </View>

          {/* Note Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Write your progress note here..."
              placeholderTextColor={colors.dark + '60'}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveNote}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <Ionicons name="add" size={20} color={colors.background} />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Note'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 40,
  },
  titleSection: {
    paddingVertical: 24,
    gap: 8,
  },
  title: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    color: colors.dark,
    lineHeight: 42,
  },
  date: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: colors.dark,
    lineHeight: 20,
  },
  plantLabel: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '400',
    color: colors.dark + '80',
    lineHeight: 18,
    marginTop: 4,
  },
  
  // Input
  inputContainer: {
    borderWidth: 1,
    borderColor: colors.dark,
    borderRadius: 24,
    padding: 20,
    minHeight: 195,
  },
  textInput: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: colors.dark,
    lineHeight: 20,
  },
  
  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 34,
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 48,
    paddingVertical: 10,
    paddingHorizontal: 24,
    width: 200,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: colors.background,
    lineHeight: 20,
  },
});

