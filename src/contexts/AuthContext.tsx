
import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { supabase, authChannel } from '@/integrations/supabase/client';
import { UserProfile, AuthContextType } from '@/types/auth-types';

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

// Custom hook to use the auth context - we're defining it directly in the AuthContext.tsx
// but exporting it for backwards compatibility
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
  const [initComplete, setInitComplete] = useState(false);
  const MAX_RETRIES = 3;

  // Function to fetch profile safely with retry capability
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
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
  };

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
  }, [initComplete]);

  // Function to refresh the user profile
  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Sign in function with improved error handling and cleanup
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
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign out function with improved cleanup
  const signOut = async () => {
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
        throw error;
      }
      
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
      
      // Store initial user data
      if (data?.user) {
        setUser(data.user);
      }
      
      if (data?.session) {
        setSession(data.session);
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

// Export the context and types
export { AuthContext };
// Export the UserProfile type for backward compatibility
export type { UserProfile };
