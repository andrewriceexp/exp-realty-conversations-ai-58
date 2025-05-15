
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log(`Function "elevenlabs-outbound-call" up and running!`);

interface OutboundCallRequest {
  agent_id: string;
  to_number: string;
  user_id: string;
  dynamic_variables?: Record<string, any>;
  conversation_config_override?: {
    agent?: {
      prompt?: { prompt: string };
      first_message?: string;
      language?: string;
      input_format?: string;
      output_format?: string;
    };
    tts?: {
      voice_id?: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const requestBody = await req.json();
    const { agent_id, to_number, user_id, dynamic_variables, conversation_config_override } = requestBody as OutboundCallRequest;

    // Validate required fields
    if (!agent_id) throw new Error("Agent ID is required");
    if (!to_number) throw new Error("Phone number is required");
    if (!user_id) throw new Error("User ID is required");

    console.log(`Initiating outbound call to ${to_number.substring(0, 6)}xxxx with agent ${agent_id}`);

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseAdminKey) {
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseAdminKey);
    
    // Get user's ElevenLabs API key
    console.log(`Fetching user profile for ID: ${user_id}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('elevenlabs_api_key')
      .eq('id', user_id)
      .single();
      
    if (profileError || !profile?.elevenlabs_api_key) {
      console.error("Error fetching profile or missing API key:", profileError);
      throw new Error("ElevenLabs API key not configured in your profile");
    }
    
    // Prepare the payload for ElevenLabs API
    const payload = {
      agent_id,
      to_number,
      conversation_initiation_client_data: {
        dynamic_variables: dynamic_variables || {},
        conversation_config_override: {
          agent: {
            ...conversation_config_override?.agent,
            // Always ensure telephony audio formats are set for optimal call quality
            input_format: "mulaw_8000",
            output_format: "mulaw_8000"
          },
          tts: conversation_config_override?.tts || {}
        }
      }
    };
    
    // Log configuration (without sensitive data)
    console.log("Call configuration:", {
      agent_id,
      dynamic_variables: dynamic_variables ? "Provided" : "Not provided",
      voice_override: conversation_config_override?.tts?.voice_id ? "Custom voice provided" : "Using default voice",
      audio_format: "mulaw_8000 (optimized for telephony)"
    });
    
    // Make the outbound call request to ElevenLabs with retries
    let response;
    let retries = 0;
    const MAX_RETRIES = 2;
    
    while (retries <= MAX_RETRIES) {
      try {
        console.log(`Making request to ElevenLabs API (attempt ${retries + 1})`);
        response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": profile.elevenlabs_api_key
          },
          body: JSON.stringify(payload)
        });
        
        // If successful, break out of retry loop
        if (response.ok) break;
        
        // If rate limited, wait and retry
        if (response.status === 429) {
          retries++;
          if (retries <= MAX_RETRIES) {
            console.log(`Rate limited, waiting before retry ${retries}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * retries));
            continue;
          }
        }
        
        // Get detailed error information
        let errorDetails;
        try {
          errorDetails = await response.json();
          console.error("ElevenLabs API error details:", errorDetails);
        } catch (parseError) {
          console.error("Could not parse error response", parseError);
          errorDetails = { message: await response.text() };
        }
        
        // For other errors, throw and capture below
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorDetails.message || errorDetails.detail || "Unknown error"}`);
      } catch (error) {
        if (retries >= MAX_RETRIES) throw error;
        retries++;
        console.log(`Error making request, retry ${retries}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Double-check for response
    if (!response || !response.ok) {
      let errorMessage = "Failed to connect to ElevenLabs API";
      if (response) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || `Error code: ${response.status}`;
        } catch {
          errorMessage = `ElevenLabs API error: ${response.status}`;
        }
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Create comprehensive call log with more details
    const { data: callLog, error: callLogError } = await supabase
      .from('call_logs')
      .insert([{
        user_id,
        status: 'initiated',
        twilio_call_sid: data.callSid || null,
        agent_id,
        to_number,
        started_at: new Date().toISOString(),
        metadata: {
          agent_id,
          dynamic_variables,
          conversation_config_override,
          audio_format: {
            input: "mulaw_8000",
            output: "mulaw_8000"
          },
          api_version: "v1",
          call_type: "outbound_elevenlabs"
        }
      }])
      .select();
      
    if (callLogError) {
      console.error("Error creating call log:", callLogError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Outbound call initiated successfully",
        callSid: data.callSid,
        callLogId: callLog?.[0]?.id,
        conversationId: data.conversationId || null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("Error in elevenlabs-outbound-call:", error);
    
    // Enhanced error classification
    let errorCode = "GENERAL_ERROR";
    let status = 200; // Keep 200 to prevent client errors
    
    if (error.message?.includes("ElevenLabs API key")) {
      errorCode = "ELEVENLABS_API_KEY_MISSING";
    } else if (error.message?.includes("timed out")) {
      errorCode = "REQUEST_TIMEOUT";
    } else if (error.message?.includes("rate limit")) {
      errorCode = "RATE_LIMIT_EXCEEDED";
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "An error occurred while making the outbound call",
        code: errorCode
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
