
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

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
  code?: string;
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
      
      let errorTitle = "Call failed";
      let errorDescription = errorMessage;
      let variant = "destructive" as const;
      
      // Get error response if available
      const errorResponse = err instanceof Error && 
        typeof (err as any).response === 'object' ? 
        (err as any).response?.data : null;
      
      // Check for specific error codes
      const errorCode = errorResponse?.code || '';
      
      if (errorMessage.includes('Profile setup incomplete') || 
          errorMessage.includes('Twilio configuration is incomplete') ||
          errorCode === 'PROFILE_NOT_FOUND' ||
          errorCode === 'TWILIO_CONFIG_INCOMPLETE') {
        errorTitle = "Profile setup required";
        errorDescription = "Please complete your profile setup with Twilio credentials before making calls.";
      }
      
      setError(errorMessage);
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: variant,
        // Remove the JSX in the .ts file and just use undefined
        // We'll handle the link UI in the component that uses this hook
      });
      
      return {
        success: false,
        error: errorMessage,
        code: errorCode
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
