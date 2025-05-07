
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
      console.log('Initiating call with options:', options);
      
      const { data, error: invokeError } = await supabase.functions.invoke('twilio-make-call', {
        body: options,
      });
      
      console.log('Edge function response:', data);
      
      if (invokeError) {
        console.error('Edge function error:', invokeError);
        throw new Error(`Edge Function error: ${invokeError.message}`);
      }
      
      if (!data) {
        throw new Error('No response from Edge Function');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.success) {
        toast({
          title: "Call initiated",
          description: data.message || "The AI agent is now calling the prospect.",
        });
        
        return data;
      } else {
        throw new Error(data.error || 'Failed to initiate call');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make call';
      console.error('Call error:', errorMessage);
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
