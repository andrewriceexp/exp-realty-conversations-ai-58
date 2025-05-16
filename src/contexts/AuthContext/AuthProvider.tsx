
import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, authChannel } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AuthContext } from './useAuthContext';
import { UserProfile } from './types';
import { cleanupAuthState } from '@/utils/authUtils';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false); // For login/signup operations
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [initComplete, setInitComplete] = useState(false);

  // Function to fetch profile safely with retry capability
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    console.log(`Fetching user profile for ID: ${userId}`);
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
            console.warn(`Failed to fetch profile after ${maxRetries + 1} attempts`);
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
  }, []);

  // Setup cross-tab synchronization
  useEffect(() => {
    if (!authChannel) return;
    
    const handleAuthEvent = async (event: MessageEvent) => {
      console.log('Received auth event from channel:', event.data?.type);
      
      if (event.data?.type === 'AUTH_STATE_CHANGE') {
        console.log('Auth state changed in another tab, refreshing session');
        
        // Refresh the session from storage with a small delay to allow storage to update
        setTimeout(async () => {
          try {
            const { data } = await supabase.auth.getSession();
            const currentSession = data.session;
            
            console.log('Got refreshed session:', currentSession ? 'Valid' : 'None');
            
            setSession(currentSession);
            setUser(currentSession?.user || null);
            
            if (currentSession?.user) {
              fetchProfile(currentSession.user.id).then(profileData => {
                setProfile(profileData);
              });
            } else {
              setProfile(null);
            }
          } catch (err) {
            console.error('Error refreshing session after cross-tab event:', err);
          }
        }, 150);
      } else if (event.data?.type === 'SIGNED_OUT') {
        // Handle signed out event from another tab
        console.log('User signed out in another tab');
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    };
    
    authChannel.addEventListener('message', handleAuthEvent);
    
    return () => {
      authChannel.removeEventListener('message', handleAuthEvent);
    };
  }, [fetchProfile]);

  // Cleanup function for setting a loading timeout
  const setupLoadingTimeout = useCallback(() => {
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
    }

    // Set a timeout to clear loading state if it takes too long
    const timeout = setTimeout(() => {
      console.warn("Loading timeout reached - forcing loading state to complete");
      setIsLoading(false);
    }, 5000); // 5 seconds timeout as a fallback

    setLoadingTimeout(timeout);
  }, [loadingTimeout]);

  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      if (initComplete) return; // Prevent duplicate initialization
      
      setIsLoading(true);
      setupLoadingTimeout();

      try {
        console.log("Fetching auth session...");
        
        // Set up the auth state change listener before getting the session
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log("Auth state changed:", event);
            
            // Broadcast the change to other tabs
            if (authChannel) {
              authChannel.postMessage({
                type: 'AUTH_STATE_CHANGE',
                event,
                time: Date.now()
              });
            }
            
            // Update session state synchronously
            setSession(newSession);
            setUser(newSession?.user || null);

            if (event === 'SIGNED_OUT') {
              setProfile(null);
              return;
            }
            
            if (event === 'SIGNED_IN') {
              // Show a toast on successful sign in
              toast({
                title: "Signed in successfully",
                description: "Welcome back!",
                duration: 3000
              });
            }
            
            // Fetch profile if we have a user, but use setTimeout to avoid deadlocks
            if (newSession?.user) {
              setTimeout(async () => {
                try {
                  const profileData = await fetchProfile(newSession.user!.id);
                  setProfile(profileData);
                } catch (err) {
                  console.error("Error fetching profile on auth state change:", err);
                }
              }, 0);
            } else {
              setProfile(null);
            }
          }
        );

        // Now get the current session
        const { data: userSession } = await supabase.auth.getSession();
        console.log("Session fetched:", userSession.session ? "Valid session" : "No session");

        // Update session state
        setSession(userSession.session);
        setUser(userSession.session?.user || null);

        // If we have a session, fetch the profile
        if (userSession.session?.user) {
          const profileData = await fetchProfile(userSession.session.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }

        // Mark initialization as complete
        setInitComplete(true);
        
        // Clean up on component unmount
        return () => {
          subscription?.unsubscribe();
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
          }
        };
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
  }, [initComplete, loadingTimeout, setupLoadingTimeout, fetchProfile]);

  // Function to refresh the user profile
  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  // Auth methods implementation - moved to a separate hook file
  // But importing here for convenience
  const { signIn, signOut, signUp, updateUser, updateProfile, resetPassword } = useAuthMethods({
    user,
    setUser,
    setSession,
    setProfile,
    setError,
    setLoading,
    fetchProfile
  });

  // Create the context value
  const contextValue = {
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
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Helper types for auth methods hook
interface UseAuthMethodsProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  fetchProfile: (userId: string) => Promise<UserProfile | null>;
}

