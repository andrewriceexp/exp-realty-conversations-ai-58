
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, authChannel } from '@/integrations/supabase/client';

// Improved clean up auth tokens function to prevent authentication limbo states
export const cleanupAuthState = (forceFullCleanup = false) => {
  // Only perform aggressive cleanup when forced (on logout or explicit cleanup)
  if (forceFullCleanup) {
    // Log the cleanup for debugging
    console.log('Performing full auth state cleanup');
    
    // Remove all Supabase auth keys from localStorage - directly
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Clean sessionStorage as well if used
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } else {
    // For non-forced cleanups, just do a sanity check without removing valid tokens
    const authKeyCount = Object.keys(localStorage).filter(key => 
      key.startsWith('supabase.auth.') || key.includes('sb-')
    ).length;
    
    if (authKeyCount > 3) {
      console.warn(`Found ${authKeyCount} auth keys - possible token conflict`);
    }
  }
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
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Handle cross-tab authentication events
  useEffect(() => {
    if (!authChannel) return;
    
    const handleAuthEvent = (event: MessageEvent) => {
      if (event.data?.type === 'AUTH_STATE_CHANGE') {
        console.log('Received auth state change from another tab, refreshing session');
        // Refresh the session from storage
        supabase.auth.getSession().then(({ data }) => {
          const currentSession = data.session;
          setSession(currentSession);
          setUser(currentSession?.user || null);
          
          if (currentSession?.user) {
            // Fetch profile for the user
            fetchProfile(currentSession.user.id).then(profileData => {
              setProfile(profileData);
            });
          } else {
            setProfile(null);
          }
        });
      }
    };
    
    authChannel.addEventListener('message', handleAuthEvent);
    
    return () => {
      authChannel.removeEventListener('message', handleAuthEvent);
    };
  }, []);

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

  // Function to fetch profile safely with retry capability
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    let retries = 0;
    const maxRetries = 2; // Try up to 3 times (initial + 2 retries)
    
    while (retries <= maxRetries) {
      try {
        console.log(`Fetching user profile for ID: ${userId} (attempt ${retries + 1})`);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error(`Error fetching user profile (attempt ${retries + 1}):`, profileError);
          retries++;
          
          if (retries <= maxRetries) {
            // Exponential backoff
            const delay = 200 * Math.pow(2, retries);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            return null;
          }
        } else {
          console.log("Profile data retrieved:", profileData ? "Found" : "Not found");
          return profileData as UserProfile;
        }
      } catch (error) {
        console.error(`Error in fetchProfile (attempt ${retries + 1}):`, error);
        retries++;
        
        if (retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, retries)));
        } else {
          return null;
        }
      }
    }
    
    return null;
  };

  useEffect(() => {
    // Function to get and set session and profile
    const initializeSession = async () => {
      setIsLoading(true);
      setupLoadingTimeout();

      try {
        console.log("Fetching auth session...");
        const { data: userSession } = await supabase.auth.getSession();
        console.log("Session fetched:", userSession.session ? "Valid session" : "No session");

        // Only update session if component is still mounted
        setSession(userSession.session);
        setUser(userSession.session?.user || null);

        // If we have a session, fetch the profile
        if (userSession.session?.user) {
          const profileData = await fetchProfile(userSession.session.user.id);
          if (profileData) {
            setProfile(profileData);
          } else {
            console.warn("Could not fetch profile data for authenticated user");
          }
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

    // Initialize session
    initializeSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event);
        
        // Broadcast the change to other tabs
        if (authChannel) {
          authChannel.postMessage({
            type: 'AUTH_STATE_CHANGE',
            event,
            time: Date.now()
          });
        }
        
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
      // Clean up existing state - but do not perform aggressive cleanup on login
      cleanupAuthState(false);
      
      console.log("Signing in user...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        setError(error.message);
        throw error;
      }
      
      // Successfully signed in - fetch profile with retries
      if (data?.user) {
        // We'll let the onAuthStateChange handler fetch the profile
        console.log("Sign-in successful, user ID:", data.user.id);
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
      // Force full cleanup with aggressive token removal
      cleanupAuthState(true);
      
      // Attempt global sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      
      setProfile(null);
      setUser(null);
      setSession(null);
      
      // Broadcast to other tabs
      if (authChannel) {
        authChannel.postMessage({
          type: 'SIGNED_OUT',
          time: Date.now()
        });
      }
      
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
      cleanupAuthState(false);
      
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
