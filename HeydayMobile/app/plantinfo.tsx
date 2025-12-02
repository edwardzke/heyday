import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

// Design tokens from Figma
const colors = {
  background: '#FCF7F4',
  primary: '#349552',
  dark: '#191919',
  white: '#FFFFFF',
  // Difficulty colors
  easy: '#349552',
  medium: '#FEAE33',
  hard: '#EF583D',
  // Info colors
  water: '#35B0FE',
};

const { width: screenWidth } = Dimensions.get('window');

// Types
interface PlantDetails {
  id: string;
  common_name: string | null;
  scientific_name: string | null;
  default_image_url: string | null;
  maintenance_category: string | null;
  sunlight: string | null;
  watering_general_benchmark: string | null;
  watering_interval_days: number | null;
  soil_type: string | null;
  poison_human: boolean | null;
  poison_pets: boolean | null;
  care_notes: string | null;
  description: string | null;
}

interface PlantNote {
  id: string;
  notes: string;
  taken_at: string;
}

// Get difficulty color
function getDifficultyColor(category: string | null): string {
  const normalized = (category || '').toLowerCase().trim();
  if (normalized === 'low' || normalized === 'easy') return colors.easy;
  if (normalized === 'high' || normalized === 'hard') return colors.hard;
  return colors.medium;
}

// Get difficulty label
function getDifficultyLabel(category: string | null): string {
  const normalized = (category || '').toLowerCase().trim();
  if (normalized === 'low' || normalized === 'easy') return 'Easy';
  if (normalized === 'high' || normalized === 'hard') return 'Hard';
  return 'Medium';
}

// Info Card Component
function InfoCard({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardHeader}>
        <Ionicons name={icon} size={20} color={iconColor || colors.dark} />
        <Text style={styles.infoCardLabel}>{label}</Text>
      </View>
      <Text style={styles.infoCardValue}>{value}</Text>
    </View>
  );
}

// Tab type
type TabName = 'Care' | 'Notes';

