
// Define the user profile type based on the actual database schema
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  exp_realty_id?: string | null;
  twilio_account_sid?: string | null;
  twilio_auth_token?: string | null;
  twilio_phone_number?: string | null;
  a2p_10dlc_registered?: boolean;
  created_at: string;
  updated_at: string;
  elevenlabs_phone_number_verified?: boolean;
  elevenlabs_phone_number_verified_at?: string | null;
  elevenlabs_api_key_last_validated?: string | null;
  elevenlabs_phone_number_id?: string | null;
  elevenlabs_api_key?: string | null;
}

// Define the authentication context type
export interface AuthContextType {
  session: any | null;
  user: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  loading: boolean; 
  error: string | null;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<any>;
  updateUser: (data: any) => Promise<any>;
  updateProfile: (data: any) => Promise<any>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
