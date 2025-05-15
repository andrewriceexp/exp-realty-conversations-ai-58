
// Import required packages
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Function 'twilio-media-stream' up and running!");

// WebSocket headers for proper protocol switching
const webSocketHeaders = {
  "Upgrade": "websocket",
  "Connection": "Upgrade",
  "Sec-WebSocket-Accept": "", // Will be computed during handshake
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, elevenlabs-signature, x-elevenlabs-api-key, twilio-signature, X-Twilio-Signature, x-twilio-signature, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// CORS headers for standard HTTP responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, elevenlabs-signature, x-elevenlabs-api-key, twilio-signature, X-Twilio-Signature, x-twilio-signature, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

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
    const agentId = url.searchParams.get("agent_id");
    const voiceId = url.searchParams.get("voice_id");
    const userId = url.searchParams.get("user_id");
    const callLogId = url.searchParams.get("call_log_id");
    const debug = url.searchParams.get("debug") === "true";

    console.log("WebSocket connection request received with parameters:", {
      agentId,
      voiceId: voiceId || "default",
      userId: userId || "none",
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
        status: 426, // Upgrade Required
        headers: {
          ...corsHeaders,
          "Upgrade": "websocket"
        }
      });
    }

    // Check for WebSocket version
    const wsVersion = req.headers.get("Sec-WebSocket-Version");
    if (wsVersion !== "13") {
      console.error(`Unsupported WebSocket version: ${wsVersion}`);
      return new Response("Unsupported WebSocket version", {
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      console.log("Attempting WebSocket upgrade...");

      // First, create ElevenLabs WebSocket connection parameters
      const elevenLabsParams = new URLSearchParams();
      elevenLabsParams.append("agent_id", agentId);
      
      if (voiceId) {
        elevenLabsParams.append("voice_id", voiceId);
      }
      
      // CRITICAL: Always specify the audio format for telephony use cases
      elevenLabsParams.append("input_format", "mulaw_8000");
      elevenLabsParams.append("output_format", "mulaw_8000");
      
      // Construct the ElevenLabs WebSocket URL
      const elevenLabsWsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?${elevenLabsParams.toString()}`;
      console.log("Will connect to ElevenLabs at:", elevenLabsWsUrl);
      
      // Perform the WebSocket upgrade with explicit protocol settings
      let result;
      try {
        result = Deno.upgradeWebSocket(req);
        console.log("Successfully upgraded WebSocket connection");
      } catch (upgradeError) {
        console.error("WebSocket upgrade failed:", upgradeError);
        return new Response(`WebSocket upgrade failed: ${upgradeError instanceof Error ? upgradeError.message : String(upgradeError)}`, {
          status: 500,
          headers: corsHeaders
        });
      }

      const twilioSocket = result.socket;
      const response = result.response;

      // Track connection variables
      let streamSid: string | null = null;
      let callSid: string | null = null;
      let elevenLabsSocket: WebSocket | null = null;
      let pingTimeout: number | null = null;
      let connectionEstablished = false;

      // Connect to ElevenLabs after successful Twilio upgrade
      console.log("Connecting to ElevenLabs WebSocket...");
      elevenLabsSocket = new WebSocket(elevenLabsWsUrl);
      
      // Handle successful ElevenLabs connection
      elevenLabsSocket.onopen = () => {
        console.log("Successfully connected to ElevenLabs WebSocket");
        connectionEstablished = true;
        
        // Authenticate with API key if available
        const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
        if (apiKey) {
          console.log("Sending API key for authentication");
          elevenLabsSocket?.send(JSON.stringify({"xi-api-key": apiKey}));
        } else {
          console.log("No API key available, continuing without authentication");
        }
      };
      
      // Handle messages from ElevenLabs
      elevenLabsSocket.onmessage = (event) => {
        if (!twilioSocket || twilioSocket.readyState !== WebSocket.OPEN) {
          console.warn("Received message from ElevenLabs but Twilio socket is not open");
          return;
        }
        
        try {
          const message = JSON.parse(event.data);
          
          // Log message type (except for high-volume types)
          if (message.type !== "audio" && message.type !== "ping") {
            console.log(`Received ${message.type} message from ElevenLabs`);
          } else if (message.type === "ping") {
            console.log("Received ping from ElevenLabs");
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
                // Forward audio from ElevenLabs to Twilio
                const audioData = {
                  event: "media",
                  streamSid: streamSid,
                  media: {
                    payload: message.audio_event.audio_base_64
                  }
                };
                try {
                  twilioSocket.send(JSON.stringify(audioData));
                } catch (sendError) {
                  console.error("Error sending audio to Twilio:", sendError);
                }
              }
              break;
              
            case "interruption":
              if (streamSid) {
                // Clear Twilio's audio queue on interruption
                console.log("Clearing Twilio audio queue due to interruption");
                try {
                  twilioSocket.send(JSON.stringify({
                    event: "clear",
                    streamSid
                  }));
                } catch (sendError) {
                  console.error("Error sending clear command to Twilio:", sendError);
                }
              }
              break;
              
            case "ping":
              if (message.ping_event?.event_id) {
                // Respond to ElevenLabs ping events
                const pongResponse = {
                  type: "pong",
                  event_id: message.ping_event.event_id
                };
                
                try {
                  elevenLabsSocket?.send(JSON.stringify(pongResponse));
                } catch (sendError) {
                  console.error("Error sending pong to ElevenLabs:", sendError);
                }
                
                // Reset ping timeout
                if (pingTimeout) {
                  clearTimeout(pingTimeout);
                }
                
                // Set new ping timeout (30 seconds)
                pingTimeout = setTimeout(() => {
                  console.warn("No ping received from ElevenLabs for 30 seconds");
                  if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
                    console.log("Closing ElevenLabs connection due to ping timeout");
                    elevenLabsSocket.close();
                  }
                }, 30000);
              }
              break;
              
            case "error":
              console.error("Error from ElevenLabs:", message.error || "Unknown error");
              break;
          }
        } catch (parseError) {
          console.error("Error processing message from ElevenLabs:", formatError(parseError));
        }
      };
      
      // Handle errors from ElevenLabs WebSocket
      elevenLabsSocket.onerror = (event) => {
        console.error("ElevenLabs WebSocket error:", event);
      };
      
      // Handle disconnection from ElevenLabs
      elevenLabsSocket.onclose = (event) => {
        console.log(`ElevenLabs WebSocket closed: Code ${event.code}, Reason: ${event.reason || "No reason provided"}`);
        
        if (pingTimeout) {
          clearTimeout(pingTimeout);
          pingTimeout = null;
        }
        
        // Close Twilio connection if still open
        if (twilioSocket && twilioSocket.readyState === WebSocket.OPEN) {
          try {
            twilioSocket.close();
          } catch (closeError) {
            console.error("Error closing Twilio socket:", closeError);
          }
        }
      };
      
      // Handle messages from Twilio
      twilioSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log non-media events
          if (data.event !== "media") {
            console.log(`Received ${data.event} event from Twilio`);
          }
          
          switch (data.event) {
            case "start":
              // Store important connection identifiers
              streamSid = data.start.streamSid;
              callSid = data.start.callSid;
              console.log(`Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
              break;
              
            case "media":
              // Forward audio from Twilio to ElevenLabs
              if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
                const audioMessage = {
                  user_audio_chunk: data.media.payload
                };
                try {
                  elevenLabsSocket.send(JSON.stringify(audioMessage));
                } catch (sendError) {
                  console.error("Error sending audio to ElevenLabs:", sendError);
                }
              } else if (connectionEstablished) {
                console.warn("Received media but ElevenLabs socket is not open");
              }
              break;
              
            case "stop":
              // Handle stream end
              console.log(`Stream ${streamSid} ended`);
              if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
                try {
                  elevenLabsSocket.close();
                } catch (closeError) {
                  console.error("Error closing ElevenLabs socket:", closeError);
                }
              }
              streamSid = null;
              callSid = null;
              break;
            
            default:
              console.log(`Unhandled Twilio event: ${data.event}`);
              break;
          }
        } catch (parseError) {
          console.error("Error processing message from Twilio:", formatError(parseError));
        }
      };
      
      // Handle disconnection from Twilio
      twilioSocket.onclose = (event) => {
        console.log(`Twilio WebSocket closed: Code ${event.code}, Reason: ${event.reason || "No reason provided"}`);
        
        // Clean up resources
        if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
          try {
            elevenLabsSocket.close();
          } catch (closeError) {
            console.error("Error closing ElevenLabs socket:", closeError);
          }
        }
        
        if (pingTimeout) {
          clearTimeout(pingTimeout);
          pingTimeout = null;
        }
      };
      
      // Handle errors from Twilio WebSocket
      twilioSocket.onerror = (event) => {
        console.error("Twilio WebSocket error:", event);
      };
      
      // Return the WebSocket response
      console.log("WebSocket setup complete, returning response");
      return response;
      
    } catch (error) {
      console.error("WebSocket setup error:", formatError(error));
      return new Response(`WebSocket setup error: ${error instanceof Error ? error.message : String(error)}`, {
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
