
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectPath?: string;
}

const ProtectedRoute = ({ children, redirectPath = '/login' }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [showLoading, setShowLoading] = useState(true);
  
  // Set a timeout to prevent infinite loading state
  useEffect(() => {
    // If still loading after 5 seconds, show a more informative message
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn("Loading timeout reached in ProtectedRoute");
        setShowLoading(false);
      }
    }, 5000);
    
    // If not loading, clear timeout
    if (!isLoading) {
      setShowLoading(true);
    }
    
    return () => clearTimeout(timeout);
  }, [isLoading]);

  if (isLoading && showLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Spinner className="h-12 w-12 text-primary" />
        <div className="text-lg font-medium">Loading your account...</div>
      </div>
    );
  }
  
  // If loading has taken too long, provide a fallback and link to try again
  if (isLoading && !showLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <div className="text-lg font-medium text-red-500">
          It's taking longer than expected to load your account.
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 transition-colors"
        >
          Reload Page
        </button>
        <button 
          onClick={() => window.location.href = '/login'}
          className="text-primary hover:underline"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (!user) {
    console.log("User not authenticated, redirecting to", redirectPath);
    // Redirect to login with a return URL
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  console.log("User authenticated, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
