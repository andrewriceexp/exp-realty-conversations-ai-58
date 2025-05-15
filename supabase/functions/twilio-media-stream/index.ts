
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

    console.log("Request parameters:", {
      agentId: agentId || "missing",
      voiceId: voiceId || "default",
      debug: debug ? "enabled" : "disabled"
    });

    // Validate required parameters
    if (!agentId) {
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
      
      // This is the core of the WebSocket upgrade process
      const webSocketPair = new WebSocketPair();
      const [clientSocket, serverSocket] = Object.values(webSocketPair);

      // Set up the server socket immediately
      let streamSid: string | null = null;
      let callSid: string | null = null;
      let elevenLabsSocket: WebSocket | null = null;
      let pingTimeout: number | null = null;

      // Create ElevenLabs WebSocket connection
      console.log("Setting up ElevenLabs WebSocket connection...");
      const elevenLabsParams = new URLSearchParams();
      elevenLabsParams.append("agent_id", agentId);
      
      if (voiceId) {
        elevenLabsParams.append("voice_id", voiceId);
      }
      
      // CRITICAL: Configure formats for telephony
      elevenLabsParams.append("input_format", "mulaw_8000");
      elevenLabsParams.append("output_format", "mulaw_8000");
      
      // Construct ElevenLabs WebSocket URL
      const elevenLabsWsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?${elevenLabsParams.toString()}`;
      console.log("Will connect to ElevenLabs at:", elevenLabsWsUrl);

      // Set up server socket event handlers
      serverSocket.onopen = () => {
        console.log("Server socket opened");
      };

      serverSocket.onclose = (event) => {
        console.log(`Server socket closed: Code ${event.code}, Reason: ${event.reason || "No reason provided"}`);
        
        // Clean up ElevenLabs socket if it exists
        if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
          try {
            elevenLabsSocket.close();
          } catch (error) {
            console.error("Error closing ElevenLabs socket:", error);
          }
        }
        
        // Clear any pending timeouts
        if (pingTimeout) {
          clearTimeout(pingTimeout);
        }
      };

      serverSocket.onerror = (event) => {
        console.error("Server socket error:", event);
      };

      // Handle messages from Twilio
      serverSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log non-media events for debugging
          if (data.event !== "media") {
            console.log(`Received ${data.event} event from Twilio`);
          }
          
          switch (data.event) {
            case "start":
              // Store important identifiers
              streamSid = data.start.streamSid;
              callSid = data.start.callSid;
              console.log(`Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
              
              // Connect to ElevenLabs after getting the stream ID
              elevenLabsSocket = new WebSocket(elevenLabsWsUrl);
              
              elevenLabsSocket.onopen = () => {
                console.log("Successfully connected to ElevenLabs WebSocket");
                
                // Authenticate with API key if available
                const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
                if (apiKey) {
                  console.log("Sending API key for authentication");
                  elevenLabsSocket?.send(JSON.stringify({"xi-api-key": apiKey}));
                }
              };
              
              elevenLabsSocket.onmessage = (elEvent) => {
                try {
                  const message = JSON.parse(elEvent.data);
                  
                  // Log message types except high-volume ones
                  if (message.type !== "audio" && message.type !== "ping") {
                    console.log(`Received ${message.type} message from ElevenLabs`);
                  }
                  
                  switch (message.type) {
                    case "conversation_initiation_metadata":
                      console.log("Conversation initialized with ElevenLabs");
                      break;
                      
                    case "audio":
                      if (!streamSid) {
                        console.warn("Received audio but no StreamSid available yet");
                        break;
                      }
                      
                      if (message.audio_event?.audio_base_64) {
                        // Forward audio to Twilio
                        const audioData = {
                          event: "media",
                          streamSid,
                          media: {
                            payload: message.audio_event.audio_base_64
                          }
                        };
                        
                        serverSocket.send(JSON.stringify(audioData));
                      }
                      break;
                      
                    case "interruption":
                      if (streamSid) {
                        // Clear Twilio's audio queue
                        console.log("Clearing Twilio audio queue due to interruption");
                        serverSocket.send(JSON.stringify({
                          event: "clear",
                          streamSid
                        }));
                      }
                      break;
                      
                    case "ping":
                      if (message.ping_event?.event_id) {
                        // Respond to ping events
                        elevenLabsSocket?.send(JSON.stringify({
                          type: "pong",
                          event_id: message.ping_event.event_id
                        }));
                        
                        // Reset ping timeout
                        if (pingTimeout) {
                          clearTimeout(pingTimeout);
                        }
                        
                        // Set new ping timeout (30 seconds)
                        pingTimeout = setTimeout(() => {
                          console.warn("No ping received from ElevenLabs for 30 seconds");
                          if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
                            elevenLabsSocket.close();
                          }
                        }, 30000);
                      }
                      break;
                  }
                } catch (error) {
                  console.error("Error processing ElevenLabs message:", error);
                }
              };
              
              elevenLabsSocket.onerror = (error) => {
                console.error("ElevenLabs WebSocket error:", error);
              };
              
              elevenLabsSocket.onclose = (event) => {
                console.log(`ElevenLabs WebSocket closed: Code ${event.code}, Reason: ${event.reason || "No reason"}`);
                
                if (pingTimeout) {
                  clearTimeout(pingTimeout);
                }
              };
              break;
              
            case "media":
              // Forward audio from Twilio to ElevenLabs
              if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
                const audioMessage = {
                  user_audio_chunk: data.media.payload
                };
                elevenLabsSocket.send(JSON.stringify(audioMessage));
              }
              break;
              
            case "stop":
              console.log(`Stream ${streamSid} ended`);
              if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
                elevenLabsSocket.close();
              }
              streamSid = null;
              callSid = null;
              break;
          }
        } catch (error) {
          console.error("Error processing Twilio message:", error);
        }
      };

      // Complete the WebSocket handshake with appropriate headers
      const headers = {
        "Upgrade": "websocket",
        "Connection": "Upgrade",
        "Sec-WebSocket-Accept": acceptValue,
        ...corsHeaders
      };

      console.log("WebSocket handshake complete - returning 101 response");
      
      // CRITICAL: Return a 101 Switching Protocols response
      return new Response(null, { 
        status: 101, 
        webSocket: clientSocket, 
        headers 
      });
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
