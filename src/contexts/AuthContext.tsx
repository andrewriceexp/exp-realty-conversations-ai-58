
import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  exp_realty_id?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  a2p_10dlc_registered?: boolean;
  elevenlabs_api_key?: string | null;
  elevenlabs_api_key_last_validated?: string;
  elevenlabs_voice_id?: string;
  elevenlabs_phone_number_id?: string;
  elevenlabs_phone_number_verified?: boolean;
  elevenlabs_phone_number_verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ProfileData | null;
  isLoading: boolean;
  loading: boolean; // Alias for isLoading for backward compatibility
  error: string | null;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signOut: () => Promise<any>;
  refreshProfile: () => Promise<ProfileData | null>;
  resetPassword: (email: string) => Promise<any>;
  updateProfile: (data: Partial<ProfileData>) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      // Get current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession?.user) {
        setUser(currentSession.user);
        await fetchProfile(currentSession.user.id);
      }
      
      // Set up auth state change listener
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.info('Auth state change event:', event);
        
        if (newSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          console.info('User signed in:', newSession.user.id);
          setUser(newSession.user);
          setSession(newSession);
          await fetchProfile(newSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      });
      
      setIsLoading(false);
      return () => {
        authListener.subscription.unsubscribe();
      };
    };
    
    initializeAuth();
  }, []);
  
  const fetchProfile = async (userId: string) => {
    console.info('Fetching profile for user:', userId);
    try {
      // Get profile from database
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      console.info('Profile fetched:', data);
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };
  
  const refreshProfile = async () => {
    if (user) {
      return await fetchProfile(user.id);
    }
    return null;
  };
  
  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      return data;
    } catch (error: any) {
      setError(error.message || 'Error signing in');
      throw error;
    }
  };
  
  const signUp = async (email: string, password: string, fullName: string) => {
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            email_verified: true, // This is just for development
          },
        },
      });
      
      if (error) throw error;
      
      return data;
    } catch (error: any) {
      setError(error.message || 'Error signing up');
      throw error;
    }
  };
  
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error: any) {
      setError(error.message || 'Error resetting password');
      throw error;
    }
  };

  const updateProfile = async (data: Partial<ProfileData>) => {
    setError(null);
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Refresh profile data after update
      await refreshProfile();
      
      return { success: true };
    } catch (error: any) {
      setError(error.message || 'Error updating profile');
      throw error;
    }
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        session, // Ensure session is exposed in the context
        profile,
        isLoading,
        loading: isLoading, // Alias for backward compatibility
        error,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
