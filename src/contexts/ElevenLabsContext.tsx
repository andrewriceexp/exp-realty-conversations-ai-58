
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileData } from '@/contexts/AuthContext';

interface ElevenLabsContextType {
  isApiKeyConfigured: boolean;
  isVoiceConfigured: boolean;
  isPhoneNumberConfigured: boolean;
  apiKey: string | null;
  voiceId: string | null;
  phoneNumberId: string | null;
}

const defaultContext: ElevenLabsContextType = {
  isApiKeyConfigured: false,
  isVoiceConfigured: false,
  isPhoneNumberConfigured: false,
  apiKey: null,
  voiceId: null,
  phoneNumberId: null
};

export const ElevenLabsContext = createContext<ElevenLabsContextType>(defaultContext);

export const ElevenLabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ElevenLabsContextType>(defaultContext);
  
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
        phoneNumberId: profile.elevenlabs_phone_number_id || null
      });
    }
  }, [profile, isLoading]);

  return (
    <ElevenLabsContext.Provider value={state}>
      {children}
    </ElevenLabsContext.Provider>
  );
};

export const useElevenLabs = () => useContext(ElevenLabsContext);
