
// Import the Json type from the database types
import { Json } from './integrations/supabase/types';

// Profile type from Supabase profiles table
export interface Profile {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  elevenlabs_api_key?: string;
  elevenlabs_api_key_last_validated?: string;
  elevenlabs_voice_id?: string;
  openai_api_key?: string;
  openai_api_key_last_validated?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  twilio_verified?: boolean;
  twilio_verified_at?: string;
  settings?: Record<string, any>;
}

export interface ProspectListWithCount {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  status: string;
  prospect_count: number;
}

export interface Prospect {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  notes: string | null;
  tags: string[] | null;
  list_id: string;
  user_id: string;
  status: string;
  last_contact_at: string | null;
  do_not_call: boolean;
  do_not_call_reason: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  status: string;
  list_id: string;
  agent_config_id: string | null;
  schedule: any | null;
  call_count: number;
  call_count_completed: number;
  call_count_scheduled: number;
}

// Call Log type from Supabase call_logs table
export interface CallLog {
  id: string;
  user_id: string;
  campaign_id: string | null;
  prospect_id: string;
  agent_config_id: string | null;
  status: string;
  call_sid: string | null;
  direction: string | null;
  call_duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  extracted_data: Json | null; // Using Json type for better type safety
  summary: string | null;
  cost: number | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  user_id: string;
  prompts: Record<string, any> | null;
  goal_extraction_prompt: string | null;
  created_at: string;
  updated_at: string;
  elevenlabs_voice_id: string | null;
  elevenlabs_agent_id: string | null;
  elevenlabs_model_id: string | null;
}
