import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izcwdxwuewathjlslfir.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Y3dkeHd1ZXdhdGhqbHNsZmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzE2OTMsImV4cCI6MjA5MDkwNzY5M30.raUmehEoonBoKLILfRHJRg4UzMF46OQCr_ESPjarf-I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};