import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: In Expo, use process.env or a library such as expo-constants to load variables.
// In dev, allow safe placeholder values so the app can run without configured env vars.
// For production, ensure real SUPABASE_URL and SUPABASE_ANON_KEY are provided.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'anon-placeholder';

console.log('Supabase Configuration:');
console.log('URL:', SUPABASE_URL);
console.log('Key:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : 'not set');

if (SUPABASE_URL === 'https://example.supabase.co' || SUPABASE_ANON_KEY === 'anon-placeholder') {
  console.warn('⚠️ Supabase is using placeholder values. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
