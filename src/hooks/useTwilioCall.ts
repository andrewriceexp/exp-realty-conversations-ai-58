
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface CallOptions {
  prospectId: string;
  agentConfigId: string;
  userId: string;
}

export interface CallResponse {
  success: boolean;
  callSid?: string;
  callLogId?: string;
  message?: string;
  error?: string;
}

export function useTwilioCall() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const makeCall = async (options: CallOptions): Promise<CallResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('twilio-make-call', {
        body: options,
      });
      
      if (error) throw new Error(error.message);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate call');
      }
      
      toast({
        title: "Call initiated",
        description: "The AI agent is now calling the prospect.",
      });
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make call';
      setError(errorMessage);
      toast({
        title: "Call failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    makeCall,
    isLoading,
    error,
  };
}
