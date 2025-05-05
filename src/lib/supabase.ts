
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Note: The URL and anon key will be automatically provided by Lovable's Supabase integration
// These are just placeholders and will be replaced when the Supabase integration is connected
const supabaseUrl = 'https://example.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
