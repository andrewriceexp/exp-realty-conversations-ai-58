
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { withTimeout } from '@/lib/utils';

interface ElevenLabsContextType {
  getSignedUrl: (agentId?: string) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const ElevenLabsContext = createContext<ElevenLabsContextType | undefined>(undefined);

// Default agent ID - we'll use this if no specific agent ID is provided
const DEFAULT_AGENT_ID = '6Optf6WRTzp3rEyj2aiL';

export function ElevenLabsProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile, session } = useAuth();
  const { toast } = useToast();

  const clearError = () => setError(null);

  const getSignedUrl = async (agentId?: string): Promise<string | null> => {
    // Reset any previous errors
    setError(null);
    
    if (!user) {
      const errorMsg = "Authentication required to use conversation features";
      setError(errorMsg);
      toast({
        title: "Authentication Required",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    // Check if user has an ElevenLabs API key configured
    if (!profile?.elevenlabs_api_key) {
      const errorMsg = "Please configure your ElevenLabs API key in your profile settings";
      setError(errorMsg);
      toast({
        title: "ElevenLabs API Key Required",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    // Check if we have a valid session and access token
    if (!session?.access_token) {
      const errorMsg = "Authentication session is missing or expired. Please log in again.";
      setError(errorMsg);
      console.error(errorMsg);
      toast({
        title: "Session Error",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    // Use the provided agent ID or fall back to the default one
    const agentIdToUse = agentId || DEFAULT_AGENT_ID;

    if (!agentIdToUse || agentIdToUse.trim() === '') {
      const errorMsg = "A valid ElevenLabs agent ID is required";
      setError(errorMsg);
      toast({
        title: "Invalid Configuration",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);

    try {
      console.log("Calling elevenlabs-signed-url function with agentId:", agentIdToUse);
      console.log("Session access token available:", !!session.access_token);
      console.log("User authenticated:", !!user);
      console.log("ElevenLabs API key configured:", !!profile?.elevenlabs_api_key);
      
      // Call the Supabase Edge Function that will generate a signed URL with a timeout
      const functionPromise = supabase.functions.invoke('elevenlabs-signed-url', {
        body: { 
          agentId: agentIdToUse 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      
      const result = await withTimeout(
        functionPromise, 
        15000, 
        'Request to elevenlabs-signed-url timed out'
      );
      
      const { data, error: funcError } = result;

      if (funcError) {
        console.error('ElevenLabs API error from function:', funcError);
        throw new Error(`Function error: ${funcError.message || 'Unknown error'}`);
      }

      if (!data) {
        throw new Error('No data returned from elevenlabs-signed-url function');
      }

      console.log('elevenlabs-signed-url function response:', data);

      if (data.error) {
        throw new Error(`ElevenLabs error: ${data.error}`);
      }

      if (!data.signed_url) {
        throw new Error('Failed to get signed URL for ElevenLabs conversation');
      }

      console.log('Successfully obtained ElevenLabs signed URL');
      return data.signed_url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get signed URL';
      setError(errorMessage);
      console.error('ElevenLabs getSignedUrl error:', err);
      toast({
        title: "Error Connecting to ElevenLabs",
        description: errorMessage,
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    getSignedUrl,
    isLoading,
    error,
    clearError
  };

  return (
    <ElevenLabsContext.Provider value={value}>
      {children}
    </ElevenLabsContext.Provider>
  );
}

export const useElevenLabs = (): ElevenLabsContextType => {
  const context = useContext(ElevenLabsContext);
  if (context === undefined) {
    throw new Error('useElevenLabs must be used within an ElevenLabsProvider');
  }
  return context;
};
