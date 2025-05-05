
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export interface VoiceOptions {
  text: string;
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface VoiceResponse {
  audioContent: string;
}

export function useElevenLabs() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const { toast } = useToast();

  // Function to get available voices
  const getVoices = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-voices', {
        body: {},
      });
      
      if (error) throw new Error(error.message);
      
      return data.voices;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch voices';
      setError(errorMessage);
      toast({
        title: "Error fetching voices",
        description: errorMessage,
        variant: "destructive"
      });
      throw new Error(errorMessage);
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
      toast({
        title: "Speech generation failed",
        description: errorMessage,
        variant: "destructive"
      });
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
        variant: "warning"
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
