
import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectPath?: string;
}

const ProtectedRoute = ({ children, redirectPath = '/login' }: ProtectedRouteProps) => {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Add a small initial loading delay to prevent flashing content
  useEffect(() => {
    console.log("[ProtectedRoute] Checking auth state:", {
      isLoading,
      hasUser: !!user, 
      hasSession: !!session,
      path: location.pathname
    });
    
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isLoading, user, session]);

  if (isLoading || isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse-light text-exp-blue">Loading...</div>
      </div>
    );
  }

  if (!user || !session) {
    console.log("[ProtectedRoute] Not authenticated, redirecting to login");
    // Redirect to login with a return URL
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  console.log("[ProtectedRoute] Authenticated, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
