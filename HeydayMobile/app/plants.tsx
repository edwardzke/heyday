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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

// Design tokens
const colors = {
  background: '#FCF7F4',
  primary: '#349552',
  dark: '#191919',
  white: '#FFFFFF',
  grey: '#B9B6B4',
  border: 'rgba(25, 25, 25, 0.5)',
  // Difficulty colors
  easy: '#349552',
  medium: '#FEAE33',
  hard: '#EF583D',
};

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 48 - 16) / 2; // padding + gap

// Types
type TabName = 'Home' | 'Plants';

interface UserPlant {
  id: string;
  nickname: string | null;
  location: string;
  image_url: string | null;
  maintenance_category: string | null;
  sunlight: string | null;
  watering: string | null;
}

interface RecommendationPlant {
  id: string;
  plant_name: string;
  image_url: string | null;
  maintenance_category: string | null;
  sunlight: string | null;
  watering: string | null;
  recommended_location: string | null;
}

type TabType = 'myplants' | 'recommendations';

// Utility functions
function getDifficultyColor(category: string | null): string {
  const normalized = (category || '').toLowerCase().trim();
  if (normalized === 'low' || normalized === 'easy') return colors.easy;
  if (normalized === 'high' || normalized === 'hard') return colors.hard;
  return colors.medium;
}

function getDifficultyLabel(category: string | null): string {
  const normalized = (category || '').toLowerCase().trim();
  if (normalized === 'low' || normalized === 'easy') return 'Easy';
  if (normalized === 'high' || normalized === 'hard') return 'Hard';
  return 'Medium';
}

// Bottom Navigation Component
function BottomNav({ activeTab, onTabPress }: { activeTab: TabName; onTabPress: (tab: TabName) => void }) {
  const tabs: { name: TabName; icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap }[] = [
    { name: 'Home', icon: 'home', iconOutline: 'home-outline' },
    { name: 'Plants', icon: 'leaf', iconOutline: 'leaf-outline' },
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.navTab}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.icon : tab.iconOutline}
              size={24}
              color={isActive ? colors.primary : colors.dark}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Plant Card Component
