// Profile type from Supabase profiles table
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  exp_realty_id: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  a2p_10dlc_registered: boolean;
  elevenlabs_api_key: string | null;
  created_at: string;
  updated_at: string;
}

// Add MainNavItem type that was missing
export interface MainNavItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
}

// Agent Configuration type from Supabase agent_configs table
export interface AgentConfig {
  id: string;
  user_id: string;
  config_name: string;
  system_prompt: string;
  goal_extraction_prompt: string;
  voice_provider: string;
  voice_id: string;
  llm_provider: string;
  llm_model: string;
  temperature: number;
  created_at: string;
  updated_at: string;
}

// Prospect List type from Supabase prospect_lists table
export interface ProspectList {
  id: string;
  user_id: string;
  list_name: string;
  description: string | null;
  original_filename: string | null;
  supabase_storage_path: string | null;
  created_at: string;
  updated_at: string;
  prospect_count?: number; // Added for convenience in UI
}

// Prospect type from Supabase prospects table
export interface Prospect {
  id: string;
  list_id: string;
  user_id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  property_address: string | null;
  notes: string | null;
  status: ProspectStatus;
  last_call_attempted: string | null;
  created_at: string;
  updated_at: string;
}

// Call Log type from Supabase call_logs table
export interface CallLog {
  id: string;
  prospect_id: string;
  user_id: string;
  agent_config_id: string;
  twilio_call_sid: string;
  call_status: CallStatus;
  call_duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  extracted_data: Json | null; // Updated from 'any | null' for better type safety
  summary: string | null;
  cost: number | null;
  started_at: string;
  ended_at: string | null;
  updated_at: string; // Added to match the updated database schema
  
  // Added for UI convenience - populated via joins
  prospect_name?: string;
  prospect_phone?: string;
  config_name?: string;
}

// Campaign type from Supabase campaigns table
export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  prospect_list_id: string;
  agent_config_id: string;
  status: CampaignStatus;
  scheduled_start: string | null;
  created_at: string;
  updated_at: string;
  calls_made?: number | null; // Added to match the new column
  prospect_list_name?: string;
  agent_config_name?: string;
}

// Campaign status type
export type CampaignStatus = 'Draft' | 'Scheduled' | 'Running' | 'Paused' | 'Completed' | 'Cancelled';

// Enums
export type ProspectStatus = 'Pending' | 'Calling' | 'Completed' | 'Failed' | 'Do Not Call';

export type CallStatus = 
  | 'Initiated' 
  | 'Ringing' 
  | 'Answered' 
  | 'Voicemail' 
  | 'No Answer' 
  | 'Failed' 
  | 'Completed';

// Dashboard statistics
export interface DashboardStats {
  totalCalls: number;
  callsToday: number;
  callsThisWeek: number;
  totalProspects: number;
  pendingProspects: number;
  completedProspects: number;
  averageCallDuration: number;
}
