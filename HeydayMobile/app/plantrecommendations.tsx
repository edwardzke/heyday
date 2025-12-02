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

// Design tokens from Figma
const colors = {
  background: '#FCF7F4',
  primary: '#349552',
  dark: '#191919',
  white: '#FFFFFF',
  // Difficulty colors
  easy: '#349552',    // Green
  medium: '#FEAE33',  // Orange/Yellow
  hard: '#EF583D',    // Red
};

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 48 - 24) / 2; // 16px padding each side + 24px gap

// Types
interface RecommendationItem {
  id: string;
  plant_name: string;
  image_url: string | null;
  maintenance_category: string | null;
  sunlight: string | null;
  watering: string | null;
  is_favorite: boolean;
}

// Get difficulty color based on maintenance_category
function getDifficultyColor(category: string | null): string {
  const normalized = (category || '').toLowerCase().trim();
  
  if (normalized === 'low' || normalized === 'easy') {
    return colors.easy;
  }
  if (normalized === 'high' || normalized === 'hard') {
    return colors.hard;
  }
  // Default to medium for anything else
  return colors.medium;
}

// Get difficulty label based on maintenance_category
function getDifficultyLabel(category: string | null): string {
  const normalized = (category || '').toLowerCase().trim();
  
  if (normalized === 'low' || normalized === 'easy') {
    return 'Easy';
  }
  if (normalized === 'high' || normalized === 'hard') {
    return 'Hard';
  }
  // Default to Medium
  return 'Medium';
}

// Recommendation Card Component
function RecommendationCard({
  item,
  onPress,
  onFavoritePress,
}: {
  item: RecommendationItem;
  onPress: () => void;
  onFavoritePress: () => void;
}) {
  const difficultyColor = getDifficultyColor(item.maintenance_category);
  const difficultyLabel = getDifficultyLabel(item.maintenance_category);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Image Section */}
      <View style={styles.cardImageContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} />
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
        
        {/* Plant Name & Favorite */}
        <View style={styles.cardOverlayContent}>
          <Text style={styles.cardPlantName}>{item.plant_name}</Text>
          <TouchableOpacity onPress={onFavoritePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons
              name={item.is_favorite ? 'heart' : 'heart-outline'}
              size={24}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Info Section */}
      <View style={styles.cardInfoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="sunny-outline" size={18} color={colors.dark} />
          <Text style={styles.infoText}>{item.sunlight || 'Average'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="water-outline" size={18} color="#35B0FE" />
          <Text style={styles.infoText}>{item.watering || 'Average'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Main Recommendations Screen
export default function PlantRecommendationsScreen() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch recommendations from Supabase
  const fetchRecommendations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Query plant_recommendations joined with plants table
      const { data, error } = await supabase
        .from('plant_recommendations')
        .select(`
          id,
          recommended_location,
          status,
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

      const formattedRecs: RecommendationItem[] = (data || []).map((rec: any) => ({
        id: rec.id,
        plant_name: rec.plants?.common_name || rec.recommended_location?.plant_name || 'Unknown Plant',
        image_url: rec.plants?.default_image_url || null,
        maintenance_category: rec.plants?.maintenance_category || 'medium',
        sunlight: rec.plants?.sunlight || rec.recommended_location?.sunlight || 'Average',
        watering: rec.plants?.watering_general_benchmark || rec.recommended_location?.watering || 'Average',
        is_favorite: false, // Could be stored separately if needed
      }));

      setRecommendations(formattedRecs);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Handle card press (could navigate to detail)
  const handleCardPress = (item: RecommendationItem) => {
    // TODO: Navigate to plant detail or accept/dismiss flow
    console.log('Card pressed:', item.plant_name);
  };

  // Handle favorite toggle
  const handleFavoritePress = (itemId: string) => {
    setRecommendations(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, is_favorite: !item.is_favorite } : item
      )
    );
  };

  // Render cards in pairs (2 columns)
  const renderRows = () => {
    const rows = [];
    for (let i = 0; i < recommendations.length; i += 2) {
      const pair = recommendations.slice(i, i + 2);
      rows.push(
        <View key={i} style={styles.row}>
          {pair.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              onPress={() => handleCardPress(item)}
              onFavoritePress={() => handleFavoritePress(item.id)}
            />
          ))}
          {/* Add empty space if odd number */}
          {pair.length === 1 && <View style={{ width: cardWidth }} />}
        </View>
      );
    }
    return rows;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recommendations</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>Loading recommendations...</Text>
          </View>
        ) : recommendations.length > 0 ? (
          renderRows()
        ) : (
          <View style={styles.centerContainer}>
            <Ionicons name="leaf-outline" size={48} color={colors.primary} />
            <Text style={styles.emptyText}>No recommendations yet</Text>
            <Text style={styles.emptySubtext}>
              Scan a room to get personalized plant recommendations!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    color: colors.dark,
    lineHeight: 28,
  },
  headerSpacer: {
    width: 40,
  },
  
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 24,
  },
  
  // Grid
  row: {
    flexDirection: 'row',
    gap: 24,
  },
  
  // Card
  card: {
    width: cardWidth,
    borderWidth: 1,
    borderColor: colors.dark,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: 'transparent',
    // Simulating gradient with opacity
    // In production, use expo-linear-gradient
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
    color: colors.white,
    lineHeight: 16,
  },
  cardOverlayContent: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPlantName: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 28,
    flex: 1,
  },
  
  // Card Info Section
  cardInfoSection: {
    backgroundColor: colors.background,
    padding: 10,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '400',
    color: colors.dark,
    lineHeight: 16,
  },
  
  // States
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.dark,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.dark,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.dark + '80',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

