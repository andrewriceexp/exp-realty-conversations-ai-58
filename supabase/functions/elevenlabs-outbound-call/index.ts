
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log(`Function "elevenlabs-outbound-call" up and running!`);

interface OutboundCallRequest {
  agent_id: string;
  to_number: string;
  user_id: string;
  dynamic_variables?: Record<string, any>;
  conversation_config_override?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Parse and validate request body
    const requestBody = await req.json();
    const { agent_id, to_number, user_id, dynamic_variables, conversation_config_override } = requestBody as OutboundCallRequest;

    if (!agent_id) {
      throw new Error("Agent ID is required");
    }
    
    if (!to_number) {
      throw new Error("Phone number is required");
    }

    if (!user_id) {
      throw new Error("User ID is required");
    }

    console.log(`Making outbound call to ${to_number.substring(0, 6)}xxxx with agent ${agent_id}`);

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseAdminKey) {
      throw new Error("Missing Supabase configuration. Please check your environment variables.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseAdminKey);
    
    // Get user's ElevenLabs API key from profile
    console.log(`Fetching user profile for ID: ${user_id}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('elevenlabs_api_key')
      .eq('id', user_id)
      .single();
      
    if (profileError || !profile) {
      console.error("Error fetching user profile:", profileError);
      throw new Error("User profile not found. Please ensure your account is properly set up.");
    }
    
    if (!profile.elevenlabs_api_key) {
      throw new Error("ElevenLabs API key not configured in your profile. Please add it in your profile settings.");
    }
    
    // Use the ElevenLabs Conversational AI API to make the outbound call
    const elevenlabsApiKey = profile.elevenlabs_api_key;
    
    console.log("Making request to ElevenLabs Conversational AI API");
    const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenlabsApiKey
      },
      body: JSON.stringify({
        agent_id: agent_id,
        to_number: to_number,
        conversation_initiation_client_data: {
          dynamic_variables: dynamic_variables || {},
          conversation_config_override: conversation_config_override || {}
        }
      })
    });
    
    // Handle HTTP errors from ElevenLabs API
    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        errorMessage = `ElevenLabs API error: ${errorJson.message || errorJson.detail || response.statusText}`;
      } catch (e) {
        // If parsing JSON fails, use text instead
        const errorText = await response.text();
        if (errorText) {
          errorMessage = `ElevenLabs API error: ${errorText}`;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log("ElevenLabs API response:", data);
    
    // Store the call in our call logs
    let callLogId = null;
    try {
      const { data: callLog, error: callLogError } = await supabase
        .from('call_logs')
        .insert({
          user_id: user_id,
          prospect_id: null, // This could be added if we have a prospect ID
          agent_config_id: null, // This is different from the ElevenLabs agent ID
          twilio_call_sid: data.callSid || "unknown",
          call_status: "initiated",
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();
        
      if (callLogError) {
        console.error("Error creating call log:", callLogError);
      } else if (callLog) {
        callLogId = callLog.id;
        console.log(`Created call log with ID: ${callLogId}`);
      }
    } catch (error) {
      console.error("Error creating call log:", error);
      // Non-critical error, continue execution
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Outbound call initiated successfully",
        callSid: data.callSid,
        callLogId: callLogId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("Error in elevenlabs-outbound-call:", error);
    
    // Get more specific error type if possible
    let errorCode = "GENERAL_ERROR";
    if (error.message?.includes("ElevenLabs API key")) {
      errorCode = "ELEVENLABS_API_KEY_MISSING";
    } else if (error.message?.includes("timed out")) {
      errorCode = "REQUEST_TIMEOUT";
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "An error occurred while making the outbound call",
        code: errorCode
      }),
      {
        status: 200, // Return 200 instead of error code to prevent client errors
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
