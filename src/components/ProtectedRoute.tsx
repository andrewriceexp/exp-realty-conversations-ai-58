
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

  // Try to recover the session if needed
  useEffect(() => {
    if (!isLoading && !user && !isInitialLoad && retryCount < 3) {
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
          }
        } catch (err) {
          console.error("[ProtectedRoute] Recovery error:", err);
        }
      };
      
      const timer = setTimeout(attemptRecovery, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user, isInitialLoad, retryCount, toast]);
  
  // Add a small initial loading delay to prevent flashing content
  useEffect(() => {
    console.log("[ProtectedRoute] Checking auth state:", {
      isLoading,
      hasUser: !!user, 
      hasSession: !!session,
      path: location.pathname,
      retryCount
    });
    
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 200); // Slightly longer delay to ensure auth state is stabilized
    
    return () => clearTimeout(timer);
  }, [isLoading, user, session, location.pathname, retryCount]);

  if (isLoading || isInitialLoad) {
    console.log("[ProtectedRoute] Still loading...");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse-light text-exp-blue">Loading...</div>
      </div>
    );
  }

  if (!user || !session) {
    console.log("[ProtectedRoute] Not authenticated, redirecting to login", {
      hasUser: !!user,
      hasSession: !!session,
      retryCount
    });
    
    // Only redirect if we've tried to recover a few times
    if (retryCount >= 2) {
      // Redirect to login with a return URL
      return <Navigate to={redirectPath} state={{ from: location }} replace />;
    } else if (!isInitialLoad) {
      // If still in retry phase but past initial load, show intermediate loading
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse-light text-exp-blue">Verifying authentication...</div>
        </div>
      );
    }
  }

  console.log("[ProtectedRoute] Authenticated, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
