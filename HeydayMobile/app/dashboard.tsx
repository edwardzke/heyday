import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
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
  grey: '#B9B6B4',
  white: '#FFFFFF',
  border: 'rgba(25, 25, 25, 0.5)',
};

// Types
interface PlantItem {
  id: string;
  nickname: string | null;
  location: string;
  image_url: string | null;
}

// Bottom Tab Navigation Component
type TabName = 'Home' | 'Schedule' | 'Plants' | 'Profile';

function BottomNav({ activeTab, onTabPress }: { activeTab: TabName; onTabPress: (tab: TabName) => void }) {
  const tabs: { name: TabName; icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap }[] = [
    { name: 'Home', icon: 'home', iconOutline: 'home-outline' },
    { name: 'Schedule', icon: 'calendar', iconOutline: 'calendar-outline' },
    { name: 'Plants', icon: 'leaf', iconOutline: 'leaf-outline' },
    { name: 'Profile', icon: 'person-circle', iconOutline: 'person-circle-outline' },
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

// Check Button Component
function CheckButton({ 
  checked, 
  onPress 
}: { 
  checked: boolean; 
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.checkButton, checked && styles.checkButtonChecked]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {checked && (
        <Ionicons name="checkmark" size={24} color={colors.white} />
      )}
    </TouchableOpacity>
  );
}

// Note Taking Button Component
function NoteTakingButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.noteButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name="create-outline" size={24} color={colors.dark} />
    </TouchableOpacity>
  );
}

// Plant Row Component
function PlantRow({
  plant,
  showCheckbox,
  checked,
  onCheck,
  onNote,
}: {
  plant: PlantItem;
  showCheckbox?: boolean;
  checked?: boolean;
  onCheck?: () => void;
  onNote?: () => void;
}) {
  return (
    <View style={styles.plantRow}>
      <View style={styles.plantInfo}>
        <View style={styles.plantImageContainer}>
          {plant.image_url ? (
            <Image source={{ uri: plant.image_url }} style={styles.plantImage} />
          ) : (
            <View style={[styles.plantImage, styles.plantImagePlaceholder]}>
              <Ionicons name="leaf" size={24} color={colors.grey} />
            </View>
          )}
        </View>
        <View style={styles.plantTextContainer}>
          <Text style={styles.plantName}>{plant.nickname || 'Unnamed Plant'}</Text>
          <Text style={styles.plantLocation}>{plant.location}</Text>
        </View>
      </View>
      {showCheckbox && onCheck && (
        <CheckButton checked={checked || false} onPress={onCheck} />
      )}
      {!showCheckbox && onNote && (
        <NoteTakingButton onPress={onNote} />
      )}
    </View>
  );
}

