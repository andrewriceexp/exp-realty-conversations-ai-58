
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createWebSocketStreamTwiML, createTwiMLResponse } from "../_shared/twiml-helpers.ts";

console.log(`Twilio Call Webhook Handler running.`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get host from request
    const host = req.headers.get("host") || "";
    
    // Parse URL to get query parameters
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id") || "6Optf6WRTzp3rEyj2aiL";  // Default agent ID
    const voiceId = url.searchParams.get("voice_id");
    const debug = url.searchParams.get("debug") === "true";
    const callLogId = url.searchParams.get("call_log_id");
    const userId = url.searchParams.get("user_id");
    
    console.log(`Call webhook received with agent_id: ${agentId}, voice_id: ${voiceId || 'none'}, debug: ${debug}, call_log_id: ${callLogId || 'none'}, user_id: ${userId || 'none'}`);
    
    // Create parameters for the WebSocket stream
    const streamParams: Record<string, string> = {};
    
    if (agentId) streamParams.agent_id = agentId;
    if (voiceId) streamParams.voice_id = voiceId;
    if (debug) streamParams.debug = "true";
    if (callLogId) streamParams.call_log_id = callLogId;
    if (userId) streamParams.user_id = userId;
    
    // Create TwiML response with WebSocket stream
    const twiml = createWebSocketStreamTwiML(host, streamParams);
    
    console.log(`Created TwiML response: ${twiml.substring(0, 100)}...`);
    
    // Return TwiML response
    return createTwiMLResponse(twiml, corsHeaders);
  } catch (error) {
    console.error("Error in twilio-call-webhook:", error);
    
    // Return error response
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
