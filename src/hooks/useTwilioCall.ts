
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { anonymizePhoneNumber } from '@/utils/anonymizationUtils';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';

export interface CallOptions {
  prospectId: string;
  agentConfigId: string;
  userId: string;
  twilio_customer_id: string;
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
            console.log('Edge function returned an error response:', data);
            const err = new Error(data.error);
            if (data.code) {
              (err as any).code = data.code;
            }
            throw err;
          } else {
            // Try to extract more details from the error if possible
            console.log('Attempting to extract more error details...');
            let errorDetails = "Unknown edge function error";
            
            try {
              // Some errors might have more details in a nested format
              if (invokeError.context && typeof invokeError.context === 'object') {
                console.log('Error context:', invokeError.context);
                errorDetails = JSON.stringify(invokeError.context);
              }
            } catch (e) {
              console.error('Failed to extract error details:', e);
            }
            
            throw new Error(`Edge Function error: ${errorDetails}`);
          }
        }
        
        throw new Error(`Edge Function error: ${invokeError.message}`);
      }
      
      if (!data) {
        console.error('No data received from edge function');
        throw new Error('No response from Edge Function');
      }
      
      if (data.error) {
        console.error('Error data from edge function:', data);
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
      console.error('Call error:', err);
      
      let errorTitle = "Call failed";
      let errorDescription = errorMessage;
      let variant = "destructive" as const;
      let errorCode = '';
      
      // Extract error code if available
      if (err instanceof Error && typeof (err as any).code === 'string') {
        errorCode = (err as any).code;
      }
      
      // Check for specific error types
      if (errorCode === 'MISSING_PHONE_NUMBER' || errorMessage.includes('phone number')) {
        errorTitle = "Invalid phone number";
        // Check if we should anonymize the phone numbers in error messages
        const shouldAnonymize = isAnonymizationEnabled();
        errorDescription = shouldAnonymize 
          ? "The prospect doesn't have a valid phone number. Please update the prospect's information."
          : "The prospect doesn't have a valid phone number. Please update the prospect's information.";
      } 
      // Check for profile setup issues
      else if (errorMessage.includes('Profile setup') || 
          errorMessage.includes('Twilio configuration') ||
          errorCode === 'PROFILE_NOT_FOUND' ||
          errorCode === 'TWILIO_CONFIG_INCOMPLETE') {
        errorTitle = "Profile setup required";
        errorDescription = "Please complete your profile setup with Twilio credentials before making calls.";
      }
      // Check for RLS policy violations
      else if (errorMessage.includes('row-level security policy') || 
          errorMessage.includes('violates row-level security') ||
          errorCode === 'CALL_LOG_ERROR') {
        errorTitle = "Database permission error";
        errorDescription = "There was an issue with database permissions. Please contact support.";
        console.log('RLS policy violation detected. Error details:', err);
      }
      // Twilio API errors
      else if (errorCode === 'TWILIO_API_ERROR' || errorMessage.includes('Twilio error')) {
        errorTitle = "Twilio API error";
        // Anonymize phone numbers in Twilio error messages if needed
        const shouldAnonymize = isAnonymizationEnabled();
        let cleanedMessage = errorMessage.replace('Twilio error: ', '');
        
        if (shouldAnonymize) {
          // Anonymize any phone numbers in the error message
          cleanedMessage = cleanedMessage.replace(
            /\+?1?\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g, 
            (match) => anonymizePhoneNumber(match)
          );
        }
        
        errorDescription = cleanedMessage;
      }
      
      setError(errorMessage);
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: variant,
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
