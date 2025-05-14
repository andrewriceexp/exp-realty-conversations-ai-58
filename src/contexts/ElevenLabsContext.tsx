
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface ElevenLabsContextValue {
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  getSignedUrl: (agentId: string) => Promise<string | null>;
}

const ElevenLabsContext = createContext<ElevenLabsContextValue | undefined>(undefined);

export const ElevenLabsProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Clear any error messages
  const clearError = () => setError(null);
  
  // Function to get a signed URL for authenticated conversations
  const getSignedUrl = async (agentId: string): Promise<string | null> => {
    try {
      setIsLoading(true);
      clearError();
      
      console.log('Getting signed URL for agent:', agentId);
      
      const functionPromise = supabase.functions.invoke('elevenlabs-signed-url', {
        body: { agent_id: agentId },
      });
      
      // Add timeout to prevent hanging
      const result = await withTimeout(
        functionPromise,
        15000,
        'Request to get signed URL timed out'
      );
      
      const { data, error } = result;
      
      if (error) {
        console.error('Error getting signed URL:', error);
        throw new Error(error.message || 'Failed to get signed URL');
      }
      
      if (!data?.signed_url) {
        throw new Error('No signed URL returned from the server');
      }
      
      console.log('Successfully retrieved signed URL');
      return data.signed_url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get signed URL';
      setError(errorMessage);
      console.error('getSignedUrl error:', err);
      
      // Only show one toast for this error
      toast({
        title: "Failed to start conversation",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
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
