
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// Define types for the ElevenLabs context
export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  labels?: Record<string, string>;
};

export type ElevenLabsContextType = {
  apiKey: string | null;
  isApiKeyValid: boolean;
  isLoading: boolean;
  error: string | null;
  voices: ElevenLabsVoice[];
  validateApiKey: (apiKey?: string) => Promise<boolean>;
  fetchVoices: () => Promise<void>;
  getVoices: () => ElevenLabsVoice[]; // Added this method
};

const ElevenLabsContext = createContext<ElevenLabsContextType>({
  apiKey: null,
  isApiKeyValid: false,
  isLoading: false,
  error: null,
  voices: [],
  validateApiKey: async () => false,
  fetchVoices: async () => {},
  getVoices: () => [], // Added this method
});

export function ElevenLabsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);

  // Function to validate the API key
  const validateApiKey = async (key?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-voices', {
        body: { validate_only: true, api_key: key || apiKey },
      });

      if (error) {
        console.error('Error validating ElevenLabs API key:', error);
        setError(`Failed to validate API key: ${error.message}`);
        setIsApiKeyValid(false);
        return false;
      }

      setIsApiKeyValid(data.success === true);
      return data.success === true;
    } catch (err) {
      console.error('Error validating ElevenLabs API key:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsApiKeyValid(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch voices from the ElevenLabs API
  const fetchVoices = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!apiKey && !isApiKeyValid) {
        setError('API key is not set or not validated');
        setVoices([]);
        return;
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-voices', {
        body: { api_key: apiKey },
      });

      if (error) {
        console.error('Error fetching ElevenLabs voices:', error);
        setError(`Failed to fetch voices: ${error.message}`);
        setVoices([]);
        return;
      }

      setVoices(data.voices || []);
    } catch (err) {
      console.error('Error fetching ElevenLabs voices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setVoices([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to get voices (simple getter for the voices state)
  const getVoices = (): ElevenLabsVoice[] => {
    return voices;
  };

  // Fetch the user's API key from their profile
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        setIsLoading(true);

        const { data: userSession } = await supabase.auth.getSession();
        
        if (userSession?.session?.user?.id) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('elevenlabs_api_key')
            .eq('id', userSession.session.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
            setError(`Failed to fetch profile: ${profileError.message}`);
            return;
          }

          if (profileData?.elevenlabs_api_key) {
            setApiKey(profileData.elevenlabs_api_key);
            // Validate the API key after setting it
            const isValid = await validateApiKey(profileData.elevenlabs_api_key);
            if (isValid) {
              // Fetch voices if the API key is valid
              fetchVoices();
            }
          }
        }
      } catch (err) {
        console.error('Error in ElevenLabsProvider:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  return (
    <ElevenLabsContext.Provider
      value={{
        apiKey,
        isApiKeyValid,
        isLoading,
        error,
        voices,
        validateApiKey,
        fetchVoices,
        getVoices, // Added this method
      }}
    >
      {children}
    </ElevenLabsContext.Provider>
  );
}

export function useElevenLabs() {
  const context = useContext(ElevenLabsContext);
  if (context === undefined) {
    throw new Error('useElevenLabs must be used within an ElevenLabsProvider');
  }
  return context;
}

export default ElevenLabsContext;
