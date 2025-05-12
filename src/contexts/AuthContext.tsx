
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Profile } from "@/types";

type AuthContextType = {
  user: any;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, full_name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<Profile>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  secureSessionCheck: () => boolean;
  clearAuthState: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Clean up auth state completely (useful for logout or auth issues)
  const clearAuthState = () => {
    // Remove Supabase items from storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Also clear from sessionStorage if it might be used
    Object.keys(sessionStorage || {}).forEach(key => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
    
    // Reset state
    setUser(null);
    setProfile(null);
    setError(null);
  };

  // Security check for session validity
  const secureSessionCheck = () => {
    if (!user) return false;
    
    // Check if session is expired
    const tokenData = localStorage.getItem('supabase.auth.token');
    if (!tokenData) return false;
    
    try {
      const { expiresAt } = JSON.parse(tokenData);
      const now = Math.floor(Date.now() / 1000);
      return expiresAt > now;
    } catch (err) {
      console.error('Error checking token expiry:', err);
      return false;
    }
  };

  useEffect(() => {
    // First set up the auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change event:', event);
        setUser(session?.user ?? null);
        
        // Log authentication events securely
        if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user?.id);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setProfile(null);
        }
        
        // Don't fetch profile here to avoid recursion risk
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      console.log("Fetching profile for user:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      console.log("Profile fetched:", data);
      setProfile(data);
    } catch (err) {
      console.error("Error in profile fetch:", err);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Clean up any existing auth state before signing in
      // This helps prevent "auth limbo" states
      clearAuthState();
      
      // Try a global signout first to clear any existing sessions
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (e) {
        // Continue even if this fails
        console.log('Global sign out before sign-in failed:', e);
      }
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
        
        // Log failed sign-in attempt (for security monitoring)
        console.warn('Failed sign-in attempt:', { email, timestamp: new Date().toISOString() });
      } else {
        // Log successful sign-in (for security monitoring)
        console.log('Successful sign-in:', { email, timestamp: new Date().toISOString() });
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Sign In Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, full_name: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear existing auth state
      clearAuthState();
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
          },
        },
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registration Successful",
          description: "Please check your email to verify your account.",
        });
        
        // Log successful registration (for security monitoring)
        console.log('New user registration:', { email, timestamp: new Date().toISOString() });
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Sign Up Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // First log the sign-out event (for security monitoring)
      console.log('User sign-out:', { userId: user?.id, timestamp: new Date().toISOString() });
      
      // Clean up all auth state
      clearAuthState();
      
      // Then trigger the actual sign-out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Force page reload for a clean state
      // Uncomment if you want to ensure clean state after logout
      // window.location.href = '/login';
    } catch (err: any) {
      toast({
        title: "Sign Out Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Add resetPassword function implementation
  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Password Reset Failed",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      
      // Log password reset request (for security monitoring)
      console.log('Password reset requested:', { email, timestamp: new Date().toISOString() });
      
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for a password reset link",
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData: Partial<Profile>) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update your profile",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      console.log("Updating profile with data:", { 
        ...profileData, 
        id: user.id,
        twilio_auth_token: profileData.twilio_auth_token ? '****' : undefined 
      });
      
      // Log profile update (for security monitoring)
      console.log('Profile update:', { userId: user.id, timestamp: new Date().toISOString() });
      
      // Create a clean update object
      const updateObj = { ...profileData, id: user.id };
      
      // If twilio_auth_token is empty string, don't update it
      if (updateObj.twilio_auth_token === '') {
        delete updateObj.twilio_auth_token;
      }
      
      const { error } = await supabase
        .from("profiles")
        .update(updateObj)
        .eq("id", user.id);

      if (error) {
        console.error("Profile update error:", error);
        toast({
          title: "Profile Update Failed",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      // Refresh the profile to get the updated data
      await fetchProfile(user.id);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated",
      });
    } catch (err) {
      console.error("Profile update error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        updateProfile,
        resetPassword,
        secureSessionCheck,
        clearAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
