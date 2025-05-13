
import { createClient } from '@supabase/supabase-js';

// Import from the integrations client which has all the right configurations
import { supabase as supabaseClient } from '@/integrations/supabase/client';

// Re-export the configured client
export const supabase = supabaseClient;

// Create a convenience function for edge functions to create Supabase clients
export const createSupabaseClient = (url: string, key: string) => {
  return createClient(url, key);
};
