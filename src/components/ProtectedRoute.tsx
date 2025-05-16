
import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectPath?: string;
}

const ProtectedRoute = ({ children, redirectPath = '/login' }: ProtectedRouteProps) => {
  const { user, session, isLoading, error } = useAuth();
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  const [readyToRender, setReadyToRender] = useState(false);

  // Debug logging for authentication state
  useEffect(() => {
    console.log("[ProtectedRoute] Auth state updated:", {
      hasUser: !!user,
      hasSession: !!session,
      isLoading,
      path: location.pathname,
      retryCount,
      readyToRender
    });
  }, [user, session, isLoading, location.pathname, retryCount, readyToRender]);

  // Try to recover the session if needed with exponential backoff
  useEffect(() => {
    if (!isLoading && !user && !session && !isInitialLoad && retryCount < 3) {
      // If we don't have a user after the initial load, try to recover the session
      const attemptRecovery = async () => {
        console.log(`[ProtectedRoute] Attempting to recover session (attempt ${retryCount + 1})`);
        try {
          // Let's refresh the page state before attempting a retry
          setRetryCount(prev => prev + 1);
          
          // If we've tried too many times, show an error
          if (retryCount >= 2) {
            console.error("[ProtectedRoute] Failed to recover session after multiple attempts");
            toast({
              variant: "destructive",
              title: "Authentication Error",
              description: "Your session has expired. Please log in again."
            });
            // Ready to render the redirect to login
            setReadyToRender(true);
          }
        } catch (err) {
          console.error("[ProtectedRoute] Recovery error:", err);
          setReadyToRender(true);
        }
      };
      
      // Exponential backoff for recovery attempts
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 3000);
      console.log(`[ProtectedRoute] Setting recovery timeout for ${backoffTime}ms`);
      
      const timer = setTimeout(attemptRecovery, backoffTime);
      return () => clearTimeout(timer);
    } else if (!isLoading && (user || retryCount >= 3)) {
      // We have a user or have exhausted retries, ready to render final state
      setReadyToRender(true);
    }
  }, [isLoading, user, session, isInitialLoad, retryCount, toast]);
  
  // Add a small initial loading delay to prevent flashing content
  useEffect(() => {
    console.log("[ProtectedRoute] Setting up initial load timer");
    
    const timer = setTimeout(() => {
      console.log("[ProtectedRoute] Initial load timer completed");
      setIsInitialLoad(false);
      
      // If we already have user/session at this point, we're ready to render
      if (user && session) {
        console.log("[ProtectedRoute] User and session already available, ready to render");
        setReadyToRender(true);
      }
    }, 300); // Slightly longer delay to ensure auth state is stabilized
    
    return () => clearTimeout(timer);
  }, [user, session]);

  // Check session validity
  const isSessionValid = !!session && !!user && !!session.access_token && 
                         new Date(session.expires_at * 1000) > new Date();

  // Log session validity
  useEffect(() => {
    if (session) {
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      console.log("[ProtectedRoute] Session validity:", { 
        isValid: isSessionValid,
        expiresAt: expiresAt.toISOString(),
        now: now.toISOString(),
        timeRemaining: (expiresAt.getTime() - now.getTime()) / 1000 / 60 + " minutes"
      });
    }
  }, [session, isSessionValid]);

  if (isInitialLoad || isLoading || !readyToRender) {
    console.log("[ProtectedRoute] Still in loading state");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse-light text-exp-blue">
          {retryCount > 0 ? "Verifying authentication..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (!user || !session || !isSessionValid) {
    console.log("[ProtectedRoute] Not authenticated or invalid session, redirecting to login", {
      hasUser: !!user,
      hasSession: !!session,
      isSessionValid,
      retryCount
    });
    
    // Redirect to login with a return URL
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  console.log("[ProtectedRoute] Authentication confirmed, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
