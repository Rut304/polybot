
import { createClient } from '@supabase/supabase-js';

// Lazy load to prevent build-time crashes if env vars are missing
export const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prioritize SERVICE_ROLE key, fallback to SERVICE_KEY, then ANON key (which works for reads usually)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials missing in environment.');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
};
