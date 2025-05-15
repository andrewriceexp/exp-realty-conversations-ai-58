
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

// Export ProspectList type that matches the database structure
export type ProspectList = {
  id: string;
  name: string;
  list_name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  description: string | null;
  original_filename: string | null;
  supabase_storage_path: string | null;
};

export interface ProspectListWithCount {
  id: string;
  name: string;
  list_name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  status: string;
  prospect_count: number;
}

// Enums for status types
export enum ProspectStatus {
  Pending = 'Pending',
  Calling = 'Calling',
  Completed = 'Completed',
  Failed = 'Failed',
  DoNotCall = 'Do Not Call'
}

export enum CallStatus {
  Initiated = 'initiated',
  Ringing = 'ringing',
  InProgress = 'in-progress',
  Completed = 'completed',
  Busy = 'busy',
  Failed = 'failed',
  NoAnswer = 'no-answer',
  Canceled = 'canceled'
}

export interface Prospect {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
  email: string | null;
  notes: string | null;
  tags: string[] | null;
  list_id: string;
  user_id: string;
  status: ProspectStatus | string;
  last_contact_at: string | null;
  last_call_attempted: string | null;
  property_address: string | null; 
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
  prospect_list_id: string | null;
  agent_config_id: string | null;
  schedule: any | null;
  call_count: number | null;
  call_count_completed: number | null;
  call_count_scheduled: number | null;
  description: string | null;
  prospect_list_name?: string;
  calls_made?: number | null;
}

// Call Log type from Supabase call_logs table
export interface CallLog {
  id: string;
  user_id: string;
  campaign_id: string | null;
  prospect_id: string;
  agent_config_id: string;
  status: string;
  call_status?: string | CallStatus;
  call_sid: string | null;
  twilio_call_sid?: string;
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
  config_name?: string;
  agent_configs?: {
    config_name: string;
  };
}

// Modified AgentConfig to match the database structure
export interface AgentConfig {
  id: string;
  user_id: string;
  config_name: string; // Changed from name to config_name
  system_prompt: string; // Added to match database
  goal_extraction_prompt: string | null;
  created_at: string;
  updated_at: string;
  voice_id: string; // Added to match database
  llm_provider: string; // Added to match database
  llm_model: string; // Added to match database
  temperature: number; // Added to match database
  voice_provider: string; // Added to match database
  prompts?: Record<string, any> | null;
  elevenlabs_voice_id?: string | null;
  elevenlabs_agent_id?: string | null;
  elevenlabs_model_id?: string | null;
}

export type MainNavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};
