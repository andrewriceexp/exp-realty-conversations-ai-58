
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface GenerateContentParams {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  model?: string;
}

export function useOpenAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateContent = async ({
    prompt,
    systemPrompt,
    temperature = 0.7,
    model = 'gpt-4o-mini'
  }: GenerateContentParams): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-with-ai', {
        body: {
          prompt,
          systemPrompt,
          temperature,
          model,
        },
      });
      
      if (error) throw new Error(error.message);
      
      return data.generatedText;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate content';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateContent,
    isLoading,
    error,
  };
}
