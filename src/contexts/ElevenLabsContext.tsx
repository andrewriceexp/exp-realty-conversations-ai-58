
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ElevenLabsContextType {
  getSignedUrl: (agentId: string) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

const ElevenLabsContext = createContext<ElevenLabsContextType | undefined>(undefined);

export function ElevenLabsProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const getSignedUrl = async (agentId: string): Promise<string | null> => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You need to be logged in to use the conversation AI features",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Calling elevenlabs-signed-url function with agentId:", agentId);
      // Call the Supabase Edge Function that will generate a signed URL
      const { data, error: funcError } = await supabase.functions.invoke('elevenlabs-signed-url', {
        body: { 
          agentId 
        }
      });

      if (funcError) {
        console.error('ElevenLabs API error from function:', funcError);
        throw new Error(`Function error: ${funcError.message || 'Unknown error'}`);
      }

      if (!data) {
        throw new Error('No data returned from elevenlabs-signed-url function');
      }

      console.log('elevenlabs-signed-url function response:', data);

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
        title: "Error connecting to ElevenLabs",
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
    error
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
