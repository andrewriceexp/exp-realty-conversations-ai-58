
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
    const { agent_id, to_number, user_id, dynamic_variables, conversation_config_override } = await req.json() as OutboundCallRequest;

    if (!agent_id) {
      throw new Error("Agent ID is required");
    }
    
    if (!to_number) {
      throw new Error("Phone number is required");
    }

    if (!user_id) {
      throw new Error("User ID is required");
    }

    console.log(`Making outbound call to ${to_number} with agent ${agent_id}`);

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
      throw new Error("User profile not found");
    }
    
    if (!profile.elevenlabs_api_key) {
      throw new Error("ElevenLabs API key not configured in your profile");
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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`ElevenLabs API error: ${errorJson.message || errorJson.detail || response.statusText}`);
      } catch (e) {
        throw new Error(`ElevenLabs API error: ${errorText || response.statusText}`);
      }
    }
    
    const data = await response.json();
    console.log("ElevenLabs API response:", data);
    
    // Store the call in our call logs
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
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Outbound call initiated",
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
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "An error occurred while making the outbound call"
      }),
      {
        status: 200, // Return 200 instead of error code to prevent client errors
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
