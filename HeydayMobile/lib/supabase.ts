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

// Database types for TypeScript
export interface Profile {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: string;
  user_id: string;
  species: string;
  nickname: string | null;
  age: string | null;
  watering_schedule: number;
  notes: string | null;
  image_url: string | null;
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
