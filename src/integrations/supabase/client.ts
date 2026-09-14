import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Works with our own VITE_* variables and with the names the Vercel ↔ Supabase
// integration creates (NEXT_PUBLIC_*). Only public values: never the service role key.
const env = import.meta.env;

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_PUBLISHABLE_KEY: string =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(
  // Placeholders keep the app from crashing at startup; main.tsx shows a setup message instead.
  SUPABASE_URL || 'https://not-configured.invalid',
  SUPABASE_PUBLISHABLE_KEY || 'not-configured',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
