import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// Icon components (using emoji for now - replace with actual icons later)
const CloseIcon = () => <Text style={styles.icon}>✕</Text>;
const AddIcon = () => <Text style={styles.iconWhite}>+</Text>;
const SunIcon = () => <Text style={styles.iconEmoji}>☀️</Text>;
const WaterIcon = () => <Text style={styles.iconEmoji}>💧</Text>;
const SoilIcon = () => <Text style={styles.iconEmoji}>🪴</Text>;
const PruneIcon = () => <Text style={styles.iconEmoji}>✂️</Text>;
const SkullIcon = () => <Text style={styles.iconEmoji}>☠️</Text>;
const PetIcon = () => <Text style={styles.iconEmoji}>🐾</Text>;

interface PlantData {
  name: string;
  scientificName: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  imageUrl: string;
  sunlight: string;
  water: string;
  soil: string;
  prune: string;
  poisonous: string;
  petFriendly: string;
  notes?: string;
}

export default function PlantRecommendationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'care' | 'notes'>('care');
  const [saving, setSaving] = useState(false);

  // Mock data - replace with actual data from params or API
  const plantData: PlantData = {
    name: params.name as string || 'Pothos',
    scientificName: params.scientificName as string || 'Epipremnum aureum',
    difficulty: (params.difficulty as PlantData['difficulty']) || 'Easy',
    imageUrl: params.imageUrl as string || 'http://localhost:3845/assets/b8ef504ea8b337dd12d95d61b00f3d3287eefc49.png',
    sunlight: params.sunlight as string || 'Low',
    water: params.water as string || '5-7 days',
    soil: params.soil as string || 'Rocky, dry, well-drained',
    prune: params.prune as string || 'Once per year',
    poisonous: params.poisonous as string || 'Yes',
    petFriendly: params.petFriendly as string || 'No',
    notes: params.notes as string,
  };

  const handleSavePlant = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Authentication Required',
          'You need to be logged in to save plants. Would you like to sign up or log in?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In', onPress: () => router.push('/login') },
          ]
        );
        return;
      }

      setSaving(true);

      // Save plant to user's collection
      const { data, error } = await supabase
        .from('plants')
        .insert([
          {
            user_id: user.id,
            species: plantData.name,
            scientific_name: plantData.scientificName,
            difficulty: plantData.difficulty.toLowerCase(),
            image_url: plantData.imageUrl,
            sunlight: plantData.sunlight,
            water: plantData.water,
            soil: plantData.soil,
            prune: plantData.prune,
            poisonous: plantData.poisonous === 'Yes',
            pet_friendly: plantData.petFriendly === 'Yes',
            notes: plantData.notes || null,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      Alert.alert(
        'Plant Saved!',
        `Successfully added ${plantData.name} to your collection.`,
        [
          {
            text: 'OK',
            onPress: () => router.push('/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving plant:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save plant. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return '#349552';
      case 'Medium':
        return '#FEAE33';
      case 'Hard':
        return '#EF583D';
      default:
        return '#349552';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Hero Image Section */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: plantData.imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
            locations={[0.35833, 1]}
            style={styles.heroGradient}
          />

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <CloseIcon />
          </TouchableOpacity>

          {/* Plant Info Overlay */}
          <View style={styles.heroInfo}>
            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(plantData.difficulty) }]}>
              <Text style={styles.difficultyText}>{plantData.difficulty}</Text>
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.plantName}>{plantData.name}</Text>
              <Text style={styles.scientificName}>{plantData.scientificName}</Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'care' && styles.tabActive]}
            onPress={() => setActiveTab('care')}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, activeTab === 'care' && styles.tabTextActive]}>
              Care
            </Text>
            {activeTab === 'care' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'notes' && styles.tabActive]}
            onPress={() => setActiveTab('notes')}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>
              Notes
            </Text>
            {activeTab === 'notes' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Care Tab Content */}
        {activeTab === 'care' && (
          <View style={styles.careContent}>
            {/* Sunlight */}
            <View style={styles.careCard}>
              <View style={styles.careCardHeader}>
                <SunIcon />
                <Text style={styles.careCardTitle}>Sunlight</Text>
              </View>
              <Text style={styles.careCardValue}>{plantData.sunlight}</Text>
            </View>

            {/* Water */}
            <View style={styles.careCard}>
              <View style={styles.careCardHeader}>
                <WaterIcon />
                <Text style={styles.careCardTitle}>Water</Text>
              </View>
              <Text style={styles.careCardValue}>{plantData.water}</Text>
            </View>

            {/* Soil */}
            <View style={styles.careCard}>
              <View style={styles.careCardHeader}>
                <SoilIcon />
                <Text style={styles.careCardTitle}>Soil</Text>
              </View>
              <Text style={styles.careCardValue}>{plantData.soil}</Text>
            </View>

            {/* Prune */}
            <View style={styles.careCard}>
              <View style={styles.careCardHeader}>
                <PruneIcon />
                <Text style={styles.careCardTitle}>Prune</Text>
              </View>
              <Text style={styles.careCardValue}>{plantData.prune}</Text>
            </View>

            {/* Poisonous */}
            <View style={styles.careCard}>
              <View style={styles.careCardHeader}>
                <SkullIcon />
                <Text style={styles.careCardTitle}>Poisonous</Text>
              </View>
              <Text style={styles.careCardValue}>{plantData.poisonous}</Text>
            </View>

            {/* Pet-friendly */}
            <View style={styles.careCard}>
              <View style={styles.careCardHeader}>
                <PetIcon />
                <Text style={styles.careCardTitle}>Pet-friendly</Text>
              </View>
              <Text style={styles.careCardValue}>{plantData.petFriendly}</Text>
            </View>
          </View>
        )}

        {/* Notes Tab Content */}
        {activeTab === 'notes' && (
          <View style={styles.notesContent}>
            <Text style={styles.notesText}>
              {plantData.notes || 'No additional notes available for this plant.'}
            </Text>
          </View>
        )}

        {/* Bottom Spacing for Save Button */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Fixed Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSavePlant}
          disabled={saving}
          accessibilityRole="button"
        >
          <AddIcon />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Plant'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FCF7F4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  heroContainer: {
    height: 300,
    width: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 54,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 40,
    backgroundColor: '#FCF7F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    gap: 12,
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 24,
  },
  difficultyText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: '#FCF7F4',
  },
  heroTextContainer: {
    gap: 4,
  },
  plantName: {
    fontFamily: 'System',
    fontSize: 48,
    fontWeight: '600',
    lineHeight: 56,
    color: '#FCF7F4',
  },
  scientificName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 20,
    color: '#FCF7F4',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FCF7F4',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabActive: {
    // Active state styling handled by indicator
  },
  tabText: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    color: '#191919',
  },
  tabTextActive: {
    color: '#191919',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#349552',
  },
  careContent: {
    padding: 16,
    gap: 20,
  },
  careCard: {
    borderWidth: 1,
    borderColor: '#191919',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    backgroundColor: '#FCF7F4',
  },
  careCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  careCardTitle: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: '#191919',
  },
  careCardValue: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
    color: '#191919',
  },
  notesContent: {
    padding: 16,
  },
  notesText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#191919',
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
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
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
    alignSelf: 'center',
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
  icon: {
    fontSize: 24,
    color: '#191919',
  },
  iconWhite: {
    fontSize: 20,
    color: '#FCF7F4',
    fontWeight: '600',
  },
  iconEmoji: {
    fontSize: 20,
  },
});
