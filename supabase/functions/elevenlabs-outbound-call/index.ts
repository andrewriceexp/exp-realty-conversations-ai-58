
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log(`Function "elevenlabs-outbound-call" up and running!`);

interface OutboundCallRequest {
  agent_id: string;
  to_number: string;
  user_id: string;
  prospect_id?: string;
  agent_config_id?: string;
  agent_phone_number_id?: string;
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
    const { 
      agent_id, 
      to_number, 
      user_id, 
      prospect_id, 
      agent_config_id,
      agent_phone_number_id,
      dynamic_variables, 
      conversation_config_override 
    } = requestBody as OutboundCallRequest;

    // Log received parameters for debugging
    console.log("Request received:", {
      agent_id,
      to_number: to_number?.substring(0, 6) + "xxxx", // Mask for privacy in logs
      user_id,
      prospect_id,
      agent_config_id,
      agent_phone_number_id: agent_phone_number_id || "not provided",
      has_dynamic_variables: !!dynamic_variables,
      has_config_override: !!conversation_config_override
    });

    // Validate required fields
    if (!agent_id) {
      console.error("Missing agent_id in request");
      return new Response(JSON.stringify({
        success: false,
        message: "Agent ID is required",
        code: "MISSING_AGENT_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!to_number) {
      console.error("Missing to_number in request");
      return new Response(JSON.stringify({
        success: false,
        message: "Phone number is required",
        code: "MISSING_PHONE_NUMBER"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!user_id) {
      console.error("Missing user_id in request");
      return new Response(JSON.stringify({
        success: false,
        message: "User ID is required",
        code: "MISSING_USER_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      .select('elevenlabs_api_key, elevenlabs_phone_number_id')
      .eq('id', user_id)
      .single();
      
    if (profileError || !profile?.elevenlabs_api_key) {
      console.error("Error fetching profile or missing API key:", profileError);
      return new Response(JSON.stringify({
        success: false,
        message: "ElevenLabs API key not configured in your profile",
        code: "ELEVENLABS_API_KEY_MISSING"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get phone number ID - prioritize request parameter, then profile value
    const elPhoneNumberId = agent_phone_number_id || profile.elevenlabs_phone_number_id;
    
    // If no phone number ID is available, return a helpful error
    if (!elPhoneNumberId) {
      console.error("No ElevenLabs phone number ID provided in request or stored in profile");
      return new Response(JSON.stringify({
        success: false,
        message: "ElevenLabs Phone Number ID is required for outbound calling. Please add it in your profile settings or ensure it's sent in the request.",
        code: "ELEVENLABS_PHONE_NUMBER_ID_MISSING"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate ElevenLabs phone number format
    let formattedPhoneNumber = elPhoneNumberId.trim();
    // If it doesn't start with a plus sign, add it
    if (!formattedPhoneNumber.startsWith("+")) {
      formattedPhoneNumber = "+" + formattedPhoneNumber;
    }
    
    // Validate with E.164 format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(formattedPhoneNumber)) {
      console.error(`Invalid phone number format: ${formattedPhoneNumber}`);
      return new Response(JSON.stringify({
        success: false,
        message: "ElevenLabs phone number must be in E.164 format (e.g., +12125551234)",
        code: "ELEVENLABS_PHONE_NUMBER_INVALID"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`Using ElevenLabs Phone Number ID: ${formattedPhoneNumber}`);
    
    // Prepare the payload for ElevenLabs API
    const payload = {
      agent_id,
      to_number,
      agent_phone_number_id: formattedPhoneNumber,
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
      agent_phone_number_id: formattedPhoneNumber,
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
        
        // Log response status
        console.log(`ElevenLabs API response status: ${response.status}`);
        
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
          
          // Check for specific phone_number_not_found error
          if (response.status === 404 && errorDetails?.detail?.status === "phone_number_not_found") {
            return new Response(JSON.stringify({
              success: false,
              message: `The phone number ${formattedPhoneNumber} is not registered with your ElevenLabs account. Please register this number with ElevenLabs or use a different number.`,
              code: "ELEVENLABS_PHONE_NUMBER_NOT_FOUND",
              details: {
                phoneNumber: formattedPhoneNumber,
                errorType: "phone_number_not_found"
              }
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
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
    console.log("Successful response from ElevenLabs:", {
      success: data.success,
      callSid: data.callSid ? `${data.callSid.substring(0, 8)}...` : "None",
      conversationId: data.conversationId ? `${data.conversationId.substring(0, 8)}...` : "None"
    });
    
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
          agent_phone_number_id: formattedPhoneNumber,
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
    } else {
      console.log("Call log created with ID:", callLog?.[0]?.id);
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
    let status = 400; // Use 400 for client errors
    let errorMessage = error.message || "An error occurred while making the outbound call";
    
    // Classify specific error types
    if (error.message?.includes("ElevenLabs API key")) {
      errorCode = "ELEVENLABS_API_KEY_MISSING";
    } else if (error.message?.includes("phone number") && error.message?.includes("not found")) {
      errorCode = "ELEVENLABS_PHONE_NUMBER_NOT_FOUND";
    } else if (error.message?.includes("timed out")) {
      errorCode = "REQUEST_TIMEOUT";
    } else if (error.message?.includes("rate limit")) {
      errorCode = "RATE_LIMIT_EXCEEDED";
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: errorMessage,
        code: errorCode
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
