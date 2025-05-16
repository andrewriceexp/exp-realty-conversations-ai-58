
// Import required packages
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

console.log("Function 'twilio-media-stream' up and running!");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, elevenlabs-signature, x-elevenlabs-api-key, twilio-signature, X-Twilio-Signature, x-twilio-signature, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Helper function to generate the Sec-WebSocket-Accept header value
// This is a critical part of the WebSocket handshake protocol (RFC 6455)
async function generateAcceptValue(key: string): Promise<string> {
  const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  const combined = key + GUID;
  
  // Create a SHA-1 hash of the combined string
  const hash = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(combined)
  );
  
  // Convert the hash to a base64 string
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// Helper function for consistent error handling
function formatError(error: Error | string): string {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : "No stack trace available";
  console.error(`Error: ${message}\nStack: ${stack}`);
  return message;
}

serve(async (req) => {
  try {
    // Handle OPTIONS preflight requests
    if (req.method === "OPTIONS") {
      console.log("Handling preflight request with correct CORS headers");
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Extract query parameters
    const url = new URL(req.url);
    console.log(`Request URL: ${url.toString()}`);
    
    const agentId = url.searchParams.get("agent_id");
    const voiceId = url.searchParams.get("voice_id");
    const debug = url.searchParams.get("debug") === "true";
    const echoMode = url.searchParams.get("echo") === "true";

    console.log("Request parameters:", {
      agentId: agentId || "missing",
      voiceId: voiceId || "default",
      debug: debug ? "enabled" : "disabled",
      echoMode: echoMode ? "enabled" : "disabled"
    });

    // Validate required parameters
    if (!agentId && !echoMode) {
      console.error("Missing required parameter: agent_id");
      return new Response("Missing required parameter: agent_id", {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify this is a WebSocket upgrade request
    const upgradeHeader = req.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() !== "websocket") {
      console.error("Expected WebSocket upgrade request, received regular HTTP request");
      return new Response("Expected WebSocket upgrade request", {
        status: 400,
        headers: corsHeaders
      });
    }

    // Process WebSocket handshake
    console.log("Processing WebSocket handshake...");
    
    const wsKey = req.headers.get("Sec-WebSocket-Key");
    if (!wsKey) {
      console.error("Missing Sec-WebSocket-Key header");
      return new Response("Missing Sec-WebSocket-Key header", {
        status: 400,
        headers: corsHeaders
      });
    }
    
    const wsVersion = req.headers.get("Sec-WebSocket-Version");
    if (wsVersion !== "13") {
      console.error(`Unsupported WebSocket version: ${wsVersion}`);
      return new Response("Unsupported WebSocket version", {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // CRITICAL: Calculate the accept value based on the key
    const acceptValue = await generateAcceptValue(wsKey);
    console.log("Generated WebSocket accept value for handshake");
    
    try {
      console.log("Performing WebSocket upgrade with proper headers...");
      
      // Complete the WebSocket handshake with appropriate headers
      const headers = new Headers({
        "Upgrade": "websocket",
        "Connection": "Upgrade",
        "Sec-WebSocket-Accept": acceptValue,
        ...corsHeaders
      });

      console.log("WebSocket handshake complete - returning 101 response");
      
      // CRITICAL: Return a 101 Switching Protocols response
      if (echoMode) {
        console.log("Running in echo mode - testing WebSocket without ElevenLabs integration");
        
        // This is a test mode that just echoes messages back
        // It helps isolate whether the WebSocket handshake issue is with
        // our function or with the ElevenLabs integration
        const { socket, response } = Deno.upgradeWebSocket(req);
        
        socket.onopen = () => {
          console.log("Echo WebSocket opened");
          socket.send(JSON.stringify({ type: "connect", message: "Echo server connected" }));
        };
        
        socket.onmessage = (event) => {
          console.log(`Echo received: ${event.data}`);
          socket.send(`Echo: ${event.data}`);
        };
        
        socket.onclose = () => {
          console.log("Echo WebSocket closed");
        };
        
        socket.onerror = (error) => {
          console.error("Echo WebSocket error:", error);
        };
        
        return response;
      } else {
        // For normal mode, we'll create an empty response with 101 status
        // and connect to ElevenLabs afterwards
        return new Response(null, { 
          status: 101, 
          headers
        });
      }
    } catch (upgradeError) {
      console.error("WebSocket upgrade failed:", upgradeError);
      return new Response(`WebSocket upgrade failed: ${upgradeError instanceof Error ? upgradeError.message : String(upgradeError)}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  } catch (error) {
    const errorMessage = formatError(error);
    console.error("Unhandled error:", errorMessage);
    return new Response(`Internal server error: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
