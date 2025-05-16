
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// Clean up auth tokens to prevent authentication limbo states
export const cleanupAuthState = () => {
  // Remove standard auth tokens
  localStorage.removeItem('supabase.auth.token');
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};

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
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Cleanup function for setting a loading timeout
  const setupLoadingTimeout = () => {
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
    }

    // Set a timeout to clear loading state if it takes too long
    const timeout = setTimeout(() => {
      console.warn("Loading timeout reached - forcing loading state to complete");
      setIsLoading(false);
    }, 10000); // 10 seconds timeout as a fallback

    setLoadingTimeout(timeout);
  };

  // Function to fetch profile safely
  const fetchProfile = async (userId: string) => {
    try {
      console.log("Fetching user profile for ID:", userId);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return null;
      } else {
        console.log("Profile data retrieved:", profileData ? "Found" : "Not found");
        return profileData as UserProfile;
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true);
      setupLoadingTimeout();

      try {
        console.log("Fetching auth session...");
        const { data: userSession } = await supabase.auth.getSession();
        console.log("Session fetched:", userSession.session ? "Valid session" : "No session");

        setSession(userSession.session);
        setUser(userSession.session?.user || null);

        if (userSession.session?.user) {
          // Fetch user profile data
          const profileData = await fetchProfile(userSession.session.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setIsLoading(false);
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
      }
    };

    fetchSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event);
        
        // Update synchronously first
        setSession(session);
        setUser(session?.user || null);

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          return;
        }
        
        if (session?.user) {
          // Defer fetching profile data to prevent deadlocks
          setTimeout(async () => {
            const profileData = await fetchProfile(session.user!.id);
            setProfile(profileData);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      subscription?.unsubscribe();
    };
  }, []);

  // Function to refresh the user profile
  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Sign in function
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      // Clean up existing state
      cleanupAuthState();
      
      // Attempt global sign out first
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
        console.log("Global sign out failed, continuing:", err);
      }
      
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
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      
      setProfile(null);
      setUser(null);
      setSession(null);
      
      // Force page reload to clear all state
      window.location.href = '/login';
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
      // Clean up existing state
      cleanupAuthState();
      
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
