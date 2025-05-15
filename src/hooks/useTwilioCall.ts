import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';

export interface MakeCallParams {
  prospectId: string;
  phoneNumber?: string;
  campaignId?: string;
  agentConfigId?: string;
  userId?: string;
  bypassValidation?: boolean;
  debugMode?: boolean;
  voiceId?: string;
  useElevenLabsAgent?: boolean;
  elevenLabsAgentId?: string;
}

export interface CallResponse {
  success: boolean;
  message: string;
  callSid?: string;
  callLogId?: string;
  error?: string;
  code?: string;
}

export interface CallStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    call_status: string;
    duration?: string;
    timestamp?: string;
  };
  error?: string;
}

export function useTwilioCall() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const { session, user, profile } = useAuth();

  // Enhanced logging for authentication context
  console.log("[TwilioCall] Auth user:", user?.id);
  console.log("[TwilioCall] Auth session:", session?.user?.id);

  // Check for valid authentication with improved return types
  const checkAuthentication = useCallback((): string | false => {
    if (!session?.access_token) {
      console.error("[TwilioCall] No authentication token available");
      toast({
        title: "Authentication Error",
        description: "You must be logged in to make calls",
        variant: "destructive"
      });
      return false;
    }
    
    // Enhanced userId resolution from multiple possible sources
    const userId = user?.id || session?.user?.id;
    
    if (!userId) {
      console.error("[TwilioCall] No user ID available");
      toast({
        title: "Configuration Error",
        description: "User ID is required to make calls. Please refresh and try again.",
        variant: "destructive"
      });
      return false;
    }
    
    return userId;
  }, [session, user]);

  // Function to validate Twilio credentials without making a call
  const validateTwilioCredentials = useCallback(async (accountSid: string, authToken: string): Promise<boolean> => {
    try {
      console.log("[TwilioCall] Validating credentials with accountSid:", accountSid?.substring(0, 10) + "...");
      
      const { data, error } = await supabase.functions.invoke('verify-twilio-creds', {
        body: { 
          account_sid: accountSid,
          auth_token: authToken
        }
      });
      
      if (error) {
        console.error("[TwilioCall] Error invoking verify-twilio-creds:", error);
        toast({
          title: "Verification Error",
          description: `Failed to verify credentials: ${error.message}`,
          variant: "destructive"
        });
        return false;
      }
      
      if (!data?.success) {
        console.error("[TwilioCall] Invalid Twilio credentials:", data?.error || "Unknown error");
        toast({
          title: "Invalid Credentials",
          description: data?.error || "Your Twilio credentials appear to be invalid",
          variant: "destructive"
        });
        return false;
      }
      
      return true;
    } catch (err) {
      console.error("[TwilioCall] Unexpected error validating credentials:", err);
      toast({
        title: "Verification Error",
        description: err instanceof Error ? err.message : "Unknown error occurred",
        variant: "destructive"
      });
      return false;
    }
  }, []);

  const makeCall = async (params: MakeCallParams): Promise<CallResponse> => {
    // Enhanced user ID resolution with strict validation
    const userId = checkAuthentication();
    if (!userId) {
      return { success: false, message: "Authentication required" };
    }

    try {
      setIsLoading(true);
      console.log('[TwilioCall] Making call to prospect ID:', params.prospectId);
      console.log('[TwilioCall] Using user ID:', userId);

      // Enhanced parameter validation with clear error messages
      if (!params.prospectId) {
        throw new Error("Prospect ID is required");
      }
      
      if (!params.agentConfigId) {
        throw new Error("Agent configuration ID is required");
      }

      // Determine whether to use ElevenLabs agent or regular Twilio call
      if (params.useElevenLabsAgent && params.elevenLabsAgentId) {
        return await makeElevenLabsCall({
          ...params,
          userId: String(userId) // Ensure userId is passed as string
        });
      } else {
        // Skip validation if in bypass mode
        if (!params.bypassValidation) {
          // Do a quick check if the user has Twilio credentials set up
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
            .eq('id', userId)
            .maybeSingle();

          if (profileError) {
            console.error("[TwilioCall] Error fetching profile:", profileError);
            return {
              success: false,
              message: `Error fetching profile: ${profileError.message}`,
              error: profileError.message
            };
          }

          if (!profileData?.twilio_account_sid || !profileData?.twilio_auth_token) {
            console.error("[TwilioCall] Missing Twilio credentials");
            return {
              success: false,
              message: "Twilio credentials are not configured. Please update your profile with Twilio credentials.",
              code: "TWILIO_CONFIG_INCOMPLETE"
            };
          }

          if (!profileData?.twilio_phone_number) {
            console.error("[TwilioCall] Missing Twilio phone number");
            return {
              success: false,
              message: "Twilio phone number is not configured. Please update your profile with a Twilio phone number.",
              code: "TWILIO_CONFIG_INCOMPLETE"
            };
          }
          
          // Validate Twilio credentials
          const credentialsValid = await validateTwilioCredentials(
            profileData.twilio_account_sid,
            profileData.twilio_auth_token
          );
          
          if (!credentialsValid) {
            return {
              success: false,
              message: "Your Twilio credentials appear to be invalid. Please check your account SID and auth token.",
              code: "TWILIO_INVALID_CREDENTIALS"
            };
          }
        }

        // IMPROVED ERROR HANDLING: Add more detailed request logging
        console.log('[TwilioCall] Invoking twilio-make-call function with params:', {
          prospectId: params.prospectId,
          agent_config_id: params.agentConfigId,
          user_id: String(userId),
          bypass_validation: params.bypassValidation || false,
          debug_mode: params.debugMode || false,
          voice_id: params.voiceId ? params.voiceId.substring(0, 10) + "..." : undefined,
          use_webhook_proxy: true
        });

        const { data, error } = await supabase.functions.invoke('twilio-make-call', {
          body: {
            prospectId: params.prospectId,
            prospect_id: params.prospectId, // Include both formats for backward compatibility
            agent_config_id: params.agentConfigId,
            user_id: String(userId), // Always use the resolved userId as string
            bypass_validation: params.bypassValidation || false,
            debug_mode: params.debugMode || true, // Enable debug mode for better logging
            voice_id: params.voiceId,
            use_webhook_proxy: true // Always use the webhook proxy
          }
        });

        // IMPROVED ERROR HANDLING: More detailed error logging
        if (error) {
          console.error("[TwilioCall] Error making call:", error);
          console.error("[TwilioCall] Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
          });
          
          toast({
            title: "Call Error",
            description: `Failed to initiate call: ${error.message}`,
            variant: "destructive"
          });
          return {
            success: false,
            message: `Failed to initiate call: ${error.message}`,
            error: error.message
          };
        }

        console.log("[TwilioCall] Edge function response:", data);

        if (data?.callSid) {
          console.log("[TwilioCall] Call initiated successfully, SID:", data.callSid);
          setCurrentCallSid(data.callSid);
          toast({
            title: "Call Initiated",
            description: `Call has been initiated`,
            variant: "success"
          });
          return {
            success: true,
            message: "Call initiated successfully",
            callSid: data.callSid,
            callLogId: data.callLogId
          };
        } else if (data?.success === false) {
          // Handle specific error codes from the edge function
          console.error("[TwilioCall] Call failed with message:", data.message);
          toast({
            title: "Call Error",
            description: data.message || "Failed to initiate call",
            variant: "destructive"
          });
          return {
            success: false,
            message: data.message || "Failed to initiate call",
            code: data.code
          };
        } else {
          console.error("[TwilioCall] No call SID returned");
          toast({
            title: "Call Error",
            description: "Failed to initiate call: No call ID returned",
            variant: "destructive"
          });
          return {
            success: false,
            message: "Failed to initiate call: No call ID returned"
          };
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[TwilioCall] Unexpected error making call:", errorMessage);
      toast({
        title: "Call Error",
        description: `Unexpected error: ${errorMessage}`,
        variant: "destructive"
      });
      return {
        success: false,
        message: `Unexpected error: ${errorMessage}`,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  const makeElevenLabsCall = async (params: MakeCallParams): Promise<CallResponse> => {
    // Enhanced user ID resolution with multiple fallbacks
    const userId = params.userId || user?.id || session?.user?.id;
    if (!userId) {
      console.error("[TwilioCall] No user ID available for ElevenLabs call");
      return { success: false, message: "User ID is required" };
    }

    try {
      console.log("[TwilioCall] Making ElevenLabs call with agent ID:", params.elevenLabsAgentId);
      console.log("[TwilioCall] Using user ID:", userId);
      
      // Check if ElevenLabs API key is configured for user
      if (!params.bypassValidation) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('elevenlabs_api_key')
          .eq('id', userId)
          .maybeSingle();
          
        if (profileError) {
          console.error("[TwilioCall] Error fetching profile for ElevenLabs key:", profileError);
          return {
            success: false,
            message: `Error checking ElevenLabs setup: ${profileError.message}`,
            error: profileError.message
          };
        }
        
        if (!profileData?.elevenlabs_api_key) {
          console.error("[TwilioCall] ElevenLabs API key not configured");
          return {
            success: false,
            message: "ElevenLabs API key is not configured in your profile. Please add your ElevenLabs API key in your profile settings.",
            code: "ELEVENLABS_API_KEY_MISSING"
          };
        }
      }
      
      // Fetch the prospect details to get the phone number
      const { data: prospectData, error: prospectError } = await supabase
        .from('prospects')
        .select('phone_number, first_name, last_name')
        .eq('id', params.prospectId)
        .single();
        
      if (prospectError || !prospectData?.phone_number) {
        console.error("[TwilioCall] Error fetching prospect data:", prospectError);
        return {
          success: false,
          message: "Failed to fetch prospect phone number",
          error: prospectError?.message
        };
      }
      
      // Fetch the agent config for any prompt customization
      let agentConfig = null;
      if (params.agentConfigId) {
        const { data: configData } = await supabase
          .from('agent_configs')
          .select('*')
          .eq('id', params.agentConfigId)
          .single();
          
        if (configData) {
          agentConfig = configData;
        }
      }
      
      // Prepare the conversation config override
      let configOverride = {
        agent: {} as any,
        tts: {} as any
      };
      
      // Add voice ID if provided
      if (params.voiceId) {
        configOverride.tts.voice_id = params.voiceId;
      }
      
      // Add prompt and first message if available in agent config
      if (agentConfig?.system_prompt) {
        configOverride.agent.prompt = { prompt: agentConfig.system_prompt };
      }
      
      if (agentConfig?.first_message) {
        configOverride.agent.first_message = agentConfig.first_message;
      }
      
      // Make sure we set the input_format and output_format for telephony
      configOverride.agent.input_format = "mulaw_8000";
      configOverride.agent.output_format = "mulaw_8000";
      
      // Call the elevenlabs-outbound-call edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-outbound-call', {
        body: {
          agent_id: params.elevenLabsAgentId,
          to_number: prospectData.phone_number,
          user_id: userId, // Use the resolved userId
          prospect_id: params.prospectId, // Add for call_logs
          agent_config_id: params.agentConfigId, // Add for call_logs
          dynamic_variables: {
            prospect_name: prospectData.first_name || 'Prospect',
            prospect_id: params.prospectId
          },
          conversation_config_override: configOverride
        }
      });
      
      if (error) {
        console.error("[TwilioCall] Error making ElevenLabs call:", error);
        return {
          success: false,
          message: `Failed to initiate ElevenLabs call: ${error.message}`,
          error: error.message
        };
      }
      
      if (data?.success) {
        console.log("[TwilioCall] ElevenLabs call initiated successfully, SID:", data.callSid);
        if (data.callSid) {
          setCurrentCallSid(data.callSid);
        }
        
        toast({
          title: "ElevenLabs Call Initiated",
          description: "Call has been initiated via ElevenLabs",
          variant: "success"
        });
        
        return {
          success: true,
          message: "ElevenLabs call initiated successfully",
          callSid: data.callSid,
          callLogId: data.callLogId
        };
      } else {
        console.error("[TwilioCall] ElevenLabs call failed:", data?.message);
        return {
          success: false,
          message: data?.message || "Failed to initiate ElevenLabs call",
          code: data?.code
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[TwilioCall] Unexpected error making ElevenLabs call:", errorMessage);
      return {
        success: false,
        message: `Unexpected error with ElevenLabs call: ${errorMessage}`,
        error: errorMessage
      };
    }
  };

  // Add makeDevelopmentCall function for development/testing purposes
  const makeDevelopmentCall = async (params: MakeCallParams): Promise<CallResponse> => {
    if (!session?.access_token) {
      console.error("[TwilioCall:Dev] No authentication token available");
      return { success: false, message: "Authentication required" };
    }

    // Enhanced user ID resolution with better error handling
    const userId = params.userId || user?.id || session?.user?.id;
    
    if (!userId) {
      console.error("[TwilioCall:Dev] No user ID available");
      toast({
        title: "Configuration Error", 
        description: "User ID is required to make calls. Please refresh and try again.",
        variant: "destructive"
      });
      return { success: false, message: "User ID is required" };
    }

    try {
      setIsLoading(true);
      console.log("[TwilioCall:Dev] Making development call to prospect ID:", params.prospectId);
      console.log("[TwilioCall:Dev] Using user ID:", userId);

      // Validate parameters
      if (!params.prospectId) {
        throw new Error("Prospect ID is required");
      }
      
      if (!params.agentConfigId) {
        throw new Error("Agent configuration ID is required");
      }

      if (params.useElevenLabsAgent && params.elevenLabsAgentId) {
        return await makeElevenLabsCall({
          ...params,
          bypassValidation: true,
          debugMode: params.debugMode || true,
          userId // Ensure userId is passed
        });
      } else {
        // For development calls, add debugging flags and more detailed logging
        console.log("[TwilioCall:Dev] Invoking twilio-make-call with parameters:", {
          prospect_id: params.prospectId,
          agent_config_id: params.agentConfigId,
          user_id: String(userId),
          bypass_validation: true,
          debug_mode: true,
          voice_id: params.voiceId?.substring(0, 10) + "...",
          use_webhook_proxy: true
        });

        const { data, error } = await supabase.functions.invoke('twilio-make-call', {
          body: {
            prospectId: params.prospectId,
            prospect_id: params.prospectId, // Include both formats for backward compatibility
            agent_config_id: params.agentConfigId,
            user_id: String(userId), // Always convert to string
            bypass_validation: true,
            debug_mode: true, // For development calls, always set debug mode
            voice_id: params.voiceId,
            use_webhook_proxy: true // CRITICAL: Always use the webhook proxy
          }
        });

        // Enhanced error logging for development calls
        if (error) {
          console.error("[TwilioCall:Dev] Error making development call:", error);
          console.error("[TwilioCall:Dev] Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
          });
          
          toast({
            title: "Development Call Error",
            description: `Failed to initiate development call: ${error.message}`,
            variant: "destructive"
          });
          
          return {
            success: false,
            message: `Failed to initiate development call: ${error.message}`,
            error: error.message
          };
        }

        console.log("[TwilioCall:Dev] Edge function response:", data);

        if (data?.callSid) {
          console.log("[TwilloCall:Dev] Development call initiated successfully, SID:", data.callSid);
          setCurrentCallSid(data.callSid);
          
          toast({
            title: "Development Call Initiated",
            description: `Call has been initiated in development mode`,
            variant: "success"
          });
          
          return {
            success: true,
            message: "Development call initiated successfully",
            callSid: data.callSid,
            callLogId: data.callLogId
          };
        } else if (data?.success === false) {
          // Handle specific error codes from the edge function
          console.error("[TwilioCall:Dev] Call failed with message:", data.message);
          console.error("[TwilioCall:Dev] Error code:", data.code);
          
          toast({
            title: "Development Call Error",
            description: data.message || "Failed to initiate development call",
            variant: "destructive"
          });
          
          return {
            success: false,
            message: data.message || "Failed to initiate development call",
            code: data.code
          };
        } else {
          console.error("[TwilloCall:Dev] No call SID returned");
          
          toast({
            title: "Development Call Error",
            description: "Failed to initiate development call: No call ID returned",
            variant: "destructive"
          });
          
          return {
            success: false,
            message: "Failed to initiate development call: No call ID returned"
          };
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[TwilioCall:Dev] Unexpected error making development call:", errorMessage);
      
      toast({
        title: "Development Call Error",
        description: `Unexpected error: ${errorMessage}`,
        variant: "destructive"
      });
      
      return {
        success: false,
        message: `Unexpected error: ${errorMessage}`,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Add verifyCallStatus function to check the status of a call
  const verifyCallStatus = async (callSid: string): Promise<CallStatusResponse> => {
    if (!callSid) {
      return {
        success: false,
        message: "No call SID provided"
      };
    }
    
    try {
      console.log("[TwilioCall] Verifying status for call SID:", callSid);
      
      const { data, error } = await supabase.functions.invoke('twilio-call-status', {
        body: { 
          call_sid: callSid,
          user_id: user?.id // Also pass user ID for accessing Twilio credentials
        }
      });

      if (error) {
        console.error("[TwilioCall] Error verifying call status:", error);
        return {
          success: false,
          message: `Failed to verify call status: ${error.message}`,
          error: error.message
        };
      }

      if (data?.status) {
        console.log("[TwilioCall] Call status verified:", data.status);
        return {
          success: true,
          data: {
            call_status: data.status,
            duration: data.duration,
            timestamp: data.timestamp
          }
        };
      } else {
        console.error("[TwilioCall] No call status returned");
        return {
          success: false,
          message: "Failed to verify call status: No status returned"
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[TwilioCall] Unexpected error verifying call status:", errorMessage);
      return {
        success: false,
        message: `Unexpected error: ${errorMessage}`,
        error: errorMessage
      };
    }
  };

  const endCurrentCall = async (callSid?: string): Promise<CallResponse> => {
    const sidToEnd = callSid || currentCallSid;
    
    if (!sidToEnd) {
      console.error("[TwilioCall] No call SID provided to end call");
      return { success: false, message: "No active call to end" };
    }

    try {
      setIsLoading(true);
      console.log("[TwilioCall] Ending call with SID:", sidToEnd);

      const { data, error } = await supabase.functions.invoke('twilio-end-call', {
        body: { 
          call_sid: sidToEnd,
          user_id: user?.id // Added user ID for accessing Twilio credentials
        }
      });

      if (error) {
        console.error("[TwilioCall] Error ending call:", error);
        toast({
          title: "Call Error",
          description: `Failed to end call: ${error.message}`,
          variant: "destructive"
        });
        return {
          success: false,
          message: `Failed to end call: ${error.message}`,
          error: error.message
        };
      }

      if (data?.success) {
        console.log("[TwilioCall] Call ended successfully");
        
        if (sidToEnd === currentCallSid) {
          setCurrentCallSid(null);
        }
        
        toast({
          title: "Call Ended",
          description: "Call has been ended successfully",
          variant: "success"
        });
        return {
          success: true,
          message: "Call ended successfully"
        };
      } else {
        console.error("[TwilioCall] Failed to end call:", data?.message);
        toast({
          title: "Call Error",
          description: data?.message || "Failed to end the call",
          variant: "destructive"
        });
        return {
          success: false,
          message: data?.message || "Failed to end the call"
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[TwilioCall] Unexpected error ending call:", errorMessage);
      toast({
        title: "Call Error",
        description: `Unexpected error ending call: ${errorMessage}`,
        variant: "destructive"
      });
      return {
        success: false,
        message: `Unexpected error: ${errorMessage}`,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    makeCall,
    makeDevelopmentCall,
    verifyCallStatus,
    endCurrentCall,
    currentCallSid,
    isLoading
  };
}
