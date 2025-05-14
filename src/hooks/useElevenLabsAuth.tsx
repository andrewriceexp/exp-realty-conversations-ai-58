
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { withTimeout } from '@/lib/utils';

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
      console.log("Validating ElevenLabs API key...");
      setIsLoading(true);
      
      // Use our withTimeout utility to prevent hanging
      const validatePromise = fetch("https://api.elevenlabs.io/v1/user", {
        method: "GET",
        headers: {
          "xi-api-key": profile.elevenlabs_api_key,
          "Content-Type": "application/json",
        },
      });
      
      // Set 12 second timeout which is reasonable for API validation
      const response = await withTimeout(
        validatePromise,
        12000,
        "ElevenLabs API key validation timed out"
      );
      
      if (!response.ok) {
        console.error("ElevenLabs API key validation failed:", response.status, response.statusText);
        setError("Your ElevenLabs API key appears to be invalid");
        toast({
          title: "API Key Validation Failed",
          description: `ElevenLabs API returned ${response.status}: ${response.statusText}`,
          variant: "destructive"
        });
        return false;
      }
      
      console.log("ElevenLabs API key validation successful");
      setError(null);
      return true;
    } catch (err) {
      console.error("Error validating ElevenLabs API key:", err);
      setError(err instanceof Error ? err.message : "Failed to validate ElevenLabs API key");
      
      if (err instanceof Error && err.message.includes("timed out")) {
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
    } finally {
      setIsLoading(false);
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
