import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// In-memory storage for simulator/development
const InMemoryStorage: { [key: string]: string } = {};

// Simple storage adapter that always uses in-memory storage for development
const ExpoStorageAdapter = {
  getItem: (key: string) => {
    return Promise.resolve(InMemoryStorage[key] || null);
  },
  setItem: (key: string, value: string) => {
    InMemoryStorage[key] = value;
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    delete InMemoryStorage[key];
    return Promise.resolve();
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key');
} 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types for TypeScript (matches supabase-schema-new.sql)

export interface User {
  id: string;
  display_name: string | null;
  device_platform: string;
  device_token: string | null;
  location: string | null;
  plant_experience: 'beginner' | 'intermediate' | 'expert';
  style_preference: string | null;
  toxicity_sensitivity: string | null;
  maintenance_level: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface Plant {
  id: string;
  perenual_id: number | null;
  common_name: string | null;
  scientific_name: string | null;
  description: string | null;
  watering_general_benchmark: string | null;
  watering_interval_days: number | null;
  sunlight: string | null;
  maintenance_category: string | null;
  soil_type: string | null;
  poison_human: boolean | null;
  poison_pets: boolean | null;
  default_image_url: string | null;
  care_notes: string | null;
  created_at: string;
}

export interface Floorplan {
  id: string;
  user_id: string;
  name: string | null;
  roomplan_json: Record<string, any> | null;
  created_at: string;
}

export interface UserPlant {
  id: string;
  user_id: string;
  plant_id: string | null;
  floorplan_id: string;
  nickname: string | null;
  notes: string | null;
  x_coord: number | null;
  y_coord: number | null;
  location_meta: Record<string, any> | null;
  started_at: string | null;
  watering_frequency_days: number | null;
  last_watered_at: string | null;
  next_water_at: string | null;
  photos: Array<{
    image_url: string;
    taken_at: string;
    notes?: string;
  }>;
  created_at: string;
}

export interface PlantRecommendation {
  id: string;
  user_id: string;
  plant_id: string | null;
  floorplan_id: string;
  source: string | null;
  score: number | null;
  reason: string | null;
  recommended_location: Record<string, any> | null;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
  accepted_at: string | null;
  dismissed_at: string | null;
}

// Legacy types (deprecated - kept for backwards compatibility)
export interface Profile {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}
