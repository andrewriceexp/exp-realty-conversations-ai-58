
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// Define the user profile type based on the actual database schema
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  company_name?: string;
  role?: string;
  avatar_url?: string;
  openai_api_key?: string;
  elevenlabs_api_key?: string;
  elevenlabs_phone_number_id?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  created_at: string;
  updated_at: string;
  elevenlabs_phone_number_verified?: boolean;
  elevenlabs_phone_number_verified_at?: string;
  elevenlabs_api_key_last_validated?: string;
  a2p_10dlc_registered?: boolean;
  exp_realty_id?: string;
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

// Create the authentication context
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: false,
  loading: false,
  error: null,
  signIn: async () => ({}),
  signOut: async () => {},
  signUp: async () => ({}),
  updateUser: async () => ({}),
  updateProfile: async () => ({}),
  refreshProfile: async () => {},
  resetPassword: async () => {},
});

// Authentication provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false); // For login/signup operations
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching auth session...");
        const { data: userSession } = await supabase.auth.getSession();
        console.log("Session fetched:", userSession.session ? "Valid session" : "No session");

        setSession(userSession.session);
        setUser(userSession.session?.user || null);

        if (userSession.session?.user) {
          // Fetch user profile data
          console.log("Fetching user profile for ID:", userSession.session.user.id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userSession.session.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
          } else {
            console.log("Profile data retrieved:", profileData ? "Found" : "Not found");
            setProfile(profileData as UserProfile);
          }
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, userSession) => {
        console.log("Auth state changed:", event);
        setSession(userSession);
        setUser(userSession?.user || null);

        if (userSession?.user) {
          // Fetch user profile data
          console.log("Auth change: Fetching profile for ID:", userSession.user.id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userSession.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
          } else {
            console.log("Profile data from auth change:", profileData ? "Found" : "Not found");
            setProfile(profileData as UserProfile);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Function to refresh the user profile
  const refreshProfile = async () => {
    if (user) {
      try {
        console.log("Refreshing profile for user ID:", user.id);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error refreshing user profile:', profileError);
        } else {
          console.log("Profile refreshed:", profileData ? "Found" : "Not found");
          setProfile(profileData as UserProfile);
        }
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    }
  };

  // Sign in function
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log("Signing in user...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        setError(error.message);
        throw error;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error signing in:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign up function
  const signUp = async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log("Signing up new user:", email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      
      if (error) {
        setError(error.message);
        throw error;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error signing up:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update user function (profile data)
  const updateUser = async (data: any) => {
    setLoading(true);
    try {
      console.log("Updating user profile:", data);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user?.id)
        .select()
        .single();

      if (profileError) {
        console.error('Error updating user:', profileError);
        throw profileError;
      }

      // Update the local profile state
      console.log("Profile updated successfully");
      setProfile(profileData as UserProfile);
      return profileData;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Alias for updateUser to support ProfileSetup component
  const updateProfile = updateUser;
  
  // Reset password function
  const resetPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setError(error.message);
        throw error;
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        loading,
        error,
        signIn,
        signOut,
        signUp,
        updateUser,
        updateProfile,
        refreshProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
