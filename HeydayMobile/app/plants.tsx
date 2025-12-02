import React, { useState, useEffect } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

// Icon components (using emoji - replace with icon library)
const HomeIcon = () => <Text style={styles.iconNav}>🏠</Text>;
const ScheduleIcon = () => <Text style={styles.iconNav}>📅</Text>;
const PlantIcon = () => <Text style={styles.iconNav}>🌿</Text>;
const ProfileIcon = () => <Text style={styles.iconNav}>👤</Text>;
const CameraIcon = () => <Text style={styles.iconCamera}>📷</Text>;

interface Plant {
  id: string;
  species: string;
  nickname?: string;
  image_url?: string;
  created_at: string;
}

type TabType = 'myplants' | 'recommendations';

export default function PlantsScreen() {
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('myplants');
  const [myPlants, setMyPlants] = useState<Plant[]>([]);
  const [recommendations, setRecommendations] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPlants();
  }, []);

  const loadPlants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Load user's plants
      const { data: plantsData, error: plantsError } = await supabase
        .from('plants')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (plantsError) throw plantsError;

      setMyPlants(plantsData || []);

      // TODO: Load recommendations from your recommendation engine
      // For now, using empty array
      setRecommendations([]);
    } catch (error) {
      console.error('Error loading plants:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlants();
    setRefreshing(false);
  };

  const handlePlantPress = (plant: Plant) => {
    // Navigate to plant detail screen
    router.push({
      pathname: '/plantdetail',
      params: {
        plantId: plant.id,
        plantName: plant.nickname || plant.species,
      },
    });
  };

  const handleCameraPress = () => {
    router.push('/camerapage');
  };

  const handleNavPress = (screen: string) => {
    if (screen === 'home') {
      router.push('/dashboard');
    } else if (screen === 'schedule') {
      router.push('/notify'); // or schedule screen
    } else if (screen === 'plants') {
      // Already on plants screen
    } else if (screen === 'profile') {
      router.push('/profile'); // Create profile screen if needed
    }
  };

  const renderPlantCard = (plant: Plant) => {
    const displayName = plant.nickname || plant.species;

    return (
      <TouchableOpacity
        key={plant.id}
        style={styles.plantCard}
        onPress={() => handlePlantPress(plant)}
        accessibilityRole="button"
      >
        <View style={styles.plantImageContainer}>
          {plant.image_url ? (
            <Image
              source={{ uri: plant.image_url }}
              style={styles.plantImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.plantImage, styles.plantImagePlaceholder]}>
              <Text style={styles.plantImagePlaceholderText}>🌱</Text>
            </View>
          )}
        </View>
        <Text style={styles.plantName} numberOfLines={2}>
          {displayName}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (activeTab === 'myplants') {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🌿</Text>
          <Text style={styles.emptyStateText}>No plants yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap the camera button to add your first plant
          </Text>
        </View>
      );
    } else {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>💡</Text>
          <Text style={styles.emptyStateText}>No recommendations yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Complete a room scan to get personalized plant recommendations
          </Text>
        </View>
      );
    }
  };

  const currentPlants = activeTab === 'myplants' ? myPlants : recommendations;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'myplants' && styles.tabActive]}
            onPress={() => setActiveTab('myplants')}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, activeTab === 'myplants' && styles.tabTextActive]}>
              My Plants
            </Text>
            {activeTab === 'myplants' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'recommendations' && styles.tabActive]}
            onPress={() => setActiveTab('recommendations')}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}>
              Recommendations
            </Text>
            {activeTab === 'recommendations' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Plants Grid */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#349552" />
            </View>
          ) : currentPlants.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.plantsGrid}>
              {/* Render plants in rows of 3 */}
              {Array.from({ length: Math.ceil(currentPlants.length / 3) }).map((_, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.plantsRow}>
                  {currentPlants.slice(rowIndex * 3, (rowIndex + 1) * 3).map(renderPlantCard)}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Floating Camera Button */}
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={handleCameraPress}
          accessibilityRole="button"
          accessibilityLabel="Open camera"
        >
          <CameraIcon />
        </TouchableOpacity>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavPress('home')}
            accessibilityRole="button"
          >
            <HomeIcon />
            <Text style={styles.navText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavPress('schedule')}
            accessibilityRole="button"
          >
            <ScheduleIcon />
            <Text style={styles.navText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavPress('plants')}
            accessibilityRole="button"
          >
            <PlantIcon />
            <Text style={[styles.navText, styles.navTextActive]}>Plants</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavPress('profile')}
            accessibilityRole="button"
          >
            <ProfileIcon />
            <Text style={styles.navText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FCF7F4',
  },
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FCF7F4',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(25, 25, 25, 0.5)',
    paddingTop: 78,
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
    lineHeight: 20,
    color: '#191919',
    marginBottom: 12,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
    gap: 16,
  },
  emptyStateIcon: {
    fontSize: 64,
  },
  emptyStateText: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '600',
    color: '#191919',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(25, 25, 25, 0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  plantsGrid: {
    gap: 12,
  },
  plantsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  plantCard: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
  },
  plantImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 9999,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  plantImage: {
    width: '100%',
    height: '100%',
  },
  plantImagePlaceholder: {
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImagePlaceholderText: {
    fontSize: 40,
  },
  plantName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: '#000000',
    textAlign: 'center',
    width: '100%',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 110,
    right: 16,
    width: 64,
    height: 64,
    borderRadius: 50,
    backgroundColor: '#349552',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FCF7F4',
    borderTopWidth: 1,
    borderTopColor: 'rgba(25, 25, 25, 0.5)',
    paddingBottom: 34,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  navText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#191919',
  },
  navTextActive: {
    fontWeight: '600',
    color: '#349552',
  },
  iconNav: {
    fontSize: 24,
  },
  iconCamera: {
    fontSize: 32,
    color: '#FCF7F4',
  },
});
