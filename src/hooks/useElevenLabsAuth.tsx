
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UseElevenLabsAuthReturn {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  hasApiKey: boolean;
  isAuthenticated: boolean;
  hasValidSession: boolean;
  apiKeyStatus: 'missing' | 'configured' | 'unknown';
}

/**
 * Custom hook to check if the user has all requirements to use ElevenLabs features
 * - Is authenticated
 * - Has valid session
 * - Has ElevenLabs API key configured
 */
export function useElevenLabsAuth(): UseElevenLabsAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, profile, session } = useAuth();
  
  const isAuthenticated = !!user;
  const hasApiKey = !!profile?.elevenlabs_api_key;
  const hasValidSession = !!session?.access_token;
  
  const apiKeyStatus = !isAuthenticated ? 'unknown' : 
                      (hasApiKey ? 'configured' : 'missing');
  
  const isReady = isAuthenticated && hasApiKey && hasValidSession;
  
  useEffect(() => {
    // Check authentication and API key requirements
    if (!isAuthenticated) {
      setError("Authentication required to use ElevenLabs features");
    } else if (!hasValidSession) {
      setError("Your session has expired. Please log in again to refresh your authentication");
    } else if (!hasApiKey) {
      setError("ElevenLabs API key required. Please add it in your profile settings");
    } else {
      setError(null);
    }
    
    setIsLoading(false);
  }, [isAuthenticated, hasApiKey, hasValidSession]);
  
  return {
    isReady,
    isLoading,
    error,
    hasApiKey,
    isAuthenticated,
    hasValidSession,
    apiKeyStatus
  };
}
