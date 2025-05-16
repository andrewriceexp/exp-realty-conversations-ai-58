
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileData } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Voice } from '@/hooks/useElevenLabs';

interface ElevenLabsContextType {
  isApiKeyConfigured: boolean;
  isVoiceConfigured: boolean;
  isPhoneNumberConfigured: boolean;
  apiKey: string | null;
  voiceId: string | null;
  phoneNumberId: string | null;
  isLoading: boolean;
  error: string | null;
  getSignedUrl: (agentId: string) => Promise<string | null>;
  getVoices: () => Promise<Voice[]>;
  clearError: () => void;
}

const defaultContext: ElevenLabsContextType = {
  isApiKeyConfigured: false,
  isVoiceConfigured: false,
  isPhoneNumberConfigured: false,
  apiKey: null,
  voiceId: null,
  phoneNumberId: null,
  isLoading: false,
  error: null,
  getSignedUrl: () => Promise.resolve(null),
  getVoices: () => Promise.resolve([]),
  clearError: () => {}
};

export const ElevenLabsContext = createContext<ElevenLabsContextType>(defaultContext);

export const ElevenLabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<Omit<ElevenLabsContextType, 'getSignedUrl' | 'getVoices' | 'clearError'>>({
    ...defaultContext,
    isLoading: true
  });
  const [error, setError] = useState<string | null>(null);
  
  // Use try/catch to safely access the useAuth hook, which must be used within an AuthProvider
  let profile: ProfileData | null = null;
  let isLoading: boolean = true;
  
  try {
    const auth = useAuth();
    profile = auth.profile;
    isLoading = auth.isLoading;
  } catch (error) {
    // If useAuth fails (AuthProvider not yet available), maintain default state
    console.warn("ElevenLabsProvider: AuthProvider not available yet");
  }

  useEffect(() => {
    if (!isLoading && profile) {
      setState({
        isApiKeyConfigured: !!profile.elevenlabs_api_key,
        isVoiceConfigured: !!profile.elevenlabs_voice_id,
        isPhoneNumberConfigured: !!profile.elevenlabs_phone_number_id,
        apiKey: profile.elevenlabs_api_key || null,
        voiceId: profile.elevenlabs_voice_id || null,
        phoneNumberId: profile.elevenlabs_phone_number_id || null,
        isLoading: false,
        error: null
      });
    }
  }, [profile, isLoading]);

  // Implement the getSignedUrl method
  const getSignedUrl = async (agentId: string): Promise<string | null> => {
    if (!state.apiKey) {
      setError("ElevenLabs API key is not configured");
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-signed-url', {
        body: { agent_id: agentId }
      });
      
      if (error) {
        console.error("Error getting signed URL:", error);
        setError(`Failed to get signed URL: ${error.message}`);
        return null;
      }
      
      return data?.signed_url || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error("Unexpected error getting signed URL:", errorMessage);
      setError(`Unexpected error: ${errorMessage}`);
      return null;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Implement the getVoices method
  const getVoices = async (): Promise<Voice[]> => {
    if (!state.apiKey) {
      setError("ElevenLabs API key is not configured");
      return [];
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-voices', {
        body: {} // No additional parameters needed
      });
      
      if (error) {
        console.error("Error fetching voices:", error);
        setError(`Failed to fetch voices: ${error.message}`);
        return [];
      }
      
      if (!data?.voices || !Array.isArray(data.voices)) {
        console.error("Invalid response format when fetching voices");
        setError("Invalid response format when fetching voices");
        return [];
      }
      
      return data.voices;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error("Unexpected error fetching voices:", errorMessage);
      setError(`Unexpected error: ${errorMessage}`);
      return [];
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Implement the clearError method
  const clearError = () => {
    setError(null);
  };

  const contextValue = {
    ...state,
    error,
    getSignedUrl,
    getVoices,
    clearError
  };

  return (
    <ElevenLabsContext.Provider value={contextValue}>
      {children}
    </ElevenLabsContext.Provider>
  );
};

export const useElevenLabs = () => useContext(ElevenLabsContext);
