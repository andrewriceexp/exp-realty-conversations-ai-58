
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type ApiKeyStatus = 'valid' | 'invalid' | 'checking' | 'missing' | null;

export function useElevenLabsAuth() {
  const { user, profile } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>(null);
  const [lastValidated, setLastValidated] = useState<number | null>(null);

  // Check if user has an API key
  const hasApiKey = Boolean(profile?.elevenlabs_api_key);

  // Function to validate the API key
  const validateApiKey = useCallback(async (): Promise<boolean> => {
    if (!profile?.elevenlabs_api_key) {
      console.log("[ElevenLabsAuth] No API key found in profile");
      setApiKeyStatus('missing');
      setError('ElevenLabs API key is missing');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log("[ElevenLabsAuth] Validating API key");
      
      // Call the elevenlabs-voices function to validate the API key
      const { data, error } = await supabase.functions.invoke('elevenlabs-voices', {
        body: { validate_only: true }
      });

      if (error) {
        console.error("[ElevenLabsAuth] API key validation error:", error);
        setApiKeyStatus('invalid');
        setError(`API key validation failed: ${error.message}`);
        toast({
          title: "ElevenLabs API Key Error",
          description: `Your API key could not be validated: ${error.message}`,
          variant: "destructive"
        });
        return false;
      }

      if (data?.success === true) {
        console.log("[ElevenLabsAuth] API key validated successfully");
        setApiKeyStatus('valid');
        setLastValidated(Date.now());
        return true;
      } else {
        console.error("[ElevenLabsAuth] API key validation failed:", data?.message || "Unknown error");
        setApiKeyStatus('invalid');
        setError(`API key validation failed: ${data?.message || "Unknown error"}`);
        toast({
          title: "ElevenLabs API Key Error",
          description: data?.message || "Your API key could not be validated",
          variant: "destructive"
        });
        return false;
      }
    } catch (err) {
      console.error("[ElevenLabsAuth] Unexpected error during validation:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setApiKeyStatus('invalid');
      setError(`API key validation error: ${errorMessage}`);
      toast({
        title: "ElevenLabs API Key Error",
        description: `Unexpected error: ${errorMessage}`,
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  }, [profile?.elevenlabs_api_key]);

  // Validate API key when profile changes
  useEffect(() => {
    if (profile && hasApiKey && !isReady && !isLoading && apiKeyStatus !== 'valid') {
      validateApiKey().catch(err => {
        console.error("[ElevenLabsAuth] Error in validation effect:", err);
      });
    } else if (!hasApiKey) {
      setApiKeyStatus('missing');
      setIsReady(true);
    }
  }, [profile, hasApiKey, isReady, validateApiKey, isLoading, apiKeyStatus]);

  return {
    isReady,
    hasApiKey,
    apiKeyStatus,
    lastValidated,
    error,
    isLoading,
    validateApiKey
  };
}
