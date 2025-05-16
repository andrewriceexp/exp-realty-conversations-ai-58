
import { useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, authChannel } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UserProfile } from './types';
import { cleanupAuthState } from '@/utils/authUtils';

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

/**
 * Hook to handle all authentication related methods
 */
export const useAuthMethods = ({
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
