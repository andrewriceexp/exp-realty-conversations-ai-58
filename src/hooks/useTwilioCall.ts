
import { useState, useCallback, useEffect } from 'react';
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
  const [callInProgress, setCallInProgress] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const [currentCallLogId, setCurrentCallLogId] = useState<string | null>(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState<number | null>(null);

  // Cleanup function for any active intervals
  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [statusCheckInterval]);

  /**
   * Make a call to a prospect using Twilio
   */
  const makeCall = async (options: TwilioCallOptions): Promise<TwilioCallResponse> => {
    if (callInProgress) {
      return {
        success: false,
        message: "A call is already in progress. Please wait for it to complete or check its status.",
        code: "CALL_IN_PROGRESS"
      };
    }
    
    setIsLoading(true);
    try {
      console.log('Making call with:', {
        ...options,
        // Redact sensitive info for logs
        voiceId: options.voiceId ? `${options.voiceId.substring(0, 8)}...` : undefined
      });
      
      // Anonymize logs for privacy if needed
      const phoneDisplay = isAnonymizationEnabled() ? '[REDACTED]' : 'prospect with phone';
      console.log(`Attempting to call ${phoneDisplay}`);
      
      // If using ElevenLabs agent, use the elevenlabs-outbound-call edge function
      if (options.useElevenLabsAgent && options.elevenLabsAgentId) {
        console.log(`Using ElevenLabs agent: ${options.elevenLabsAgentId}`);
        
        // Get prospect info to get the phone number
        const { data: prospectData, error: prospectError } = await supabase
          .from('prospects')
          .select('phone_number, first_name, last_name')
          .eq('id', options.prospectId)
          .single();
          
        if (prospectError || !prospectData) {
          throw new Error(`Could not find prospect with ID: ${options.prospectId}`);
        }
        
        // Add a more robust timeout to the Supabase function call
        const timeoutPromise = new Promise<TwilioCallResponse>((_, reject) => 
          setTimeout(() => reject(new Error("ElevenLabs call request timed out")), 30000) // Increased timeout
        );
        
        // Make the actual API call to our ElevenLabs edge function
        const fetchPromise = supabase.functions.invoke('elevenlabs-outbound-call', {
          body: {
            agent_id: options.elevenLabsAgentId,
            to_number: prospectData.phone_number,
            user_id: options.userId,
            dynamic_variables: {
              user_name: `${prospectData.first_name || ''} ${prospectData.last_name || ''}`.trim() || 'there'
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
        setCallInProgress(true);
        setCurrentCallSid(data.callSid || null);
        setCurrentCallLogId(data.callLogId || null);
        
        // Set up automatic status checking
        setupStatusChecking(data.callSid, options.userId);
        
        toast({
          title: "Call initiated",
          description: "Your ElevenLabs AI agent is now calling the prospect.",
          variant: "success"
        });
        
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
          setTimeout(() => reject(new Error("Twilio call request timed out")), 30000) // Increased timeout
        );
        
        // Make the actual API call
        const fetchPromise = supabase.functions.invoke('twilio-make-call', {
          body: options
        }).then(({data, error}) => {
          if (error) {
            console.error("Edge function error:", error);
            throw new Error(error.message || "Edge function returned an error");
          }
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
        
        setCallInProgress(true);
        setCurrentCallSid(data.callSid || null);
        setCurrentCallLogId(data.callLogId || null);
        
        // Set up automatic status checking
        setupStatusChecking(data.callSid, options.userId);
        
        toast({
          title: "Call initiated",
          description: "Calling the prospect now. You can monitor the call status here.",
          variant: "success"
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
          errorMessage = 'Your Twilio trial account can only call verified numbers. Please verify the number in your Twilio console or upgrade your account.';
        } else if (error.message.includes('ElevenLabs API key')) {
          errorCode = 'ELEVENLABS_API_KEY_MISSING';
          errorMessage = 'ElevenLabs API key is missing or invalid. Please check your profile settings.';
        } else if (error.message.includes('timed out')) {
          errorCode = 'REQUEST_TIMEOUT';
          errorMessage = 'The call request timed out. Please check your internet connection and try again.';
        }
      }
      
      toast({
        variant: "destructive",
        title: "Call Failed",
        description: errorMessage
      });
      
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
   * Sets up an interval to check call status periodically
   */
  const setupStatusChecking = useCallback((callSid: string, userId?: string) => {
    // Clear any existing interval
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }
    
    // Set up a new interval to check status every 5 seconds
    const intervalId = window.setInterval(async () => {
      try {
        const statusResult = await verifyCallStatus(callSid, userId);
        if (!statusResult.success || 
            !statusResult.data?.call_status || 
            ['completed', 'failed', 'canceled', 'busy', 'no-answer'].includes(statusResult.data.call_status.toLowerCase())) {
          // Call has ended or failed, clear the interval
          clearInterval(intervalId);
          setStatusCheckInterval(null);
          
          // Update the UI state
          setCallInProgress(false);
          setCurrentCallSid(null);
          
          // Show a toast with the result
          if (statusResult.success) {
            const status = statusResult.data.call_status.toLowerCase();
            if (status === 'completed') {
              toast({
                title: "Call completed",
                description: "The call has ended successfully.",
                variant: "success"
              });
            } else {
              toast({
                title: `Call ${status}`,
                description: status === 'failed' ? 
                  "There was a problem with the call. Please check the logs for details." : 
                  `The call has ended with status: ${status}`,
                variant: status === 'failed' ? "destructive" : "warning"
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking call status:", error);
      }
    }, 5000);
    
    // Save the interval ID for cleanup later
    setStatusCheckInterval(intervalId);
    
    return intervalId;
  }, [statusCheckInterval]);
  
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
  const verifyCallStatus = async (callSid?: string, userId?: string): Promise<TwilioCallResponse> => {
    const sidToCheck = callSid || currentCallSid;
    
    if (!sidToCheck) {
      return {
        success: false,
        message: 'No call SID provided or available',
        error: new Error('Missing call SID')
      };
    }
    
    try {
      console.log('Checking status for call:', sidToCheck);
      
      // Add a timeout to the status check
      const timeoutPromise = new Promise<TwilioCallResponse>((_, reject) => 
        setTimeout(() => reject(new Error("Status check timed out")), 15000) // Keep reasonable timeout
      );
      
      // Make the actual API call - pass userId if available
      const fetchPromise = supabase.functions.invoke('twilio-call-status', {
        body: {
          callSid: sidToCheck,
          userId
        }
      }).then(({data, error}) => {
        if (error) {
          console.error("Error from status check edge function:", error);
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
      
      // If call is completed or failed, update our state
      const finalStatuses = ['completed', 'failed', 'canceled', 'busy', 'no-answer'];
      if (data.call_status && finalStatuses.includes(data.call_status.toLowerCase())) {
        setCallInProgress(false);
        setCurrentCallSid(null);
      }
      
      return {
        success: data.success || false,
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
  
  /**
   * End the current call if it's in progress
   */
  const endCurrentCall = async (): Promise<TwilioCallResponse> => {
    if (!callInProgress || !currentCallSid) {
      return {
        success: false,
        message: 'No active call to end',
      };
    }
    
    try {
      const result = await supabase.functions.invoke('twilio-end-call', {
        body: {
          callSid: currentCallSid
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      setCallInProgress(false);
      setCurrentCallSid(null);
      
      // Clear any status checking interval
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
      
      toast({
        title: "Call ended",
        description: "You've ended the call successfully.",
        variant: "success"
      });
      
      return {
        success: true,
        message: 'Call ended successfully',
        data: result.data
      };
    } catch (error: any) {
      console.error('Error ending call:', error);
      
      toast({
        variant: "destructive",
        title: "Error Ending Call",
        description: error.message || "Failed to end the call. It may have already ended."
      });
      
      return {
        success: false,
        message: error.message || 'Failed to end call',
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
    endCurrentCall,
    handleTwiMLTimeout,
    isLoading,
    callInProgress,
    currentCallSid,
    currentCallLogId
  };
}
