
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
    // Directly get URL info without accessing request.url.origin which may not be available
    const url = new URL(req.url);
    const host = url.hostname;
    const protocol = url.protocol;
    const port = url.port ? `:${url.port}` : '';
    
    // Full host including protocol
    const fullHost = `${protocol}//${host}${port}`;
    
    // Parse URL to get query parameters
    const agentId = url.searchParams.get("agent_id") || "6Optf6WRTzp3rEyj2aiL";  // Default agent ID
    const voiceId = url.searchParams.get("voice_id");
    const debug = url.searchParams.get("debug") === "true";
    const callLogId = url.searchParams.get("call_log_id");
    const userId = url.searchParams.get("user_id");
    
    console.log(`Call webhook received with:
      Full Host: ${fullHost}
      Agent ID: ${agentId}
      Voice ID: ${voiceId || 'none'}
      Debug Mode: ${debug ? 'enabled' : 'disabled'}
      Call Log ID: ${callLogId || 'none'}
      User ID: ${userId || 'none'}
    `);
    
    // Create parameters for the WebSocket stream
    const streamParams: Record<string, string> = {};
    
    if (agentId) streamParams.agent_id = agentId;
    if (voiceId) streamParams.voice_id = voiceId;
    if (debug) streamParams.debug = "true";
    if (callLogId) streamParams.call_log_id = callLogId;
    if (userId) streamParams.user_id = userId;
    
    // Create TwiML response with WebSocket stream
    const twiml = createWebSocketStreamTwiML(fullHost, streamParams);
    
    console.log(`Created TwiML response: ${twiml.substring(0, 100)}...`);
    
    // Return TwiML response
    return createTwiMLResponse(twiml, corsHeaders);
  } catch (error) {
    console.error("Error in twilio-call-webhook:", error);
    
    // Return a meaningful error response with proper TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>I'm sorry, an error occurred while processing your call. The technical team has been notified.</Say>
  <Pause length="1" />
  <Hangup />
</Response>`;

    return new Response(errorTwiml, {
      headers: {
        "Content-Type": "text/xml",
        ...corsHeaders
      }
    });
  }
});
