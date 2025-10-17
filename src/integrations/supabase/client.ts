import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_SUPABASE_URL = 'https://diclwatocrixibjpajuf.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpY2x3YXRvY3JpeGlianBhanVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDIyNjEsImV4cCI6MjA3MDIxODI2MX0.414UJ0ghcBsQ6jbOd7TkjQivvOkBVX-G5qpYuO_oYNs';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const SUPABASE_URL = (envSupabaseUrl && envSupabaseUrl.replace(/\/$/, ''))
  || FALLBACK_SUPABASE_URL.replace(/\/$/, '');

export const SUPABASE_ANON_KEY = envSupabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: localStorage,
    autoRefreshToken: true,
  },
});
