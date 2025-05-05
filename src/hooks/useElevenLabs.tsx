
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface VoiceOptions {
  text: string;
  voiceId?: string;
  model?: string;
}

export interface VoiceResponse {
  audioContent: string;
}

export function useElevenLabs() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  // Function to generate speech
  const generateSpeech = async ({
    text,
    voiceId,
    model,
  }: VoiceOptions): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setAudioSrc(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-speech', {
        body: {
          text,
          voiceId,
          model,
        },
      });
      
      if (error) throw new Error(error.message);
      
      if (!data.audioContent) {
        throw new Error('No audio content returned');
      }
      
      // Create an audio source URL from the base64 content
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      setAudioSrc(audioUrl);
      
      return audioUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate speech';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to play the generated audio
  const playAudio = () => {
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audio.play();
    }
  };

  return {
    generateSpeech,
    playAudio,
    audioSrc,
    isLoading,
    error,
  };
}
