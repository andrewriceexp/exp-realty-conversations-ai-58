
import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface ElevenLabsContextValue {
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  getSignedUrl: (agentId: string) => Promise<string | null>;
}

const ElevenLabsContext = createContext<ElevenLabsContextValue | undefined>(undefined);

export function ElevenLabsProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session, user } = useAuth();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Function to get a signed URL for conversation
  const getSignedUrl = useCallback(
    async (agentId: string): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("[ElevenLabsContext] Getting signed URL for agent:", agentId);
        
        if (!session?.access_token) {
          console.error("[ElevenLabsContext] No access token available");
          throw new Error("Authentication required");
        }

        const { data, error: signedUrlError } = await supabase.functions.invoke(
          "elevenlabs-signed-url",
          {
            body: { agent_id: agentId },
          }
        );

        if (signedUrlError) {
          console.error("[ElevenLabsContext] Error getting signed URL:", signedUrlError);
          throw new Error(
            `Failed to get conversation URL: ${signedUrlError.message}`
          );
        }

        if (!data?.signed_url) {
          console.error("[ElevenLabsContext] No signed URL returned");
          throw new Error("No conversation URL returned from server");
        }

        console.log("[ElevenLabsContext] Successfully obtained signed URL");
        return data.signed_url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[ElevenLabsContext] Error in getSignedUrl:", errorMessage);
        setError(errorMessage);
        toast({
          title: "Conversation Error",
          description: errorMessage,
          variant: "destructive"
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [session?.access_token]
  );

  return (
    <ElevenLabsContext.Provider
      value={{
        isLoading,
        error,
        clearError,
        getSignedUrl,
      }}
    >
      {children}
    </ElevenLabsContext.Provider>
  );
};

export const useElevenLabs = () => {
  const context = useContext(ElevenLabsContext);
  if (context === undefined) {
    throw new Error('useElevenLabs must be used within an ElevenLabsProvider');
  }
  return context;
};