// This is imported from the separate hook file
const useAuthMethods = ({
  user,
  setUser,
  setSession,
  setProfile,
  setError,
  setLoading,
  fetchProfile
}: UseAuthMethodsProps) => {
  // Sign in function with improved error handling and cleanup
  const signIn = useCallback(async (email: string, password: string) => {
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
        console.error("Sign in error:", error);
        return { error };
      }
      
      // Successfully signed in - store session and user immediately
      if (data?.session) {
        setSession(data.session);
      }
      
      if (data?.user) {
        setUser(data.user);
        console.log("Sign-in successful, user ID:", data.user.id);
        
        // Fetch profile after a small delay to avoid deadlocks
        setTimeout(async () => {
          try {
            const profileData = await fetchProfile(data.user!.id);
            setProfile(profileData);
          } catch (err) {
            console.error("Error fetching profile after sign in:", err);
          }
        }, 0);
      }
      
      return data;
    } catch (error: any) {
      console.error('Error signing in:', error);
      setError(error.message);
      return { error };
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, setError, setLoading, setProfile, setSession, setUser]);

  // Sign out function with improved cleanup
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      console.log("Signing out user...");
      
      // First update state to prevent UI flashes
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Force full cleanup with aggressive token removal
      cleanupAuthState(true);
      
      // Attempt global sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error("Error during sign out:", error);
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      
      // Show toast notification
      toast({
        title: "Signed out successfully",
        description: "You have been signed out",
        duration: 3000,
      });
      
      // Broadcast to other tabs
      if (authChannel) {
        authChannel.postMessage({
          type: 'SIGNED_OUT',
          time: Date.now()
        });
      }
      
      // Don't do a full page reload - React Router will handle navigation
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setProfile, setSession, setUser]);

  // Sign up function
  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
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
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      
      // Store initial user data
      if (data?.user) {
        setUser(data.user);
      }
      
      if (data?.session) {
        setSession(data.session);
      }
      
      // Show toast notification
      toast({
        title: "Sign up successful",
        description: "Your account has been created",
        duration: 3000,
      });
      
      return data;
    } catch (error: any) {
      console.error('Error signing up:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, setSession, setUser]);

  // Update user function (profile data)
  const updateUser = useCallback(async (data: any) => {
    setLoading(true);
    try {
      if (!user?.id) {
        throw new Error('User is not authenticated');
      }
      
      console.log("Updating user profile:", data);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id)
        .select()
        .single();

      if (profileError) {
        console.error('Error updating user:', profileError);
        toast({
          title: "Update failed",
          description: profileError.message,
          variant: "destructive",
        });
        throw profileError;
      }

      // Update the local profile state
      console.log("Profile updated successfully");
      setProfile(profileData as UserProfile);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
        duration: 3000,
      });
      
      return profileData;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setProfile]);
  
  // Alias for updateUser to support ProfileSetup component
  const updateProfile = updateUser;
  
  // Reset password function
  const resetPassword = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setError(error.message);
        toast({
          title: "Password reset failed",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      
      toast({
        title: "Password reset email sent",
        description: "Check your email for the password reset link",
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  return {
    signIn,
    signOut,
    signUp,
    updateUser,
    updateProfile,
    resetPassword
  };
};
