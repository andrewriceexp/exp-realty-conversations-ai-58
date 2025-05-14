
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
      throw new Error("ElevenLabs API key not configured in your profile");
    }
    
    // Make the outbound call request to ElevenLabs
    console.log("Making request to ElevenLabs Conversational AI API");
    const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": profile.elevenlabs_api_key
      },
      body: JSON.stringify({
        agent_id,
        to_number,
        conversation_initiation_client_data: {
          dynamic_variables: dynamic_variables || {},
          conversation_config_override: {
            ...conversation_config_override,
            agent: {
              ...conversation_config_override?.agent,
              // Ensure audio format is set for telephony
              input_format: "mulaw_8000",
              output_format: "mulaw_8000"
            }
          }
        }
      })
    });
    
    // Enhanced error handling
    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch {
        const errorText = await response.text();
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Create call log with more details
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
          dynamic_variables,
          conversation_config_override,
          audio_format: {
            input: "mulaw_8000",
            output: "mulaw_8000"
          }
        }
      }])
      .select()
      .single();
      
    if (callLogError) {
      console.error("Error creating call log:", callLogError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Outbound call initiated successfully",
        callSid: data.callSid,
        callLogId: callLog?.id
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
