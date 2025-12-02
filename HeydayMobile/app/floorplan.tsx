import React, { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { supabase, Floorplan, PlantRecommendation as SupabasePlantRecommendation, Plant } from '../lib/supabase';

const { width } = Dimensions.get('window');

// Icon components
const ChevronLeftIcon = () => <Text style={styles.iconLarge}>‹</Text>;
const EditIcon = () => <Text style={styles.iconMedium}>✎</Text>;
const FavoriteIcon = () => <Text style={styles.iconMedium}>♡</Text>;
const FavoriteFilledIcon = () => <Text style={styles.iconMedium}>♥</Text>;
const SunIcon = () => <Text style={styles.iconSmall}>☀️</Text>;
const WaterIcon = () => <Text style={styles.iconSmall}>💧</Text>;

interface PlantRecommendationWithDetails extends SupabasePlantRecommendation {
  plants?: Plant;
}

export default function FloorPlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const floorplanId = params.id as string;

  // State
  const [loading, setLoading] = useState(true);
  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [recommendations, setRecommendations] = useState<PlantRecommendationWithDetails[]>([]);
  const [roomName, setRoomName] = useState('My Room');
  const [isEditingName, setIsEditingName] = useState(false);
  const [favoritedPlants, setFavoritedPlants] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [floorplanId]);

  const loadData = async () => {
    if (!floorplanId) {
      Alert.alert('Error', 'No floorplan ID provided');
      router.back();
      return;
    }

    try {
      setLoading(true);

      // Load floorplan
      const { data: fpData, error: fpError } = await supabase
        .from('floorplans')
        .select('*')
        .eq('id', floorplanId)
        .single();

      if (fpError) throw fpError;
      setFloorplan(fpData);
      setRoomName(fpData.name || 'My Room');

      // Load recommendations with plant details
      const { data: recsData, error: recsError } = await supabase
        .from('plant_recommendations')
        .select('*, plants(*)')
        .eq('floorplan_id', floorplanId)
        .eq('status', 'pending');

      if (recsError) throw recsError;
      setRecommendations(recsData || []);

    } catch (error: any) {
      console.error('Failed to load floorplan data:', error);
      Alert.alert('Error', error.message || 'Failed to load floorplan data');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (maintenanceLevel?: string | null) => {
    if (!maintenanceLevel) return '#349552';
    const level = maintenanceLevel.toLowerCase();
    switch (level) {
      case 'low':
        return '#349552';
      case 'medium':
        return '#FEAE33';
      case 'high':
        return '#EF583D';
      default:
        return '#349552';
    }
  };

  const getDifficultyLabel = (maintenanceLevel?: string | null) => {
    if (!maintenanceLevel) return 'Easy';
    const level = maintenanceLevel.toLowerCase();
    switch (level) {
      case 'low':
        return 'Easy';
      case 'medium':
        return 'Medium';
      case 'high':
        return 'Hard';
      default:
        return 'Easy';
    }
  };

  const handleFavoriteToggle = (plantId: string) => {
    setFavoritedPlants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(plantId)) {
        newSet.delete(plantId);
      } else {
        newSet.add(plantId);
      }
      return newSet;
    });
  };

  const handlePlantPress = (rec: PlantRecommendationWithDetails) => {
    const plant = rec.plants;
    if (!plant) return;

    // Navigate to plant details
    router.push({
      pathname: '/plantrecommendation',
      params: {
        name: plant.common_name || 'Unknown Plant',
        scientificName: plant.scientific_name || '',
        difficulty: getDifficultyLabel(plant.maintenance_category),
        imageUrl: plant.default_image_url || '',
        sunlight: plant.sunlight || 'Unknown',
        water: plant.watering_general_benchmark || 'Unknown',
      },
    });
  };

  const handleEditRoomName = () => {
    setIsEditingName(false);
    // Could save to backend here
  };

  const renderPlantCard = (rec: PlantRecommendationWithDetails) => {
    const plant = rec.plants;
    if (!plant) return null;

    const isFavorited = favoritedPlants.has(rec.id);
    const imageUrl = plant.default_image_url || 'https://via.placeholder.com/200';
    const plantName = plant.common_name || 'Unknown Plant';
    const maintenance = plant.maintenance_category;
    const sunlight = plant.sunlight || 'Unknown';
    const watering = plant.watering_general_benchmark || 'Unknown';
    const room = rec.recommended_location?.room || '';

    return (
      <TouchableOpacity
        key={rec.id}
        style={styles.plantCard}
        onPress={() => handlePlantPress(rec)}
        accessibilityRole="button"
      >
        <View style={styles.plantImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.plantImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
            locations={[0.50303, 1]}
            style={styles.plantGradient}
          />

          {/* Difficulty badge */}
          {maintenance && (
            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(maintenance) }]}>
              <Text style={styles.difficultyText}>{getDifficultyLabel(maintenance)}</Text>
            </View>
          )}

          {/* Plant name and favorite */}
          <View style={styles.plantOverlay}>
            <View style={{ flex: 1 }}>
              <Text style={styles.plantName} numberOfLines={1}>{plantName}</Text>
              {room && <Text style={styles.plantLocation}>{room}</Text>}
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleFavoriteToggle(rec.id);
              }}
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isFavorited ? <FavoriteFilledIcon /> : <FavoriteIcon />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Plant details */}
        <View style={styles.plantDetails}>
          <View style={styles.plantDetailRow}>
            <SunIcon />
            <Text style={styles.plantDetailText} numberOfLines={1}>{sunlight}</Text>
          </View>
          <View style={styles.plantDetailRow}>
            <WaterIcon />
            <Text style={styles.plantDetailText} numberOfLines={1}>{watering}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color="#349552" />
        <Text style={styles.loadingText}>Loading floorplan...</Text>
      </SafeAreaView>
    );
  }

  if (!floorplan) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={styles.errorText}>Floorplan not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeftIcon />
        </TouchableOpacity>

        {/* Room Name Header */}
        <View style={styles.headerContainer}>
          {isEditingName ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.roomNameInput}
                value={roomName}
                onChangeText={setRoomName}
                onBlur={handleEditRoomName}
                onSubmitEditing={handleEditRoomName}
                autoFocus
                selectTextOnFocus
              />
            </View>
          ) : (
            <View style={styles.roomNameContainer}>
              <Text style={styles.roomName}>{roomName}</Text>
              <TouchableOpacity
                onPress={() => setIsEditingName(true)}
                accessibilityRole="button"
                accessibilityLabel="Edit room name"
              >
                <EditIcon />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Floor Plan Visualization */}
        <View style={styles.floorPlanContainer}>
          {floorplan.floorplan_svg ? (
            <SvgXml xml={floorplan.floorplan_svg} width="100%" height={400} />
          ) : (
            <View style={styles.noFloorplanContainer}>
              <Text style={styles.noFloorplanText}>No floorplan visualization available</Text>
            </View>
          )}
        </View>

        {/* Recommendations Section */}
        <View style={styles.recommendationsContainer}>
          <Text style={styles.recommendationsTitle}>Recommendations</Text>

          {/* Grid of plant cards */}
          <View style={styles.plantsGrid}>
            {recommendations.map((plant, index) => {
              if (index % 2 === 0) {
                // Render pairs of cards
                return (
                  <View key={`row-${index}`} style={styles.plantsRow}>
                    {renderPlantCard(plant)}
                    {recommendations[index + 1] && renderPlantCard(recommendations[index + 1])}
                  </View>
                );
              }
              return null;
            })}
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 96,
    paddingBottom: 40,
    gap: 40,
  },
  backButton: {
    position: 'absolute',
    top: 54,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 40,
    backgroundColor: '#FCF7F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    gap: 12,
  },
  roomNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomName: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
    color: '#000000',
  },
  editNameContainer: {
    width: '80%',
  },
  roomNameInput: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
    color: '#000000',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#349552',
    paddingVertical: 4,
  },
  floorPlanContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 400,
    width: '100%',
  },
  floorPlan: {
    width: 256,
    height: 318,
    position: 'relative',
  },
  room: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: 'transparent',
  },
  doorOpening: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: 'transparent',
  },
  furniture: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#D9D9D9',
  },
  roomLabel: {
    position: 'absolute',
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400',
    color: '#000000',
    transform: [{ translateX: -50 }],
  },
  furnitureLabel: {
    position: 'absolute',
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400',
    color: '#000000',
    transform: [{ translateX: -50 }],
  },
  recommendationsContainer: {
    gap: 24,
  },
  recommendationsTitle: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
    color: '#000000',
  },
  plantsGrid: {
    gap: 24,
  },
  plantsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  plantCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FCF7F4',
  },
  plantImageContainer: {
    aspectRatio: 1,
    position: 'relative',
  },
  plantImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  plantGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  difficultyBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
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
  plantOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plantName: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
    color: '#FCF7F4',
  },
  plantLocation: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#FCF7F4',
    marginTop: 2,
  },
  plantDetails: {
    backgroundColor: '#FCF7F4',
    padding: 10,
    gap: 4,
  },
  plantDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plantDetailText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
    color: '#000000',
  },
  iconLarge: {
    fontSize: 32,
    fontWeight: '600',
    color: '#191919',
  },
  iconMedium: {
    fontSize: 24,
    color: '#191919',
  },
  iconSmall: {
    fontSize: 18,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '400',
    color: '#191919',
  },
  errorText: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '600',
    color: '#EF583D',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#349552',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600',
    color: '#FCF7F4',
  },
  noFloorplanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noFloorplanText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
    textAlign: 'center',
  },
});
