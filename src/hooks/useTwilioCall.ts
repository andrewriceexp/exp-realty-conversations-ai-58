
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
        
        // This is crucial for extracting the actual error from Supabase Edge Function
        if (typeof invokeError === 'object' && invokeError.message?.includes('non-2xx status code')) {
          // If we have data, it means the edge function returned an error response
          if (data && data.error) {
            const err = new Error(data.error);
            if (data.code) {
              (err as any).code = data.code;
            }
            throw err;
          }
        }
        
        throw new Error(`Edge Function error: ${invokeError.message}`);
      }
      
      if (!data) {
        throw new Error('No response from Edge Function');
      }
      
      if (data.error) {
        const err = new Error(data.error);
        if (data.code) {
          (err as any).code = data.code;
        }
        throw err;
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
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make call';
      console.error('Call error:', errorMessage);
      
      let errorTitle = "Call failed";
      let errorDescription = errorMessage;
      let variant = "destructive" as const;
      let errorCode = '';
      
      // Extract error code if available
      if (err instanceof Error && typeof (err as any).code === 'string') {
        errorCode = (err as any).code;
      }
      
      // Check for profile setup issues
      if (errorMessage.includes('Profile setup') || 
          errorMessage.includes('Twilio configuration') ||
          errorMessage.includes('Please visit your profile settings') ||
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
        // We don't include the action here, we'll handle the UI in the components
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