// Main Dashboard Component
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [allPlants, setAllPlants] = useState<PlantItem[]>([]);
  const [checkedPlants, setCheckedPlants] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [weather, setWeather] = useState({ temp: '68°F', location: 'Los Angeles' });
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 17) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  // Fetch plants from Supabase
  const fetchPlants = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_plants')
        .select(`
          id,
          nickname,
          location_meta,
          plants (
            default_image_url,
            common_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedPlants: PlantItem[] = (data || []).map((plant: any) => ({
        id: plant.id,
        nickname: plant.nickname || plant.plants?.common_name || 'Unnamed Plant',
        location: plant.location_meta?.room || 'Unknown location',
        image_url: plant.plants?.default_image_url || null,
      }));

      setAllPlants(formattedPlants);
    } catch (error) {
      console.error('Error fetching plants:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  // Handle checking off a plant (simple toggle, no database update)
  const handleCheckPlant = (plantId: string) => {
    const newChecked = new Set(checkedPlants);
    
    if (newChecked.has(plantId)) {
      newChecked.delete(plantId);
    } else {
      newChecked.add(plantId);
    }
    
    setCheckedPlants(newChecked);
  };

  // Handle adding a note
  const handleAddNote = (plantId: string, plantName: string) => {
    router.push({
      pathname: '/notes',
      params: { plantId, plantName },
    });
  };

  // Handle tab navigation
  const handleTabPress = (tab: TabName) => {
    setActiveTab(tab);
    
    switch (tab) {
      case 'Plants':
        // Could navigate to a plants list screen
        break;
      case 'Profile':
        // Could navigate to profile
        break;
      case 'Schedule':
        // Could navigate to schedule
        break;
    }
  };

  // Get display plants (limit to 4 for each section)
  const displayPlants = allPlants.slice(0, 4);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.weatherRow}>
            <Ionicons name="sunny" size={18} color={colors.dark} />
            <Text style={styles.weatherText}>
              <Text style={styles.weatherTemp}>{weather.temp}/</Text>
              <Text style={styles.weatherLocation}>{weather.location}</Text>
            </Text>
          </View>
        </View>

        {/* Water Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Water</Text>
            <TouchableOpacity onPress={() => Alert.alert('See all', 'View all plants')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.plantList}>
            {loading ? (
              <Text style={styles.loadingText}>Loading plants...</Text>
            ) : displayPlants.length > 0 ? (
              displayPlants.map((plant) => (
                <PlantRow
                  key={plant.id}
                  plant={plant}
                  showCheckbox
                  checked={checkedPlants.has(plant.id)}
                  onCheck={() => handleCheckPlant(plant.id)}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No plants yet. Add your first plant!</Text>
            )}
          </View>
        </View>

        {/* Progress Update Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Progress Update</Text>
            <TouchableOpacity onPress={() => Alert.alert('See all', 'View all plant progress')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.plantList}>
            {loading ? (
              <Text style={styles.loadingText}>Loading plants...</Text>
            ) : displayPlants.length > 0 ? (
              displayPlants.map((plant) => (
                <PlantRow
                  key={plant.id}
                  plant={plant}
                  onNote={() => handleAddNote(plant.id, plant.nickname || 'Plant')}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No plants yet. Add your first plant!</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Camera Menu Options (shown when expanded) */}
      {cameraMenuOpen && (
        <View style={styles.cameraMenuContainer}>
          {/* Scan Space Option */}
          <TouchableOpacity
            style={styles.cameraMenuOption}
            onPress={() => {
              setCameraMenuOpen(false);
              // TODO: Navigate to room scan flow
              router.push('/roomscan');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="cube-outline" size={24} color={colors.dark} />
            <Text style={styles.cameraMenuText}>Scan space</Text>
          </TouchableOpacity>

          {/* Identify Plant Option */}
          <TouchableOpacity
            style={styles.cameraMenuOption}
            onPress={() => {
              setCameraMenuOpen(false);
              // Navigate to camera page for plant identification
              router.push('/camerapage');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="search-outline" size={24} color={colors.dark} />
            <Text style={styles.cameraMenuText}>Identify plant</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Camera FAB */}
      <TouchableOpacity
        style={styles.cameraFab}
        onPress={() => setCameraMenuOpen(!cameraMenuOpen)}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 40,
  },
  
  // Header
  header: {
    gap: 12,
  },
  greeting: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    color: colors.dark,
    lineHeight: 42,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    fontSize: 16,
    lineHeight: 20,
  },
  weatherTemp: {
    fontWeight: '500',
    color: colors.dark,
  },
  weatherLocation: {
    fontWeight: '400',
    color: colors.dark,
  },
  
  // Cards
  card: {
    borderWidth: 1,
    borderColor: colors.dark,
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    color: colors.dark,
    lineHeight: 28,
  },
  seeAll: {
    fontSize: 12,
    color: colors.dark,
    textDecorationLine: 'underline',
    lineHeight: 16,
  },
  
  // Plant List
  plantList: {
    gap: 12,
  },
  plantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  plantImageContainer: {
    width: 56,
    height: 56,
  },
  plantImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  plantImagePlaceholder: {
    backgroundColor: colors.grey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantTextContainer: {
    flex: 1,
  },
  plantName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: colors.dark,
    lineHeight: 20,
  },
  plantLocation: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400',
    color: colors.dark,
    lineHeight: 16,
  },
  
  // Buttons
  checkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  noteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Camera FAB & Menu
  cameraMenuContainer: {
    position: 'absolute',
    right: 16,
    bottom: 172,
    alignItems: 'flex-end',
    gap: 8,
  },
  cameraMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.dark,
    borderRadius: 40,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cameraMenuText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: colors.dark,
    lineHeight: 20,
  },
  cameraFab: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
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
  
  // States
  loadingText: {
    fontSize: 14,
    color: colors.grey,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.grey,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
