
import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

interface ElevenLabsContextType {
  getSignedUrl: (agentId: string) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const ElevenLabsContext = createContext<ElevenLabsContextType | undefined>(undefined);

export const ElevenLabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getSignedUrl = useCallback(
    async (agentId: string): Promise<string | null> => {
      if (!agentId) {
        setError('Agent ID is required');
        return null;
      }

      if (!session) {
        setError('Authentication required');
        return null;
      }

      try {
        setIsLoading(true);
        setError(null);
        console.log('[ElevenLabsContext] Getting signed URL for agent:', agentId);

        const { data, error: functionError } = await supabase.functions.invoke('elevenlabs-signed-url', {
          body: { agent_id: agentId },
        });

        if (functionError) {
          console.error('[ElevenLabsContext] Function error:', functionError);
          setError(`Error from server: ${functionError.message}`);
          return null;
        }

        if (!data || !data.signed_url) {
          console.error('[ElevenLabsContext] Missing signed URL in response:', data);
          setError('Invalid response from server');
          return null;
        }

        console.log('[ElevenLabsContext] Successfully obtained signed URL');
        return data.signed_url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[ElevenLabsContext] Error getting signed URL:', errorMessage);
        setError(`Failed to get conversation URL: ${errorMessage}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  const value = {
    getSignedUrl,
    isLoading,
    error,
    clearError,
  };

  return <ElevenLabsContext.Provider value={value}>{children}</ElevenLabsContext.Provider>;
};

export const useElevenLabs = (): ElevenLabsContextType => {
  const context = useContext(ElevenLabsContext);
  if (context === undefined) {
    throw new Error('useElevenLabs must be used within an ElevenLabsProvider');
  }
  return context;
};
