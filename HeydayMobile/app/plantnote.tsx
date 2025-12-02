import React, { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

// Icon components
const ChevronLeftIcon = () => <Text style={styles.iconLarge}>‹</Text>;
const AddIcon = () => <Text style={styles.iconWhite}>+</Text>;

export default function PlantNoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // State
  const [noteText, setNoteText] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);

  // Get params
  const plantId = params.plantId as string;
  const noteId = params.noteId as string;
  const plantName = params.plantName as string;

  useEffect(() => {
    // Set current date
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    setNoteDate(formattedDate);

    // If noteId is provided, load existing note
    if (noteId) {
      loadNote();
    }

    // If note text is provided in params (for pre-populated notes)
    if (params.noteText && typeof params.noteText === 'string') {
      setNoteText(params.noteText);
    }
  }, [noteId, params.noteText]);

  const loadNote = async () => {
    try {
      const { data, error } = await supabase
        .from('plant_notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (error) throw error;

      if (data) {
        setNoteText(data.note_text);
        // Format the date from the database
        const date = new Date(data.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        setNoteDate(formattedDate);
        setIsEditMode(false); // Viewing existing note
      }
    } catch (error: any) {
      console.error('Error loading note:', error);
      Alert.alert('Error', 'Failed to load note');
    }
  };

  const handleSaveNote = async () => {
    // Validate
    if (!noteText.trim()) {
      Alert.alert('Empty Note', 'Please write something before saving.');
      return;
    }

    if (!plantId) {
      Alert.alert('Error', 'No plant associated with this note.');
      return;
    }

    setSaving(true);

    try {
      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Authentication Required',
          'You need to be logged in to save notes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In', onPress: () => router.push('/login') },
          ]
        );
        return;
      }

      if (noteId) {
        // Update existing note
        const { error } = await supabase
          .from('plant_notes')
          .update({
            note_text: noteText.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', noteId);

        if (error) throw error;

        Alert.alert('Note Updated', 'Your note has been updated successfully.', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        // Create new note
        const { data, error } = await supabase
          .from('plant_notes')
          .insert([
            {
              user_id: user.id,
              plant_id: plantId,
              note_text: noteText.trim(),
            },
          ])
          .select()
          .single();

        if (error) throw error;

        Alert.alert('Note Saved', 'Your note has been saved successfully.', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error saving note:', error);
      Alert.alert('Error', error.message || 'Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeftIcon />
            </TouchableOpacity>
          </View>

          {/* Note Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.noteTitle}>Note</Text>
            <Text style={styles.noteDate}>{noteDate}</Text>
          </View>

          {/* Note Text Input */}
          <View style={styles.noteInputContainer}>
            <TextInput
              style={styles.noteInput}
              placeholder="Write your observations, care notes, or reminders..."
              placeholderTextColor="rgba(25, 25, 25, 0.4)"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
              editable={isEditMode || !noteId}
              autoFocus={!noteId}
            />
          </View>

          {/* Spacer for fixed button */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Fixed Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveNote}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FCF7F4" />
            ) : (
              <>
                <AddIcon />
                <Text style={styles.saveButtonText}>
                  {noteId ? 'Update Note' : 'Save Note'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FCF7F4',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 96,
    paddingBottom: 120,
    gap: 40,
  },
  topBar: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 40,
    backgroundColor: '#FCF7F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    gap: 8,
    paddingVertical: 24,
  },
  noteTitle: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
    color: '#191919',
  },
  noteDate: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: '#191919',
  },
  noteInputContainer: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 24,
    padding: 20,
    minHeight: 195,
    backgroundColor: '#FCF7F4',
  },
  noteInput: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: '#191919',
    minHeight: 155,
  },
  bottomSpacer: {
    height: 20,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FCF7F4',
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: 34,
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#349552',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: 200,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(52, 149, 82, 0.5)',
  },
  saveButtonText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: '#FCF7F4',
  },
  iconLarge: {
    fontSize: 32,
    fontWeight: '600',
    color: '#191919',
  },
  iconWhite: {
    fontSize: 20,
    color: '#FCF7F4',
    fontWeight: '600',
  },
});