// Main Plant Info Screen
export default function PlantInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useSupabaseUser();
  
  // Get params - can come from recommendation or direct plant
  const recommendationId = params.recommendationId as string;
  const plantId = params.plantId as string;
  const plantName = params.plantName as string;
  
  const [activeTab, setActiveTab] = useState<TabName>('Care');
  const [plant, setPlant] = useState<PlantDetails | null>(null);
  const [notes, setNotes] = useState<PlantNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Fetch plant details
  const fetchPlantDetails = useCallback(async () => {
    setLoading(true);
    try {
      let plantData: PlantDetails | null = null;

      // If we have a recommendation ID, fetch via recommendation
      if (recommendationId) {
        const { data, error } = await supabase
          .from('plant_recommendations')
          .select(`
            id,
            status,
            plants (
              id,
              common_name,
              scientific_name,
              default_image_url,
              maintenance_category,
              sunlight,
              watering_general_benchmark,
              watering_interval_days,
              soil_type,
              poison_human,
              poison_pets,
              care_notes,
              description
            )
          `)
          .eq('id', recommendationId)
          .single();

        if (error) throw error;
        if (data?.plants) {
          plantData = data.plants as unknown as PlantDetails;
          setIsSaved(data.status === 'accepted');
        }
      }
      // If we have a plant ID directly
      else if (plantId) {
        const { data, error } = await supabase
          .from('plants')
          .select('*')
          .eq('id', plantId)
          .single();

        if (error) throw error;
        plantData = data as PlantDetails;
      }

      setPlant(plantData);

      // Fetch notes for this plant if user has it
      if (user && plantData?.id) {
        const { data: userPlantData } = await supabase
          .from('user_plants')
          .select('id, photos')
          .eq('user_id', user.id)
          .eq('plant_id', plantData.id)
          .single();

        if (userPlantData?.photos) {
          // Parse notes from photos array (which stores notes too)
          const plantNotes: PlantNote[] = (userPlantData.photos || [])
            .filter((item: any) => item.notes || item.type === 'note')
            .map((item: any, index: number) => ({
              id: `note-${index}`,
              notes: item.notes || item.note_text || '',
              taken_at: item.taken_at || item.created_at || new Date().toISOString(),
            }));
          setNotes(plantNotes);
        }
      }
    } catch (error) {
      console.error('Error fetching plant details:', error);
    } finally {
      setLoading(false);
    }
  }, [recommendationId, plantId, user]);

  useEffect(() => {
    fetchPlantDetails();
  }, [fetchPlantDetails]);

  // Handle save recommendation
  const handleSaveRecommendation = async () => {
    if (!recommendationId || !user) {
      Alert.alert('Error', 'Unable to save recommendation');
      return;
    }

    try {
      // Update recommendation status to accepted
      const { error } = await supabase
        .from('plant_recommendations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', recommendationId);

      if (error) throw error;

      setIsSaved(true);
      Alert.alert('Saved!', `${plant?.common_name || 'Plant'} has been saved to your recommendations.`);
    } catch (error) {
      console.error('Error saving recommendation:', error);
      Alert.alert('Error', 'Failed to save recommendation');
    }
  };

  // Format watering info
  const getWateringText = () => {
    if (plant?.watering_interval_days) {
      return `${plant.watering_interval_days} days`;
    }
    return plant?.watering_general_benchmark || 'Average';
  };

  // Render Care tab content
  const renderCareContent = () => (
    <View style={styles.careContent}>
      <InfoCard
        icon="sunny-outline"
        iconColor="#FFB800"
        label="Sunlight"
        value={plant?.sunlight || 'Average'}
      />
      <InfoCard
        icon="water-outline"
        iconColor={colors.water}
        label="Water"
        value={getWateringText()}
      />
      <InfoCard
        icon="leaf-outline"
        iconColor={colors.primary}
        label="Soil"
        value={plant?.soil_type || 'Well-drained'}
      />
      <InfoCard
        icon="cut-outline"
        iconColor={colors.dark}
        label="Prune"
        value="As needed"
      />
      <InfoCard
        icon="warning-outline"
        iconColor={colors.hard}
        label="Poisonous"
        value={plant?.poison_human ? 'Yes' : 'No'}
      />
      <InfoCard
        icon="paw-outline"
        iconColor={colors.primary}
        label="Pet-friendly"
        value={plant?.poison_pets ? 'No' : 'Yes'}
      />
      {plant?.care_notes && (
        <View style={styles.careNotesCard}>
          <Text style={styles.careNotesLabel}>Care Notes</Text>
          <Text style={styles.careNotesText}>{plant.care_notes}</Text>
        </View>
      )}
    </View>
  );

  // Render Notes tab content
  const renderNotesContent = () => (
    <View style={styles.notesContent}>
      {notes.length > 0 ? (
        notes.map((note) => (
          <View key={note.id} style={styles.noteCard}>
            <Text style={styles.noteDate}>
              {new Date(note.taken_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Text style={styles.noteText}>{note.notes}</Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyNotes}>
          <Ionicons name="document-text-outline" size={48} color={colors.dark + '40'} />
          <Text style={styles.emptyNotesText}>No notes yet</Text>
          <Text style={styles.emptyNotesSubtext}>
            Add this plant to your garden to start tracking notes
          </Text>
        </View>
      )}
    </View>
  );

  const difficultyColor = getDifficultyColor(plant?.maintenance_category);
  const difficultyLabel = getDifficultyLabel(plant?.maintenance_category);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Section */}
        <View style={styles.heroSection}>
          {plant?.default_image_url ? (
            <Image source={{ uri: plant.default_image_url }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
              <Ionicons name="leaf" size={80} color={colors.primary} />
            </View>
          )}
          
          {/* Gradient Overlay */}
          <View style={styles.heroGradient} />
          
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.dark} />
          </TouchableOpacity>
          
          {/* Plant Info Overlay */}
          <View style={styles.heroOverlay}>
            <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor }]}>
              <Text style={styles.difficultyText}>{difficultyLabel}</Text>
            </View>
            <Text style={styles.plantName}>
              {plant?.common_name || plantName || 'Unknown Plant'}
            </Text>
            {plant?.scientific_name && (
              <Text style={styles.scientificName}>{plant.scientific_name}</Text>
            )}
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('Care')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Care' && styles.tabTextActive]}>
              Care
            </Text>
            {activeTab === 'Care' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('Notes')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Notes' && styles.tabTextActive]}>
              Notes
            </Text>
            {activeTab === 'Notes' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading plant details...</Text>
          </View>
        ) : activeTab === 'Care' ? (
          renderCareContent()
        ) : (
          renderNotesContent()
        )}
      </ScrollView>

      {/* Save Button (only for recommendations) */}
      {recommendationId && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaved && styles.saveButtonSaved]}
            onPress={handleSaveRecommendation}
            activeOpacity={0.8}
            disabled={isSaved}
          >
            <Ionicons 
              name={isSaved ? 'checkmark' : 'heart'} 
              size={20} 
              color={colors.background} 
            />
            <Text style={styles.saveButtonText}>
              {isSaved ? 'Saved' : 'Save Recommendation'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  
  // Hero Section
  heroSection: {
    width: screenWidth,
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImagePlaceholder: {
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backButton: {
    position: 'absolute',
    top: 54,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 8,
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
    color: colors.white,
    lineHeight: 16,
  },
  plantName: {
    fontFamily: 'System',
    fontSize: 48,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 56,
  },
  scientificName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    fontStyle: 'italic',
    color: colors.white,
    lineHeight: 20,
  },
  
  // Tab Navigation
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark + '20',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },
  tabText: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '600',
    color: colors.dark + '60',
    lineHeight: 28,
  },
  tabTextActive: {
    color: colors.dark,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  
  // Care Content
  careContent: {
    padding: 16,
    gap: 20,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: colors.dark,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoCardLabel: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: colors.dark,
    lineHeight: 20,
  },
  infoCardValue: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '500',
    color: colors.dark,
    lineHeight: 28,
  },
  careNotesCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  careNotesLabel: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600',
    color: colors.dark,
  },
  careNotesText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '400',
    color: colors.dark,
    lineHeight: 20,
  },
  
  // Notes Content
  notesContent: {
    padding: 16,
    gap: 16,
  },
  noteCard: {
    borderWidth: 1,
    borderColor: colors.dark,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  noteDate: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '500',
    color: colors.dark + '80',
  },
  noteText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '400',
    color: colors.dark,
    lineHeight: 22,
  },
  emptyNotes: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyNotesText: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '600',
    color: colors.dark,
  },
  emptyNotesSubtext: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '400',
    color: colors.dark + '80',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  
  // Loading
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'System',
    fontSize: 16,
    color: colors.dark + '80',
  },
  
  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
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
  },
  saveButtonSaved: {
    backgroundColor: colors.dark + '60',
  },
  saveButtonText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: colors.background,
    lineHeight: 20,
  },
});

