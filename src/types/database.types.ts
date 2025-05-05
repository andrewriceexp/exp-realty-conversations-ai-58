
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          exp_realty_id: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_phone_number: string | null
          a2p_10dlc_registered: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          exp_realty_id?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          a2p_10dlc_registered?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          exp_realty_id?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          a2p_10dlc_registered?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      agent_configs: {
        Row: {
          id: string
          user_id: string
          config_name: string
          system_prompt: string
          goal_extraction_prompt: string
          voice_provider: string
          voice_id: string
          llm_provider: string
          llm_model: string
          temperature: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          config_name?: string
          system_prompt: string
          goal_extraction_prompt: string
          voice_provider?: string
          voice_id: string
          llm_provider?: string
          llm_model?: string
          temperature?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          config_name?: string
          system_prompt?: string
          goal_extraction_prompt?: string
          voice_provider?: string
          voice_id?: string
          llm_provider?: string
          llm_model?: string
          temperature?: number
          created_at?: string
          updated_at?: string
        }
      }
      prospect_lists: {
        Row: {
          id: string
          user_id: string
          list_name: string
          description: string | null
          original_filename: string | null
          supabase_storage_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          list_name: string
          description?: string | null
          original_filename?: string | null
          supabase_storage_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          list_name?: string
          description?: string | null
          original_filename?: string | null
          supabase_storage_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      prospects: {
        Row: {
          id: string
          list_id: string
          user_id: string
          phone_number: string
          first_name: string | null
          last_name: string | null
          property_address: string | null
          notes: string | null
          status: string
          last_call_attempted: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          list_id: string
          user_id: string
          phone_number: string
          first_name?: string | null
          last_name?: string | null
          property_address?: string | null
          notes?: string | null
          status?: string
          last_call_attempted?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          user_id?: string
          phone_number?: string
          first_name?: string | null
          last_name?: string | null
          property_address?: string | null
          notes?: string | null
          status?: string
          last_call_attempted?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      call_logs: {
        Row: {
          id: string
          prospect_id: string
          user_id: string
          agent_config_id: string
          twilio_call_sid: string
          call_status: string
          call_duration_seconds: number | null
          recording_url: string | null
          transcript: string | null
          extracted_data: Json | null
          summary: string | null
          cost: number | null
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          prospect_id: string
          user_id: string
          agent_config_id: string
          twilio_call_sid: string
          call_status: string
          call_duration_seconds?: number | null
          recording_url?: string | null
          transcript?: string | null
          extracted_data?: Json | null
          summary?: string | null
          cost?: number | null
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          prospect_id?: string
          user_id?: string
          agent_config_id?: string
          twilio_call_sid?: string
          call_status?: string
          call_duration_seconds?: number | null
          recording_url?: string | null
          transcript?: string | null
          extracted_data?: Json | null
          summary?: string | null
          cost?: number | null
          started_at?: string
          ended_at?: string | null
        }
      }
    }
  }
}
