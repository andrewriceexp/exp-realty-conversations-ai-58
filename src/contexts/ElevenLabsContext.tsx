
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

        // Add retries for reliability
        const maxRetries = 3;
        let currentRetry = 0;
        let lastError = null;

        while (currentRetry < maxRetries) {
          try {
            const { data, error: functionError } = await supabase.functions.invoke('elevenlabs-signed-url', {
              body: { agent_id: agentId },
            });

            if (functionError) {
              console.error(`[ElevenLabsContext] Function error (attempt ${currentRetry + 1}):`, functionError);
              lastError = functionError;
              currentRetry++;
              if (currentRetry < maxRetries) {
                // Wait with exponential backoff before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, currentRetry - 1)));
                continue;
              }
              break;
            }

            if (!data || !data.signed_url) {
              console.error(`[ElevenLabsContext] Missing signed URL in response (attempt ${currentRetry + 1}):`, data);
              lastError = new Error('Invalid response from server');
              currentRetry++;
              if (currentRetry < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, currentRetry - 1)));
                continue;
              }
              break;
            }

            console.log('[ElevenLabsContext] Successfully obtained signed URL');
            
            // Return the signed URL without modifications
            return data.signed_url;
          } catch (err) {
            lastError = err;
            currentRetry++;
            if (currentRetry < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, currentRetry - 1)));
              continue;
            }
          }
        }

        // If we've exhausted retries and still have an error
        if (lastError) {
          const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
          console.error('[ElevenLabsContext] Error getting signed URL after retries:', errorMessage);
          
          // Check for specific error patterns to provide better error messages
          if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
            setError('ElevenLabs API rate limit exceeded. Please wait a moment and try again.');
          } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            setError('Your ElevenLabs API key appears to be invalid. Please update it in your profile settings.');
          } else {
            setError(`Failed to get conversation URL after ${maxRetries} attempts: ${errorMessage}`);
          }
        } else {
          setError(`Failed to get conversation URL after ${maxRetries} attempts`);
        }
        return null;
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
