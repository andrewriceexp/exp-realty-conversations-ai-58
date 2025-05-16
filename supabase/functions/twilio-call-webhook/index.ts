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
    const userId = url.searchParams.get("user_id") || null;
    const callLogId = url.searchParams.get("call_log_id");
    const debug = url.searchParams.get("debug") === "true";
    const echoMode = url.searchParams.get("echo") === "true"; // Add echo mode parameter
    
    console.log(`Received request for: ${req.url}`); // Log the full incoming URL
    
    // CRITICAL FIX: Supply default ElevenLabs agent ID if missing or empty
    let finalAgentId = agentId;
    if (!finalAgentId || finalAgentId.trim() === "") {
      console.warn(`agent_id was missing or empty ('${agentId}'), attempting to use default.`);
      finalAgentId = Deno.env.get("DEFAULT_AGENT_ID") || "UO1QDRUZh2ti2suBR4cq";
      console.log(`Using effective agent_id: ${finalAgentId}`);
    }
    
    // Use provided userId or a placeholder if missing
    let finalUserId = userId;
    if (!finalUserId || finalUserId.trim() === "") {
      console.warn(`user_id was missing or empty ('${userId}'), using placeholder 'unknown_user'.`);
      finalUserId = "unknown_user"; // Placeholder if user_id is missing
    }
    
    console.log("Webhook triggered with params:", {
      agentId: finalAgentId,
      voiceId: voiceId || "default",
      userId: finalUserId,
      callLogId: callLogId || "none",
      debug: debug || false,
      echoMode: echoMode || false
    });
    
    // Get Twilio form data or query parameters
    let twilioParams: Record<string, any> = {};
    
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
      JSON.stringify(twilioParams).substring(0, 200) + 
      (JSON.stringify(twilioParams).length > 200 ? "..." : "")
    );
    
    // Get the server hostname - CRITICAL CHANGE: Use the Supabase project ref in the URL
    const supabaseProjectRef = Deno.env.get("SUPABASE_PROJECT_REF") || "uttebgyhijrdcjiczxrg";
    
    // CRITICAL FIX: Create the proper WebSocket URL (wss://) for the media stream
    // This is the most important fix - Twilio requires wss:// URLs, not http:// or https://
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const mediaStreamUrl = `wss://${supabaseProjectRef}.supabase.co/functions/v1/twilio-media-stream`;
    
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Generated media stream URL: ${mediaStreamUrl}`);
    
    // Add query parameters
    const params = new URLSearchParams();
    
    // CRITICAL: Always use the final agent ID (original or default)
    // Ensure finalAgentId is a string before appending
    if (finalAgentId) { // Check if finalAgentId is truthy (i.e., not null or empty string after logic above)
        params.append("agent_id", finalAgentId);
    } else {
        // This case should ideally not be reached due to the fallback UO1QDRUZh2ti2suBR4cq
        console.error("CRITICAL: finalAgentId is unexpectedly null or empty even after fallback. Appending a failsafe default.");
        params.append("agent_id", "UO1QDRUZh2ti2suBR4cq"); 
    }
    
    if (voiceId) {
      params.append("voice_id", voiceId);
    }
    
    // Always pass userId (either original or placeholder)
    params.append("user_id", finalUserId);
    
    if (callLogId) {
      params.append("call_log_id", callLogId);
    }
    
    if (debug) {
      params.append("debug", "true");
    }
    
    // Add echo mode parameter if true
    if (echoMode) {
      params.append("echo", "true");
    }
    
    const mediaStreamUrlWithParams = `${mediaStreamUrl}?${params.toString()}`;
    console.log(`Using media stream URL: ${mediaStreamUrlWithParams}`);
    
    // Generate TwiML response using the correct helper function
    const twiml = generateTwiMLResponse(mediaStreamUrlWithParams, debug);
    
    // Create a call log entry if we have a user ID
    if (finalUserId && !callLogId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Extract call information from Twilio parameters
          const callSid = twilioParams.CallSid as string | undefined;
          const from = twilioParams.From as string | undefined;
          
          if (callSid && from) {
            console.log(`Creating call log for inbound call: ${callSid} from ${from}`);
            
            // Prepare the call log data - REMOVE fields that might cause errors
            const callData: Record<string, any> = {
              user_id: finalUserId,
              twilio_call_sid: callSid,
              from_number: from,
              status: 'Initiated',
              direction: 'inbound',
              metadata: {
                voice_id: voiceId,
                agent_id: finalAgentId,
                debug_mode: debug,
                echo_mode: echoMode,
                twilio_params: twilioParams
              }
            };
            
            // Set required fields that might not be in the URL params
            if (finalAgentId) {
              callData.agent_id = finalAgentId;
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
