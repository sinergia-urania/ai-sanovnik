// File: src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Read from app config extra to avoid committing secrets
const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};
const SUPABASE_URL = extra?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = extra?.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabaseClient] Missing SUPABASE_URL / SUPABASE_ANON_KEY in app config extra.');
}

// TODO: configure auth storage (optional) for RN if needed
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
