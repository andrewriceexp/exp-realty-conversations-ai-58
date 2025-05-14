
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';

interface TwilioCallOptions {
  prospectId: string;
  agentConfigId: string;
  userId: string;
  bypassValidation?: boolean;
  debugMode?: boolean;
  voiceId?: string;
  useElevenLabsAgent?: boolean;
  elevenLabsAgentId?: string;
}

interface TwilioCallResponse {
  success: boolean;
  message?: string;
  callSid?: string;
  callLogId?: string;
  data?: any;
  error?: any;
  code?: string;
}

export function useTwilioCall() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Make a call to a prospect using Twilio
   */
  const makeCall = async (options: TwilioCallOptions): Promise<TwilioCallResponse> => {
    setIsLoading(true);
    try {
      console.log('Making call with:', options);
      
      // Anonymize logs for privacy if needed
      const phoneDisplay = isAnonymizationEnabled() ? '[REDACTED]' : 'prospect with phone';
      console.log(`Attempting to call prospect with phone: ${phoneDisplay}`);
      
      console.log('Initiating call with options:', {
        ...options,
        // Truncate voiceId for security/privacy in logs
        voiceId: options.voiceId ? `${options.voiceId.substring(0, 8)}...` : undefined
      });
      
      // If using ElevenLabs agent, use the new edge function
      if (options.useElevenLabsAgent && options.elevenLabsAgentId) {
        console.log(`Using ElevenLabs agent: ${options.elevenLabsAgentId}`);
        
        // Add a more robust timeout to the Supabase function call
        const timeoutPromise = new Promise<TwilioCallResponse>((_, reject) => 
          setTimeout(() => reject(new Error("ElevenLabs call request timed out")), 15000)
        );
        
        // Get prospect info to get the phone number
        const { data: prospectData, error: prospectError } = await supabase
          .from('prospects')
          .select('phone_number, first_name, last_name')
          .eq('id', options.prospectId)
          .single();
          
        if (prospectError || !prospectData) {
          throw new Error(`Could not find prospect with ID: ${options.prospectId}`);
        }
        
        // Make the actual API call to our ElevenLabs edge function
        const fetchPromise = supabase.functions.invoke('elevenlabs-outbound-call', {
          body: {
            agent_id: options.elevenLabsAgentId,
            to_number: prospectData.phone_number,
            user_id: options.userId,
            dynamic_variables: {
              user_name: `${prospectData.first_name} ${prospectData.last_name}`.trim()
            },
            conversation_config_override: options.voiceId ? {
              tts: {
                voice_id: options.voiceId
              }
            } : undefined
          }
        }).then(({data, error}) => {
          if (error) throw error;
          return data;
        });
        
        // Race the timeout against the actual request
        const data = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!data?.success) {
          throw new Error(data?.message || 'Failed to initiate call');
        }
        
        console.log('ElevenLabs call response:', data);
        
        return {
          success: true,
          message: data.message || 'ElevenLabs call initiated successfully',
          callSid: data.callSid,
          callLogId: data.callLogId
        };
      } else {
        // Use the regular Twilio edge function for non-ElevenLabs calls
        // Add a more robust timeout to the Supabase function call
        const timeoutPromise = new Promise<TwilioCallResponse>((_, reject) => 
          setTimeout(() => reject(new Error("Twilio call request timed out")), 15000)
        );
        
        // Make the actual API call
        const fetchPromise = supabase.functions.invoke('twilio-make-call', {
          body: options
        }).then(({data, error}) => {
          if (error) throw error;
          return data;
        });
        
        // Race the timeout against the actual request
        const data = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!data?.success) {
          throw new Error(data?.message || 'Failed to initiate call');
        }
        
        console.log('Edge function response:', data);
        console.log('Call initiated successfully:', {
          callSid: data.callSid,
          callLogId: data.callLogId,
          message: data.message
        });
        
        return {
          success: true,
          message: data.message || 'Call initiated successfully',
          callSid: data.callSid,
          callLogId: data.callLogId
        };
      }
    } catch (error: any) {
      console.error('Call initiation error:', error);
      
      // Improved error handling
      let errorMessage = 'Failed to initiate call';
      let errorCode = 'CALL_ERROR';
      
      if (error.message) {
        errorMessage = error.message;
        
        // Detect specific error types for better user feedback
        if (error.message.includes('trial account')) {
          errorCode = 'TWILIO_TRIAL_ACCOUNT';
        } else if (error.message.includes('ElevenLabs API key')) {
          errorCode = 'ELEVENLABS_API_KEY_MISSING';
        } else if (error.message.includes('timed out')) {
          errorCode = 'REQUEST_TIMEOUT';
          toast({
            variant: "destructive",
            title: "Request Timeout",
            description: "The call request timed out. Please check your internet connection and try again."
          });
        }
      }
      
      return {
        success: false,
        message: errorMessage,
        error: error,
        code: errorCode
      };
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Make a development call (bypassing validation) to a prospect using Twilio
   * This is similar to makeCall but explicitly sets the bypassValidation flag
   */
  const makeDevelopmentCall = async (options: TwilioCallOptions): Promise<TwilioCallResponse> => {
    return makeCall({
      ...options,
      bypassValidation: true,
      // Always enable debug mode for development calls to help troubleshoot
      debugMode: true
    });
  };
  
  /**
   * Verify the status of a call using its SID
   * This function checks the current status of a Twilio call
   */
  const verifyCallStatus = async (callSid: string, userId?: string): Promise<TwilioCallResponse> => {
    try {
      console.log('Checking status for call:', callSid);
      
      // Add a timeout to the status check
      const timeoutPromise = new Promise<TwilioCallResponse>((_, reject) => 
        setTimeout(() => reject(new Error("Status check timed out")), 10000)
      );
      
      // Make the actual API call
      const fetchPromise = supabase.functions.invoke('twilio-call-status', {
        body: {
          callSid,
          userId
        }
      }).then(({data, error}) => {
        if (error) {
          console.log("Error from status check edge function:", error);
          throw error;
        }
        return data;
      });
      
      // Race the timeout against the actual request
      const data = await Promise.race([fetchPromise, timeoutPromise]);
      
      // If no data is returned, the call might have failed or been disconnected
      if (!data) {
        return {
          success: false,
          message: 'Failed to get call status - no data returned',
          error: new Error('No data returned from status check')
        };
      }
      
      console.log('Call status data:', data);
      
      return {
        success: true,
        message: `Call status: ${data?.call_status || 'unknown'}`,
        data: data
      };
    } catch (error: any) {
      console.error('Error verifying call status:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to verify call status',
        error: error
      };
    }
  };
  
  // Handle TwiML timeout errors
  const handleTwiMLTimeout = () => {
    toast({
      variant: "destructive",
      title: "Call Processing Error",
      description: "The call timed out while waiting for a response. Please try again with Development Mode enabled."
    });
  };
  
  return {
    makeCall,
    makeDevelopmentCall,
    verifyCallStatus,
    handleTwiMLTimeout,
    isLoading
  };
}
