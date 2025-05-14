
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { anonymizePhoneNumber, isAnonymizationEnabled } from '@/utils/anonymizationUtils';

export interface CallOptions {
  prospectId: string;
  agentConfigId: string;
  userId: string;
  bypassValidation?: boolean;
  debugMode?: boolean;
  voiceId?: string; // ElevenLabs voice selection
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
      console.log('Initiating call with options:', {
        ...options,
        voiceId: options.voiceId ? `${options.voiceId.substring(0, 8)}...` : undefined
      });
      
      // Make API call to Supabase Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke('twilio-make-call', {
        body: options,
      });
      
      console.log('Edge function response:', data);
      
      if (invokeError) {
        console.error('Edge function error:', invokeError);
        
        // Extract the actual error from Supabase Edge Function
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
            // Try to extract more details from the error
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
      
      if (data.error && !data.success) {
        console.error('Error data from edge function:', data);
        const err = new Error(data.error);
        if (data.code) {
          (err as any).code = data.code;
        }
        throw err;
      }
      
      if (data.success) {
        // Enhanced toast message with more details
        let toastDescription = "The AI agent is now calling the prospect.";
        
        if (data.callSid) {
          const anonymize = isAnonymizationEnabled();
          const phoneIdentifier = anonymize ? "prospect" : `prospect at ${options.prospectId}`;
          toastDescription = `Call initiated to ${phoneIdentifier}. Call SID: ${data.callSid.substring(0, 8)}...`;
        }
        
        // Add debug info if in debug mode
        if (options.debugMode) {
          toastDescription += " (Debug mode active)";
        }
        
        // Show an enhanced success toast
        toast({
          title: "Call initiated",
          description: data.message || toastDescription,
          variant: "default",
        });
        
        // Log additional details about the call for debugging
        console.log('Call initiated successfully:', {
          callSid: data.callSid,
          callLogId: data.callLogId,
          message: data.message
        });
        
        // Add a follow-up toast with instructions for any observed issues
        setTimeout(() => {
          toast({
            title: "Waiting for call",
            description: "If you don't receive the call within 30 seconds, check your phone's blocked numbers or Twilio account limits.",
            variant: "default",
          });
        }, 5000); // Show follow-up toast after 5 seconds
        
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
          errorMessage.includes('Please visit your profile settings') ||
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
      // Check for missing ElevenLabs API key
      else if (errorCode === 'ELEVENLABS_API_KEY_MISSING' || 
               errorMessage.includes('ElevenLabs API key')) {
        errorTitle = "ElevenLabs API key missing";
        errorDescription = "Please add your ElevenLabs API key in the profile settings to use custom voices.";
      }
      // Twilio API errors
      else if (errorCode === 'TWILIO_API_ERROR' || errorMessage.includes('Twilio error')) {
        errorTitle = "Twilio API error";
        // Check for trial account specific errors
        if (errorMessage.includes('trial') || errorMessage.includes('Trial')) {
          errorTitle = "Twilio Trial Account";
          errorDescription = "Your Twilio trial account has limitations. For full functionality, please upgrade your Twilio account.";
        } else {
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
      }
      // New error case for phone number verification
      else if (errorMessage.includes('verify') || errorMessage.includes('verification') || errorCode === 'PHONE_VERIFICATION_FAILED') {
        errorTitle = "Phone number verification required";
        errorDescription = "Your Twilio account may require phone number verification before making outbound calls.";
      }
      // New error case for recipient not answering
      else if (errorMessage.includes('no-answer') || errorMessage.includes('busy') || errorCode === 'NO_ANSWER') {
        errorTitle = "Call not answered";
        errorDescription = "The call was placed but the recipient didn't answer. Please try again later.";
      }
      
      setError(errorMessage);
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: variant,
      });
      
      // Add a more detailed console log
      console.error('Call failed with additional details:', {
        errorCode,
        errorTitle,
        errorDescription,
        originalError: err
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

  const makeDevelopmentCall = async (options: CallOptions): Promise<CallResponse> => {
    // Add bypass_validation flag for development testing
    return makeCall({
      ...options,
      bypassValidation: true,
      debugMode: options.debugMode ?? true  // Enable debug mode for development calls by default
    });
  };

  const verifyCallStatus = async (callSid: string): Promise<any> => {
    try {
      console.log(`Checking status for call: ${callSid}`);
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('twilio_call_sid', callSid)
        .single();
        
      if (error) {
        console.error('Error fetching call status:', error);
        return { success: false, error: error.message };
      }
      
      console.log('Call status data:', data);
      return { success: true, data };
    } catch (err) {
      console.error('Error verifying call status:', err);
      return { success: false, error: String(err) };
    }
  };

  return {
    makeCall,
    makeDevelopmentCall,
    verifyCallStatus, // Add this new function
    isLoading,
    error,
  };
}