function PlantCard({
  plant,
  onPress,
  type,
}: {
  plant: UserPlant | RecommendationPlant;
  onPress: () => void;
  type: 'my' | 'recommendation';
}) {
  const difficultyColor = getDifficultyColor(plant.maintenance_category);
  const difficultyLabel = getDifficultyLabel(plant.maintenance_category);
  const plantName = type === 'my' ? (plant as UserPlant).nickname || 'Unnamed Plant' : (plant as RecommendationPlant).plant_name;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Image Section */}
      <View style={styles.cardImageContainer}>
        {plant.image_url ? (
          <Image source={{ uri: plant.image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Ionicons name="leaf" size={40} color={colors.primary} />
          </View>
        )}
        
        {/* Gradient Overlay */}
        <View style={styles.cardGradient} />
        
        {/* Difficulty Badge */}
        <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor }]}>
          <Text style={styles.difficultyText}>{difficultyLabel}</Text>
        </View>
        
        {/* Plant Name */}
        <View style={styles.cardOverlayContent}>
          <Text style={styles.cardPlantName} numberOfLines={2}>{plantName}</Text>
        </View>
      </View>
      
      {/* Info Section */}
      <View style={styles.cardInfoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="sunny-outline" size={16} color={colors.dark} />
          <Text style={styles.infoText} numberOfLines={1}>{plant.sunlight || 'Average'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="water-outline" size={16} color="#35B0FE" />
          <Text style={styles.infoText} numberOfLines={1}>{plant.watering || 'Average'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Main Plants Screen
export default function PlantsScreen() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [activeTab, setActiveTab] = useState<TabType>('myplants');
  const [activeNavTab, setActiveNavTab] = useState<TabName>('Plants');
  const [myPlants, setMyPlants] = useState<UserPlant[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationPlant[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle bottom nav tab press
  const handleNavTabPress = (tab: TabName) => {
    setActiveNavTab(tab);
    
    switch (tab) {
      case 'Home':
        router.push('/dashboard');
        break;
      case 'Plants':
        // Already on plants screen
        break;
    }
  };

  // Fetch user's plants
  const fetchMyPlants = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_plants')
        .select(`
          id,
          nickname,
          location_meta,
          photos,
          plants (
            default_image_url,
            common_name,
            maintenance_category,
            sunlight,
            watering_general_benchmark
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: UserPlant[] = (data || []).map((plant: any) => ({
        id: plant.id,
        nickname: plant.nickname || plant.plants?.common_name || 'Unnamed Plant',
        location: plant.location_meta?.room || plant.location_meta?.label || 'Unknown',
        image_url: plant.photos?.[0]?.image_url || plant.plants?.default_image_url || null,
        maintenance_category: plant.plants?.maintenance_category || 'medium',
        sunlight: plant.plants?.sunlight || 'Average',
        watering: plant.plants?.watering_general_benchmark || 'Average',
      }));

      setMyPlants(formatted);
    } catch (error) {
      console.error('Error fetching plants:', error);
    }
  }, [user]);

  // Fetch plant recommendations
  const fetchRecommendations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('plant_recommendations')
        .select(`
          id,
          recommended_location,
          plants (
            id,
            common_name,
            default_image_url,
            maintenance_category,
            sunlight,
            watering_general_benchmark
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: RecommendationPlant[] = (data || []).map((rec: any) => ({
        id: rec.id,
        plant_name: rec.plants?.common_name || 'Unknown Plant',
        image_url: rec.plants?.default_image_url || null,
        maintenance_category: rec.plants?.maintenance_category || 'medium',
        sunlight: rec.plants?.sunlight || 'Average',
        watering: rec.plants?.watering_general_benchmark || 'Average',
        recommended_location: rec.recommended_location?.room || null,
      }));

      setRecommendations(formatted);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMyPlants(), fetchRecommendations()]);
      setLoading(false);
    };
    loadData();
  }, [fetchMyPlants, fetchRecommendations]);

  const handlePlantPress = (plantId: string) => {
    if (activeTab === 'myplants') {
      router.push({
        pathname: '/plantinfo',
        params: { plantId },
      });
    } else {
      router.push({
        pathname: '/plantrecommendation',
        params: { recommendationId: plantId },
      });
    }
  };

  const currentPlants = activeTab === 'myplants' ? myPlants : recommendations;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plants</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myplants' && styles.tabActive]}
          onPress={() => setActiveTab('myplants')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'myplants' && styles.tabTextActive]}>
            My Plants
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recommendations' && styles.tabActive]}
          onPress={() => setActiveTab('recommendations')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}>
            Recommendations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerContent}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : currentPlants.length === 0 ? (
          <View style={styles.centerContent}>
            <Ionicons name="leaf-outline" size={64} color={colors.grey} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'myplants' ? 'No plants yet' : 'No recommendations yet'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'myplants'
                ? 'Add your first plant to get started!'
                : 'Scan your space to get plant recommendations'}
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {currentPlants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                onPress={() => handlePlantPress(plant.id)}
                type={activeTab === 'myplants' ? 'my' : 'recommendation'}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeNavTab} onTabPress={handleNavTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.dark,
    lineHeight: 42,
  },
  
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.dark,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.dark,
  },
  tabTextActive: {
    color: colors.white,
  },
  
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  
  // Plant Card
  card: {
    width: cardWidth,
    borderRadius: 16,
    backgroundColor: colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.dark,
  },
  cardImageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    backgroundColor: colors.grey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  difficultyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  cardOverlayContent: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  cardPlantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 20,
  },
  cardInfoSection: {
    padding: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: colors.dark,
    flex: 1,
  },
  
  // Empty State
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.dark,
  },
  emptyText: {
    fontSize: 14,
    color: colors.grey,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: colors.grey,
  },
  
  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 0,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navLabel: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400',
    color: colors.dark,
    lineHeight: 18,
  },
  navLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },
});
