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
export interface ProspectList {
  id: string;
  list_name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  description: string | null;
  original_filename: string | null;
  supabase_storage_path: string | null;
  prospect_count?: number; // Added to support usage in ProspectListTable
}

export interface ProspectListWithCount extends ProspectList {
  prospect_count: number;
  status?: string;
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

// Campaign status enum
export enum CampaignStatus {
  Draft = 'Draft',
  Active = 'Active',
  Paused = 'Paused',
  Completed = 'Completed',
  Failed = 'Failed'
}

export interface Prospect {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
  email?: string | null; // Optional to match component usage
  notes: string | null;
  tags?: string[] | null; // Optional to match component usage
  list_id: string;
  user_id: string;
  status: ProspectStatus | string;
  last_contact_at?: string | null; // Optional to match component usage
  last_call_attempted: string | null;
  property_address: string | null; 
  do_not_call?: boolean; // Optional to match component usage
  do_not_call_reason?: string | null; // Optional to match component usage
}

export interface Campaign {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  status: CampaignStatus | string;
  prospect_list_id: string | null;
  agent_config_id: string | null;
  schedule?: any | null; // Optional to match component usage
  call_count?: number | null; // Optional to match component usage
  call_count_completed?: number | null; // Optional to match component usage
  call_count_scheduled?: number | null; // Optional to match component usage
  description: string | null;
  prospect_list_name?: string;
  calls_made?: number | null;
  agent_config_name?: string;
  scheduled_start?: string | null;
}

// Call Log type from Supabase call_logs table
export interface CallLog {
  id: string;
  user_id: string;
  campaign_id?: string | null; // Optional to match component usage
  prospect_id: string;
  agent_config_id: string;
  status?: string; // Optional to match component usage
  call_status?: string | CallStatus;
  call_sid?: string | null; // Optional to match component usage
  twilio_call_sid?: string;
  direction?: string | null; // Optional to match component usage
  call_duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  extracted_data: Json | null; // Using Json type for better type safety
  summary: string | null;
  cost: number | null;
  started_at: string;
  ended_at: string | null;
  created_at?: string; // Optional to match component usage
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

export interface MainNavItem {
  title: string;
  href: string;
  icon?: JSX.Element; // Changed to JSX.Element to match Sidebar usage
  disabled?: boolean;
}

// Dashboard stats type for analytics
export interface DashboardStats {
  totalProspects: number;
  totalCalls: number;
  completedCalls: number;
  averageCallDuration: number;
  successRate: number;
  callsToday?: number; // Added to match Analytics.tsx usage
  callsThisWeek?: number; // Added to fix build error in Analytics.tsx
  pendingProspects?: number; // Added to fix build error in Analytics.tsx
  completedProspects?: number; // Added to fix build error in Analytics.tsx
}
