import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

/*
 * ============================================
 * SUPABASE STORAGE INSTRUCTIONS
 * ============================================
 * 
 * To store these preferences in Supabase, you would:
 * 
 * 1. Create a 'user_preferences' table in Supabase:
 * 
 *    CREATE TABLE user_preferences (
 *      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *      okay_with_poisonous BOOLEAN DEFAULT false,
 *      location_latitude DECIMAL,
 *      location_longitude DECIMAL,
 *      location_address TEXT,
 *      plant_preference TEXT CHECK (plant_preference IN ('functional', 'aesthetic', 'both')),
 *      has_children BOOLEAN DEFAULT false,
 *      has_pets BOOLEAN DEFAULT false,
 *      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 *    );
 * 
 * 2. Add RLS policies:
 * 
 *    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
 *    
 *    CREATE POLICY "Users can view own preferences" ON user_preferences
 *      FOR SELECT USING (auth.uid() = user_id);
 *    
 *    CREATE POLICY "Users can insert own preferences" ON user_preferences
 *      FOR INSERT WITH CHECK (auth.uid() = user_id);
 *    
 *    CREATE POLICY "Users can update own preferences" ON user_preferences
 *      FOR UPDATE USING (auth.uid() = user_id);
 * 
 * 3. To save preferences from the app:
 * 
 *    import { supabase } from '../lib/supabase';
 *    
 *    const savePreferences = async (preferences: {
 *      okayWithPoisonous: boolean;
 *      location: { latitude: number; longitude: number; address?: string } | null;
 *      plantPreference: 'functional' | 'aesthetic' | 'both';
 *      hasChildren: boolean;
 *      hasPets: boolean;
 *    }) => {
 *      const { data: user } = await supabase.auth.getUser();
 *      if (!user.user) return;
 *      
 *      const { error } = await supabase
 *        .from('user_preferences')
 *        .upsert({
 *          user_id: user.user.id,
 *          okay_with_poisonous: preferences.okayWithPoisonous,
 *          location_latitude: preferences.location?.latitude,
 *          location_longitude: preferences.location?.longitude,
 *          location_address: preferences.location?.address,
 *          plant_preference: preferences.plantPreference,
 *          has_children: preferences.hasChildren,
 *          has_pets: preferences.hasPets,
 *        });
 *      
 *      if (error) throw error;
 *    };
 * 
 * ============================================
 */

type PlantPreference = 'functional' | 'aesthetic' | 'both' | null;

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const OptionButton = ({ label, selected, onPress }: OptionButtonProps) => (
  <TouchableOpacity
    style={[styles.optionButton, selected && styles.optionButtonSelected]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function OnboardingScreen() {
  const router = useRouter();
  
  const [okayWithPoisonous, setOkayWithPoisonous] = useState<boolean | null>(null);
  const [plantPreference, setPlantPreference] = useState<PlantPreference>(null);
  const [hasChildren, setHasChildren] = useState<boolean | null>(null);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [locationFetching, setLocationFetching] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const handleLocationRequest = async () => {
    setLocationFetching(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'We need your location to provide plant recommendations suited to your climate.',
          [{ text: 'OK' }]
        );
        setLocationFetching(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      
      let address: string | undefined;
      try {
        const [addressResult] = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        
        if (addressResult) {
          address = [
            addressResult.city,
            addressResult.region,
          ].filter(Boolean).join(', ');
        }
      } catch (e) {
        console.log('Could not get address:', e);
      }

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        address,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your location. Please try again.');
    } finally {
      setLocationFetching(false);
    }
  };

  const handleContinue = () => {
    router.replace('/dashboard');
  };

  const handleSkip = () => {
    router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../assets/images/Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Let's personalize</Text>
        </View>

        {/* Questions */}
        <View style={styles.questionsContainer}>
          {/* Question 1: Poisonous Plants */}
          <View style={styles.questionGroup}>
            <Text style={styles.questionLabel}>
              Are you okay with poisonous plants?
            </Text>
            <View style={styles.optionsRow}>
              <OptionButton
                label="Yes"
                selected={okayWithPoisonous === true}
                onPress={() => setOkayWithPoisonous(true)}
              />
              <OptionButton
                label="No"
                selected={okayWithPoisonous === false}
                onPress={() => setOkayWithPoisonous(false)}
              />
            </View>
          </View>

          {/* Question 2: Location */}
          <View style={styles.questionGroup}>
            <Text style={styles.questionLabel}>Where do you live?</Text>
            <TouchableOpacity
              style={[
                styles.locationButton,
                location && styles.locationButtonSuccess,
              ]}
              onPress={handleLocationRequest}
              disabled={locationFetching}
            >
              {locationFetching ? (
                <ActivityIndicator size="small" color="#349552" />
              ) : (
                <Text style={[styles.locationButtonText, location && styles.locationButtonTextSuccess]}>
                  {location ? location.address || 'Location saved' : 'Share my location'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Question 3: Functional vs Aesthetic */}
          <View style={styles.questionGroup}>
            <Text style={styles.questionLabel}>What type of plants?</Text>
            <View style={styles.optionsColumn}>
              <OptionButton
                label="Functional (herbs, vegetables)"
                selected={plantPreference === 'functional'}
                onPress={() => setPlantPreference('functional')}
              />
              <OptionButton
                label="Aesthetic (decorative)"
                selected={plantPreference === 'aesthetic'}
                onPress={() => setPlantPreference('aesthetic')}
              />
              <OptionButton
                label="Both"
                selected={plantPreference === 'both'}
                onPress={() => setPlantPreference('both')}
              />
            </View>
          </View>

          {/* Question 4: Children/Pets */}
          <View style={styles.questionGroup}>
            <Text style={styles.questionLabel}>
              Plants in reach of children or pets?
            </Text>
            <View style={styles.optionsColumn}>
              <OptionButton
                label="I have children"
                selected={hasChildren === true}
                onPress={() => setHasChildren(hasChildren === true ? null : true)}
              />
              <OptionButton
                label="I have pets"
                selected={hasPets === true}
                onPress={() => setHasPets(hasPets === true ? null : true)}
              />
              <OptionButton
                label="Neither"
                selected={hasChildren === false && hasPets === false}
                onPress={() => {
                  setHasChildren(false);
                  setHasPets(false);
                }}
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            accessibilityRole="button"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            accessibilityRole="button"
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF7F4',
  },
  scrollContent: {
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    gap: 20,
    marginBottom: 40,
  },
  logo: {
    width: 48,
    height: 41,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#191919',
    textAlign: 'center',
    lineHeight: 40,
  },
  questionsContainer: {
    gap: 32,
  },
  questionGroup: {
    gap: 12,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#191919',
    lineHeight: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionsColumn: {
    gap: 10,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#191919',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#349552',
    borderColor: '#349552',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#191919',
    lineHeight: 20,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#FCF7F4',
  },
  locationButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#191919',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonSuccess: {
    backgroundColor: '#349552',
    borderColor: '#349552',
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#191919',
    lineHeight: 20,
  },
  locationButtonTextSuccess: {
    color: '#FCF7F4',
  },
  actionContainer: {
    marginTop: 48,
    alignItems: 'center',
    gap: 20,
  },
  continueButton: {
    width: 200,
    backgroundColor: '#349552',
    borderRadius: 48,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FCF7F4',
    lineHeight: 20,
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#B9B6B4',
    lineHeight: 20,
  },
});
