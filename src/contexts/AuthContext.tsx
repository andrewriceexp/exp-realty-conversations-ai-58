
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { Session, User } from '@supabase/supabase-js';

// Define the authentication context type
export interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  updateUser: (data: any) => Promise<any>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  updateProfile: (data: any) => Promise<any>;
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
  refreshProfile: async () => {},
  resetPassword: async () => {},
  updateProfile: async () => ({}),
});

// Helper function to clean up auth state before operations
const cleanupAuthState = () => {
  console.log('[Auth] Cleaning up auth state');
  // Remove standard auth tokens
  localStorage.removeItem('supabase.auth.token');
  
  // Remove all Supabase auth keys from localStorage 
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      console.log(`[Auth] Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      console.log(`[Auth] Removing sessionStorage key: ${key}`);
      sessionStorage.removeItem(key);
    }
  });
};

// Authentication provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Debug function for logging auth state changes
  const logAuthState = (event: string, details?: any) => {
    console.log(`[Auth Debug] ${event}`, details || '');
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    const setupAuth = async () => {
      setIsLoading(true);
      logAuthState('Setting up auth...');
      
      try {
        // First, set up the auth state change listener
        const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          logAuthState('Auth state changed:', { event, session: !!newSession });
          
          // Update session and user state immediately
          setSession(newSession);
          setUser(newSession?.user || null);
          
          switch(event) {
            case 'SIGNED_IN':
              if (newSession?.user) {
                // Defer profile fetching to prevent deadlocks
                setTimeout(async () => {
                  try {
                    logAuthState('Fetching profile after sign in');
                    await fetchProfileData(newSession.user.id);
                  } catch (err) {
                    logAuthState('Error fetching profile after sign in', err);
                  }
                }, 0);
              }
              break;
              
            case 'SIGNED_OUT':
              setProfile(null);
              break;
              
            case 'TOKEN_REFRESHED':
              logAuthState('Token refreshed');
              break;
              
            case 'USER_UPDATED':
              logAuthState('User updated');
              break;
          }
        });
        
        subscription = data.subscription;
        
        // Then check for an existing session
        logAuthState('Checking for existing session');
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        logAuthState('Initial session check complete', { hasSession: !!initialSession });
        setSession(initialSession);
        setUser(initialSession?.user || null);
        
        if (initialSession?.user) {
          // Fetch initial profile data
          logAuthState('Fetching initial profile');
          await fetchProfileData(initialSession.user.id);
        }
        
        setAuthInitialized(true);
      } catch (err) {
        logAuthState('Error during auth setup', err);
        console.error("Auth setup error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    setupAuth();
    
    // Cleanup function
    return () => {
      if (subscription) {
        logAuthState('Unsubscribing from auth events');
        subscription.unsubscribe();
      }
    };
  }, []);
  
  // Reusable function to fetch profile data
  const fetchProfileData = async (userId: string) => {
    try {
      logAuthState('Fetching profile data for user', userId);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        logAuthState('Error fetching profile:', profileError);
        console.error('Error fetching user profile:', profileError);
        return null;
      }
      
      logAuthState('Profile fetched successfully', profileData);
      setProfile(profileData as unknown as UserProfile);
      return profileData;
    } catch (err) {
      logAuthState('Exception in fetchProfileData', err);
      console.error('Exception fetching profile:', err);
      return null;
    }
  };

  // Function to refresh the user profile
  const refreshProfile = async () => {
    setLoading(true);
    try {
      if (user) {
        logAuthState('Manually refreshing profile');
        await fetchProfileData(user.id);
      }
    } catch (error) {
      logAuthState('Error refreshing profile', error);
      console.error('Error refreshing user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sign in function with better error handling and auth cleanup
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    logAuthState('Signing in', { email });
    
    try {
      // Clean up existing auth state
      cleanupAuthState();
      
      // Attempt global sign out first to ensure clean state
      try {
        await supabase.auth.signOut({ scope: 'global' });
        logAuthState('Pre-signin signout complete');
      } catch (err) {
        // Continue even if this fails
        logAuthState('Pre-signin signout failed (non-critical)', err);
      }
      
      // Sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        logAuthState('Sign in failed', error);
        setError(error.message);
        return { error };
      }
      
      logAuthState('Sign in successful', { userId: data?.user?.id });
      
      // Force refresh auth state and profile data
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        
        // Fetch user profile
        await fetchProfileData(data.user.id);
      }
      
      return data;
    } catch (error: any) {
      logAuthState('Exception during sign in', error);
      console.error('Error signing in:', error);
      setError(error.message || 'An error occurred while signing in');
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Sign out function with improved cleanup
  const signOut = async () => {
    setLoading(true);
    logAuthState('Signing out');
    
    try {
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        logAuthState('Sign out error', error);
        throw error;
      }
      
      logAuthState('Sign out successful');
      
      // Clear all state
      setProfile(null);
      setUser(null);
      setSession(null);
    } catch (error: any) {
      logAuthState('Exception during sign out', error);
      console.error('Error signing out:', error);
      setError(error.message || 'An error occurred while signing out');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign up function with better error handling
  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    setError(null);
    logAuthState('Signing up', { email });
    
    try {
      // Clean up existing auth state
      cleanupAuthState();
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      
      if (error) {
        logAuthState('Sign up failed', error);
        setError(error.message);
        return { error };
      }
      
      logAuthState('Sign up successful');
      return data;
    } catch (error: any) {
      logAuthState('Exception during sign up', error);
      console.error('Error signing up:', error);
      setError(error.message || 'An error occurred while signing up');
      return { error };
    } finally {
      setLoading(false);
    }
  };
  
  // Reset password function
  const resetPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    logAuthState('Requesting password reset', { email });
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        logAuthState('Password reset request failed', error);
        setError(error.message);
        throw error;
      }
      
      logAuthState('Password reset email sent');
    } catch (error: any) {
      logAuthState('Exception during password reset request', error);
      console.error('Error resetting password:', error);
      setError(error.message || 'An error occurred while resetting password');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update user function (profile data)
  const updateUser = async (data: any) => {
    setLoading(true);
    logAuthState('Updating user profile');
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user?.id)
        .select()
        .single();

      if (profileError) {
        logAuthState('Profile update failed', profileError);
        console.error('Error updating user:', profileError);
        throw profileError;
      }

      logAuthState('Profile updated successfully');
      // Update the local profile state
      // Type assertion to UserProfile
      setProfile(profileData as unknown as UserProfile);
      return profileData;
    } catch (error: any) {
      logAuthState('Exception during profile update', error);
      console.error('Error updating user:', error);
      setError(error.message || 'An error occurred while updating user');
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Alias for updateUser to match function name used elsewhere
  const updateProfile = updateUser;

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
        refreshProfile,
        resetPassword,
        updateProfile,
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
