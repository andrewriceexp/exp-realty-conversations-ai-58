
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { withTimeout } from '@/lib/utils';

interface UseElevenLabsAuthReturn {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  hasApiKey: boolean;
  isAuthenticated: boolean;
  hasValidSession: boolean;
  apiKeyStatus: 'missing' | 'configured' | 'unknown' | 'invalid' | 'valid';
  validateApiKey: () => Promise<boolean>;
  lastValidated: number | null;
}

// Constants for validation
const VALIDATION_TIMEOUT_MS = 12000; // 12 seconds
const MIN_VALIDATION_INTERVAL_MS = 30000; // 30 seconds between validations
const MAX_RETRIES = 2; // Reduced from 3 to minimize retry loops

/**
 * Custom hook to check if the user has all requirements to use ElevenLabs features
 * - Is authenticated
 * - Has valid session
 * - Has ElevenLabs API key configured and validated
 */
export function useElevenLabsAuth(): UseElevenLabsAuthReturn {
  const [isLoading, setIsLoading] = useState(false); // Start with false to avoid immediate validation
  const [error, setError] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<'missing' | 'configured' | 'unknown' | 'invalid' | 'valid'>('unknown');
  const [lastValidated, setLastValidated] = useState<number | null>(null);
  const validationInProgress = useRef(false);
  const retryCount = useRef(0);
  const toastShownRef = useRef<Map<string, number>>(new Map());
  const initialValidationDone = useRef(false);
  
  const { user, profile, session } = useAuth();
  
  const isAuthenticated = !!user;
  const hasApiKey = !!profile?.elevenlabs_api_key;
  const hasValidSession = !!session?.access_token;
  
  const isReady = isAuthenticated && hasApiKey && hasValidSession && apiKeyStatus === 'valid';
  
  // Toast throttling helper function
  const throttledToast = (props: { title: string, description: string, variant?: "default" | "destructive" | null }) => {
    const key = `${props.title}-${props.description}`;
    const now = Date.now();
    const lastShown = toastShownRef.current.get(key) || 0;
    
    // Only show the toast if it hasn't been shown in the last 5 seconds
    if (now - lastShown > 5000) {
      toast(props);
      toastShownRef.current.set(key, now);
    }
  };
  
  // Check basic auth requirements on mount and when auth state changes
  useEffect(() => {
    if (!profile) return; // Don't do anything if profile hasn't loaded yet
    
    // Reset API key status when profile changes
    if (profile) {
      setApiKeyStatus(hasApiKey ? 'configured' : 'missing');
    }
    
    // Check authentication and API key requirements
    if (!isAuthenticated) {
      setError("Authentication required to use ElevenLabs features");
      setApiKeyStatus('unknown');
      return;
    } else if (!hasValidSession) {
      setError("Your session has expired. Please log in again to refresh your authentication");
      setApiKeyStatus('unknown');
      return;
    } else if (!hasApiKey) {
      setError("ElevenLabs API key required. Please add it in your profile settings");
      setApiKeyStatus('missing');
      return;
    }
    
    // Only validate once on initial mount and then don't auto-validate
    // This prevents the validation loop and lets manual validation work as expected
    if (!initialValidationDone.current && hasApiKey && !validationInProgress.current) {
      initialValidationDone.current = true;
      // Slight delay on first validation to avoid race conditions with mount
      const timer = setTimeout(() => {
        validateApiKey().catch(() => {/* Errors handled inside validateApiKey */});
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasApiKey, hasValidSession, profile]);
  
  /**
   * Validates the currently stored ElevenLabs API key
   * Returns true if valid, false otherwise
   * Implements throttling and retries with exponential backoff
   */
  const validateApiKey = async (): Promise<boolean> => {
    // Don't validate if no API key or if a validation is already in progress
    if (!hasApiKey || !profile?.elevenlabs_api_key || validationInProgress.current) {
      return false;
    }
    
    // Skip if we've validated recently unless it's an explicit revalidation call
    const now = Date.now();
    const timeSinceLastValidation = lastValidated ? now - lastValidated : Infinity;
    if (lastValidated && timeSinceLastValidation < MIN_VALIDATION_INTERVAL_MS && apiKeyStatus === 'valid') {
      console.log(`Skipping validation, last validated ${Math.round(timeSinceLastValidation / 1000)}s ago`);
      // Return the last known status
      return apiKeyStatus === 'valid';
    }
    
    try {
      console.log("Validating ElevenLabs API key...");
      setIsLoading(true);
      validationInProgress.current = true;
      
      // Use our withTimeout utility to prevent hanging
      const validatePromise = fetch("https://api.elevenlabs.io/v1/user", {
        method: "GET",
        headers: {
          "xi-api-key": profile.elevenlabs_api_key,
          "Content-Type": "application/json",
        },
      });
      
      // Set timeout which is reasonable for API validation
      const response = await withTimeout(
        validatePromise,
        VALIDATION_TIMEOUT_MS,
        "ElevenLabs API key validation timed out"
      );
      
      if (!response.ok) {
        console.error("ElevenLabs API key validation failed:", response.status, response.statusText);
        setError("Your ElevenLabs API key appears to be invalid");
        setApiKeyStatus('invalid');
        
        // Only show a toast if this is the first validation attempt
        if (retryCount.current === 0) {
          throttledToast({
            title: "API Key Validation Failed",
            description: `ElevenLabs API returned ${response.status}: ${response.statusText}`,
            variant: "destructive"
          });
        }
        
        return false;
      }
      
      // Check if the response contains the expected user data
      const userData = await response.json();
      if (!userData || !userData.subscription) {
        console.error("ElevenLabs API key validation failed: Unexpected response format");
        setError("Received invalid response from ElevenLabs API");
        setApiKeyStatus('invalid');
        return false;
      }
      
      console.log("ElevenLabs API key validation successful");
      setError(null);
      setApiKeyStatus('valid');
      retryCount.current = 0;
      setLastValidated(now);
      return true;
    } catch (err) {
      console.error("Error validating ElevenLabs API key:", err);
      
      if (err instanceof Error) {
        setError(err.message);
        
        // Only show a toast if this isn't a retry or it's a timeout
        if (retryCount.current === 0 || err.message.includes("timed out")) {
          // Determine appropriate error message based on error type
          if (err.message.includes("timed out")) {
            throttledToast({
              title: "API Key Validation Timed Out",
              description: "Connection to ElevenLabs timed out. Please check your internet connection and try again.",
              variant: "default"
            });
          } else {
            throttledToast({
              title: "API Key Validation Failed",
              description: err.message,
              variant: "destructive"
            });
          }
        }
      } else {
        setError("Failed to validate ElevenLabs API key");
      }
      
      // Implement retry with exponential backoff - only if it's not a direct user-initiated validation
      if (retryCount.current === 0) {
        retryCount.current += 1;
        
        if (retryCount.current <= MAX_RETRIES) {
          // Exponential backoff: 2^retry * 1000ms (2s, 4s, 8s)
          const backoffMs = Math.min(Math.pow(2, retryCount.current) * 1000, 8000);
          console.log(`Retry ${retryCount.current}/${MAX_RETRIES} in ${backoffMs}ms`);
          
          // Schedule retry with backoff
          setTimeout(() => {
            validationInProgress.current = false;
            validateApiKey().catch(() => {/* Errors handled inside validateApiKey */});
          }, backoffMs);
        } else {
          retryCount.current = 0;
          setApiKeyStatus('invalid');
        }
      } else {
        setApiKeyStatus('invalid');
      }
      
      return false;
    } finally {
      setIsLoading(false);
      validationInProgress.current = false;
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
    validateApiKey,
    lastValidated
  };
}
