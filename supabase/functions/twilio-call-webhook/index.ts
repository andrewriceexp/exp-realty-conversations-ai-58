
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
    
    // Create TwiML response with WebSocket stream
    const twiml = createWebSocketStreamTwiML(host);
    
    // Return TwiML response
    return createTwiMLResponse(twiml);
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
