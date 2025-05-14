
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
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ProfileData | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signOut: () => Promise<any>;
  refreshProfile: () => Promise<ProfileData | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      throw error;
    }
  };
  
  const signUp = async (email: string, password: string, fullName: string) => {
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
    } catch (error) {
      throw error;
    }
  };
  
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
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
