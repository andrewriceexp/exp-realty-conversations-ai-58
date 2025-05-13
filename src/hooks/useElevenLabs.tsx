
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface VoiceOptions {
  text: string;
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
}

export function useElevenLabs() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const { toast } = useToast();

  // Function to get available voices
  const getVoices = async (): Promise<Voice[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching available ElevenLabs voices...');
      const { data, error } = await supabase.functions.invoke('elevenlabs-voices', {
        body: {},
      });
      
      if (error) {
        console.error('Error fetching ElevenLabs voices:', error);
        throw new Error(error.message);
      }
      
      // Log the response to help with debugging
      console.log('Voices retrieved from ElevenLabs:', data?.voices?.length || 0);
      
      if (!data?.voices || !Array.isArray(data.voices)) {
        console.warn('No voices returned from ElevenLabs API or invalid response format');
        return [];
      }
      
      return data.voices;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch voices';
      setError(errorMessage);
      console.error('ElevenLabs getVoices error:', err);
      toast({
        title: "Error fetching voices",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Return empty array rather than throwing to make error handling easier for callers
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Function to generate speech
  const generateSpeech = async ({
    text,
    voiceId = "EXAVITQu4vr4xnSDxMaL", // Default to "Sarah" voice
    model = "eleven_multilingual_v2",
    stability = 0.5,
    similarityBoost = 0.75
  }: VoiceOptions): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setAudioSrc(null);
    
    try {
      console.log(`Generating speech with ElevenLabs, voice ID: ${voiceId.substring(0, 8)}...`);
      
      const { data, error } = await supabase.functions.invoke('generate-speech', {
        body: {
          text,
          voiceId,
          model,
          settings: {
            stability,
            similarity_boost: similarityBoost
          }
        },
      });
      
      if (error) {
        console.error('Error invoking generate-speech function:', error);
        throw new Error(error.message);
      }
      
      if (!data?.audioContent) {
        console.error('No audio content returned from generate-speech function');
        throw new Error('No audio content returned');
      }
      
      // Create an audio source URL from the base64 content
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      setAudioSrc(audioUrl);
      console.log('Successfully generated speech with ElevenLabs');
      
      return audioUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate speech';
      setError(errorMessage);
      console.error('ElevenLabs generateSpeech error:', err);
      
      // Special case for missing API key
      if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        toast({
          title: "ElevenLabs API Key Missing",
          description: "Please add your ElevenLabs API key in your profile settings to use custom voices.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Speech generation failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to play the generated audio
  const playAudio = () => {
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audio.play().catch(err => {
        console.error('Audio playback error:', err);
        toast({
          title: "Audio playback error",
          description: err.message,
          variant: "destructive"
        });
      });
    } else {
      toast({
        title: "No audio to play",
        description: "Please generate speech first",
        variant: "default"
      });
    }
  };

  return {
    generateSpeech,
    getVoices,
    playAudio,
    audioSrc,
    isLoading,
    error,
  };
}
