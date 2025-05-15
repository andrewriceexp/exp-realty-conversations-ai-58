
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateTwiMLResponse } from "../_shared/twiml-helpers.ts";

console.log(`Function "twilio-call-webhook" up and running!`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");
    const voiceId = url.searchParams.get("voice_id");
    const userId = url.searchParams.get("user_id");
    const callLogId = url.searchParams.get("call_log_id");
    const debug = url.searchParams.get("debug") === "true";
    
    // Validate required parameters
    if (!agentId) {
      console.error("Missing required parameter: agent_id");
      throw new Error("Missing agent_id parameter");
    }
    
    console.log("Webhook triggered with params:", {
      agentId,
      voiceId: voiceId || "default",
      userId: userId || "none",
      callLogId: callLogId || "none",
      debug: debug || false
    });
    
    // Get Twilio form data or query parameters
    let twilioParams = {};
    
    // Try to parse the request body if it exists
    try {
      const contentType = req.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const body = await req.json();
        twilioParams = body;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        for (const [key, value] of formData.entries()) {
          twilioParams[key] = value;
        }
      }
    } catch (error) {
      console.warn("Error parsing request body:", error.message);
    }
    
    // Log truncated Twilio parameters for debugging
    console.log("Twilio parameters:", 
      JSON.stringify(twilioParams).substring(0, 100) + 
      (JSON.stringify(twilioParams).length > 100 ? "..." : "")
    );
    
    // Get the server hostname - CRITICAL CHANGE: Use the Supabase project ref in the URL
    const supabaseProjectRef = Deno.env.get("SUPABASE_PROJECT_REF") || "uttebgyhijrdcjiczxrg";
    
    // Create the media stream URL with the full domain - CRITICAL FIX
    const mediaStreamUrl = `wss://${supabaseProjectRef}.supabase.co/functions/v1/twilio-media-stream`;
    
    // Add query parameters
    const params = new URLSearchParams();
    
    if (agentId) {
      params.append("agent_id", agentId);
    }
    
    if (voiceId) {
      params.append("voice_id", voiceId);
    }
    
    // Always pass userId if available
    if (userId) {
      params.append("user_id", userId);
    }
    
    if (callLogId) {
      params.append("call_log_id", callLogId);
    }
    
    if (debug) {
      params.append("debug", "true");
    }
    
    const mediaStreamUrlWithParams = `${mediaStreamUrl}?${params.toString()}`;
    console.log(`Using media stream URL: ${mediaStreamUrlWithParams}`);
    
    // Generate TwiML response using the correct helper function
    const twiml = generateTwiMLResponse(mediaStreamUrlWithParams, debug);
    
    // Create a call log entry if we have a user ID
    if (userId && !callLogId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Extract call information from Twilio parameters
          const callSid = twilioParams.CallSid;
          const from = twilioParams.From;
          
          if (callSid && from) {
            console.log(`Creating call log for inbound call: ${callSid} from ${from}`);
            
            // Prepare the call log data - REMOVE fields that might cause errors
            const callData: Record<string, any> = {
              user_id: userId,
              twilio_call_sid: callSid,
              from_number: from,
              status: 'Initiated',
              direction: 'inbound',
              metadata: {
                voice_id: voiceId,
                agent_id: agentId,
                debug_mode: debug,
                twilio_params: twilioParams
              }
            };
            
            // Set required fields that might not be in the URL params
            if (agentId) {
              callData.agent_id = agentId;
            }
            
            try {
              // Remove fields that might not exist in the schema - critical fix
              const { data: insertResult, error: insertError } = await supabase
                .from('call_logs')
                .insert([callData])
                .select();
                
              if (insertError) {
                console.error("Error inserting call log:", insertError);
              } else if (insertResult) {
                console.log("Call log created with ID:", insertResult[0]?.id);
              }
            } catch (dbError) {
              console.error("Database error creating call log:", dbError);
            }
          }
        }
      } catch (error) {
        console.error("Error creating call log:", error);
      }
    }
    
    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml"
      }
    });
  } catch (error) {
    console.error("Error generating TwiML response:", error);
    
    // Return a basic TwiML response even in case of error
    const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>We're sorry, but an error occurred. Please try again later.</Say>
        <Hangup/>
      </Response>`;
      
    return new Response(fallbackTwiML, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml"
      }
    });
  }
});
