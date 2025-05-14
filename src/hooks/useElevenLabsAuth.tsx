
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface UseElevenLabsAuthReturn {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  hasApiKey: boolean;
  isAuthenticated: boolean;
  hasValidSession: boolean;
  apiKeyStatus: 'missing' | 'configured' | 'unknown';
  validateApiKey: () => Promise<boolean>;
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
  
  /**
   * Validates the currently stored ElevenLabs API key
   * Returns true if valid, false otherwise
   */
  const validateApiKey = async (): Promise<boolean> => {
    if (!hasApiKey || !profile?.elevenlabs_api_key) {
      return false;
    }
    
    try {
      // Add a timeout to the fetch call to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch("https://api.elevenlabs.io/v1/user", {
        method: "GET",
        headers: {
          "xi-api-key": profile.elevenlabs_api_key,
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        setError("Your ElevenLabs API key appears to be invalid");
        toast({
          title: "API Key Validation Failed",
          description: `ElevenLabs API returned ${response.status}: ${response.statusText}`,
          variant: "destructive"
        });
        return false;
      }
      
      return true;
    } catch (err) {
      console.error("Error validating ElevenLabs API key:", err);
      setError(err instanceof Error ? err.message : "Failed to validate ElevenLabs API key");
      
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast({
          title: "API Key Validation Timed Out",
          description: "Connection to ElevenLabs timed out. Please check your internet connection and try again.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "API Key Validation Failed",
          description: err instanceof Error ? err.message : "Failed to validate ElevenLabs API key",
          variant: "destructive"
        });
      }
      
      return false;
    }
  };
  
  return {
    isReady,
    isLoading,
    error,
    hasApiKey,
    isAuthenticated,
    hasValidSession,
    apiKeyStatus,
    validateApiKey
  };
}
