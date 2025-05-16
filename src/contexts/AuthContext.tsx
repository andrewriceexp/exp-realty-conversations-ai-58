
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

// Define the authentication context type
export interface AuthContextType {
  session: any | null;
  user: any | null;
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

// Authentication provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true);
      try {
        const { data: userSession } = await supabase.auth.getSession();

        setSession(userSession.session);
        setUser(userSession.session?.user || null);

        if (userSession.session?.user) {
          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userSession.session.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
          } else {
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
        setSession(userSession);
        setUser(userSession?.user || null);

        if (userSession?.user) {
          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userSession.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
          } else {
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
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error refreshing user profile:', profileError);
        } else {
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
      setError(error.message || 'An error occurred while signing in');
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
    } catch (error: any) {
      console.error('Error signing out:', error);
      setError(error.message || 'An error occurred while signing out');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign up function
  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    setError(null);
    try {
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
        setError(error.message);
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('Error signing up:', error);
      setError(error.message || 'An error occurred while signing up');
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Reset password function
  const resetPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        setError(error.message);
        throw error;
      }
    } catch (error: any) {
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
    try {
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
      setProfile(profileData as UserProfile);
      return profileData;
    } catch (error: any) {
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
