export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_configs: {
        Row: {
          config_name: string
          created_at: string
          goal_extraction_prompt: string
          id: string
          llm_model: string
          llm_provider: string
          system_prompt: string
          temperature: number
          updated_at: string
          user_id: string
          voice_id: string
          voice_provider: string
        }
        Insert: {
          config_name?: string
          created_at?: string
          goal_extraction_prompt: string
          id?: string
          llm_model?: string
          llm_provider?: string
          system_prompt: string
          temperature?: number
          updated_at?: string
          user_id: string
          voice_id: string
          voice_provider?: string
        }
        Update: {
          config_name?: string
          created_at?: string
          goal_extraction_prompt?: string
          id?: string
          llm_model?: string
          llm_provider?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          user_id?: string
          voice_id?: string
          voice_provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          agent_config_id: string
          call_duration_seconds: number | null
          call_status: string
          cost: number | null
          ended_at: string | null
          extracted_data: Json | null
          id: string
          prospect_id: string
          recording_url: string | null
          started_at: string
          summary: string | null
          transcript: string | null
          twilio_call_sid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_config_id: string
          call_duration_seconds?: number | null
          call_status: string
          cost?: number | null
          ended_at?: string | null
          extracted_data?: Json | null
          id?: string
          prospect_id: string
          recording_url?: string | null
          started_at?: string
          summary?: string | null
          transcript?: string | null
          twilio_call_sid: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_config_id?: string
          call_duration_seconds?: number | null
          call_status?: string
          cost?: number | null
          ended_at?: string | null
          extracted_data?: Json | null
          id?: string
          prospect_id?: string
          recording_url?: string | null
          started_at?: string
          summary?: string | null
          transcript?: string | null
          twilio_call_sid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agent_config_id: string | null
          calls_made: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          prospect_list_id: string | null
          scheduled_start: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_config_id?: string | null
          calls_made?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          prospect_list_id?: string | null
          scheduled_start?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_config_id?: string | null
          calls_made?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          prospect_list_id?: string | null
          scheduled_start?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_prospect_list_id_fkey"
            columns: ["prospect_list_id"]
            isOneToOne: false
            referencedRelation: "prospect_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      elevenlabs_agents: {
        Row: {
          agent_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          a2p_10dlc_registered: boolean
          created_at: string
          elevenlabs_api_key: string | null
          email: string
          exp_realty_id: string | null
          full_name: string | null
          id: string
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_phone_number: string | null
          updated_at: string
        }
        Insert: {
          a2p_10dlc_registered?: boolean
          created_at?: string
          elevenlabs_api_key?: string | null
          email: string
          exp_realty_id?: string | null
          full_name?: string | null
          id: string
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
        }
        Update: {
          a2p_10dlc_registered?: boolean
          created_at?: string
          elevenlabs_api_key?: string | null
          email?: string
          exp_realty_id?: string | null
          full_name?: string | null
          id?: string
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prospect_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          list_name: string
          original_filename: string | null
          supabase_storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          list_name: string
          original_filename?: string | null
          supabase_storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          list_name?: string
          original_filename?: string | null
          supabase_storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_call_attempted: string | null
          last_name: string | null
          list_id: string
          notes: string | null
          phone_number: string
          property_address: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_call_attempted?: string | null
          last_name?: string | null
          list_id: string
          notes?: string | null
          phone_number: string
          property_address?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_call_attempted?: string | null
          last_name?: string | null
          list_id?: string
          notes?: string | null
          phone_number?: string
          property_address?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "prospect_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_view: {
        Row: {
          a2p_10dlc_registered: boolean | null
          created_at: string | null
          email: string | null
          exp_realty_id: string | null
          full_name: string | null
          id: string | null
          updated_at: string | null
        }
        Insert: {
          a2p_10dlc_registered?: boolean | null
          created_at?: string | null
          email?: string | null
          exp_realty_id?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Update: {
          a2p_10dlc_registered?: boolean | null
          created_at?: string | null
          email?: string | null
          exp_realty_id?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
