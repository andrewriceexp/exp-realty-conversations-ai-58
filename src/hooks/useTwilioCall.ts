
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface MakeCallParams {
  prospectId: string;
  phoneNumber: string;
  campaignId?: string;
  agentConfigId?: string;
}

export interface CallResponse {
  success: boolean;
  message: string;
  callSid?: string;
  error?: string;
}

export function useTwilioCall() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const { session } = useAuth();

  const makeCall = async (params: MakeCallParams): Promise<CallResponse> => {
    if (!session?.access_token) {
      console.error("[TwilioCall] No authentication token available");
      toast({
        title: "Authentication Error",
        description: "You must be logged in to make calls",
        variant: "destructive"
      });
      return { success: false, message: "Authentication required" };
    }

    try {
      setIsLoading(true);
      console.log("[TwilioCall] Making call to:", params.phoneNumber);

      const { data, error } = await supabase.functions.invoke('twilio-make-call', {
        body: {
          prospect_id: params.prospectId,
          phone_number: params.phoneNumber,
          campaign_id: params.campaignId,
          agent_config_id: params.agentConfigId
        }
      });

      if (error) {
        console.error("[TwilioCall] Error making call:", error);
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

      if (data?.callSid) {
        console.log("[TwilioCall] Call initiated successfully, SID:", data.callSid);
        setCurrentCallSid(data.callSid);
        toast({
          title: "Call Initiated",
          description: `Call to ${params.phoneNumber} has been initiated`,
          variant: "success"
        });
        return {
          success: true,
          message: "Call initiated successfully",
          callSid: data.callSid
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
        body: { call_sid: sidToEnd }
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
    endCurrentCall,
    currentCallSid,
    isLoading
  };
}
