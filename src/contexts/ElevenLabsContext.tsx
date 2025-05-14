
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

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
      // Call the Supabase Edge Function that will generate a signed URL
      // Using the organization's ElevenLabs API key stored in environment variables
      const { data, error } = await supabase.functions.invoke('elevenlabs-signed-url', {
        body: { 
          agentId 
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.signed_url) {
        throw new Error('Failed to get signed URL for ElevenLabs conversation');
      }

      return data.signed_url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get signed URL';
      setError(errorMessage);
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
