
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
      readyToRender,
      sessionExpiration: session ? new Date(session.expires_at * 1000).toISOString() : 'no session'
    });
  }, [user, session, isLoading, location.pathname, retryCount, readyToRender]);

  // Initial load and session validation
  useEffect(() => {
    if (!isLoading) {
      console.log("[ProtectedRoute] Initial auth check complete, session:", !!session, "user:", !!user);
      
      // If we already have user/session at this point, we're ready to render
      if (user && session && isSessionValid(session)) {
        console.log("[ProtectedRoute] User and valid session already available, ready to render protected content");
        setReadyToRender(true);
        setIsInitialLoad(false);
        return;
      }
      
      // Set loading to false after a short delay if it's the initial load
      if (isInitialLoad) {
        const timer = setTimeout(() => {
          console.log("[ProtectedRoute] Initial load timer completed");
          setIsInitialLoad(false);
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, user, session, isInitialLoad]);

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

  // Check session validity helper function
  const isSessionValid = (session: any) => {
    if (!session || !session.expires_at) return false;
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const isValid = expiresAt > now;
    if (!isValid) {
      console.warn("[ProtectedRoute] Session expired:", { 
        expiresAt: expiresAt.toISOString(), 
        now: now.toISOString() 
      });
    }
    return isValid;
  };

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

  // Exit early with very clear logging if not authenticated
  if (!user || !session || !isSessionValid(session)) {
    console.log("[ProtectedRoute] Not authenticated or invalid session, redirecting to login", {
      hasUser: !!user,
      hasSession: !!session,
      isSessionValid: session ? isSessionValid(session) : false,
      retryCount,
      from: location.pathname
    });
    
    // Redirect to login with a return URL
    return <Navigate to={redirectPath} state={{ from: location.pathname }} replace />;
  }

  console.log("[ProtectedRoute] Authentication confirmed, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
