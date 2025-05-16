
// Import required packages
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Function 'twilio-media-stream' up and running!");

// CORS headers with all required headers for WebSocket upgrade
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, elevenlabs-signature, x-elevenlabs-api-key, twilio-signature, X-Twilio-Signature, x-twilio-signature, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

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
    const userId = url.searchParams.get("user_id");

    console.log("Request parameters:", {
      agentId: agentId || "missing",
      voiceId: voiceId || "default",
      userId: userId || "missing",
      debug: debug ? "enabled" : "disabled",
      echoMode: echoMode ? "enabled" : "disabled"
    });

    // Validate required parameters for non-echo mode
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

    console.log("Processing WebSocket connection using WebSocketPair API...");

    try {
      // Use Deno's upgradeWebSocket function which handles the handshake correctly
      const { socket, response } = Deno.upgradeWebSocket(req);
      
      console.log("WebSocket connection established successfully");

      // Set up socket event handlers
      socket.onopen = () => {
        console.log("Socket connection opened");
      };
      
      socket.onclose = (event) => {
        console.log(`Socket closed with code: ${event.code}, reason: ${event.reason}`);
      };

      socket.onerror = (error) => {
        console.error("Socket error:", error);
      };

      // Handle echo mode for testing
      if (echoMode) {
        console.log("Running in echo mode - WebSocket will echo back messages");
        
        socket.onmessage = (event) => {
          try {
            console.log(`Echo received: ${typeof event.data === 'string' ? event.data.substring(0, 100) + '...' : '[binary data]'}`);
            
            // Send a confirmation message on connection
            if (typeof event.data === 'string' && event.data.includes("start")) {
              const message = JSON.parse(event.data);
              
              socket.send(JSON.stringify({ 
                type: "echo_status", 
                message: "Echo server connected and working",
                streamSid: message.start?.streamSid
              }));
            }
            
            // Echo the message back
            socket.send(event.data);
          } catch (error) {
            console.error("Error in echo handler:", error);
          }
        };
        
        // Return the WebSocket response
        return response;
      }
      
      // For regular mode, connect to ElevenLabs
      console.log("Setting up connection to ElevenLabs...");
      
      // Construct the ElevenLabs WebSocket URL with proper parameters
      const elevenlabsUrl = new URL("wss://api.elevenlabs.io/v1/convai/conversation");
      elevenlabsUrl.searchParams.append("agent_id", agentId || "");
      if (voiceId) elevenlabsUrl.searchParams.append("voice_id", voiceId);
      
      // Critical: Set audio formats to match Twilio's needs (μ-law 8000Hz)
      elevenlabsUrl.searchParams.append("input_format", "mulaw_8000");
      elevenlabsUrl.searchParams.append("output_format", "mulaw_8000");
      
      console.log(`Connecting to ElevenLabs at ${elevenlabsUrl.toString()}`);
      
      // Connect to ElevenLabs WebSocket
      const elevenlabsWs = new WebSocket(elevenlabsUrl.toString());
      
      // Set up timeout to close the connection if ElevenLabs doesn't connect in 10 seconds
      const connectionTimeout = setTimeout(() => {
        console.error("Connection to ElevenLabs timed out");
        socket.send(JSON.stringify({ type: "error", message: "Connection to ElevenLabs timed out" }));
        elevenlabsWs.close();
      }, 10000);
      
      // Handle ElevenLabs WebSocket events
      elevenlabsWs.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("Connected to ElevenLabs WebSocket");
        
        // If there's an API key available, send it in the first message
        const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
        if (apiKey) {
          console.log("Sending API key to ElevenLabs");
          elevenlabsWs.send(JSON.stringify({ "xi-api-key": apiKey }));
        }
      };
      
      elevenlabsWs.onmessage = (event) => {
        try {
          console.log(`Message received from ElevenLabs (${typeof event.data})`);
          
          // If we received string data, parse it
          if (typeof event.data === 'string') {
            try {
              const message = JSON.parse(event.data);
              console.log(`Received message type: ${message.type}`);
              
              // Handle different message types
              switch (message.type) {
                case "conversation_initiation_metadata":
                  console.log("Conversation initiated with ElevenLabs");
                  break;
                  
                case "audio":
                  if (message.audio_event?.audio_base_64) {
                    // Forward audio data to Twilio
                    socket.send(JSON.stringify({
                      event: "media",
                      media: {
                        payload: message.audio_event.audio_base_64
                      }
                    }));
                  }
                  break;
                  
                case "interruption":
                  // Forward interruption to Twilio to clear the audio queue
                  socket.send(JSON.stringify({ event: "clear" }));
                  break;
                  
                case "ping":
                  // Respond to ping events
                  if (message.ping_event?.event_id) {
                    elevenlabsWs.send(JSON.stringify({
                      type: "pong",
                      event_id: message.ping_event.event_id
                    }));
                  }
                  break;
                  
                default:
                  // Forward all other messages to the client
                  socket.send(event.data);
              }
            } catch (parseError) {
              console.error("Failed to parse ElevenLabs message:", parseError);
            }
          }
          // Forward binary data directly
          else {
            socket.send(event.data);
          }
        } catch (error) {
          console.error("Error handling ElevenLabs message:", error);
        }
      };
      
      elevenlabsWs.onerror = (error) => {
        console.error("ElevenLabs WebSocket error:", error);
        socket.send(JSON.stringify({ type: "error", message: "Error in ElevenLabs connection" }));
      };
      
      elevenlabsWs.onclose = (event) => {
        console.log(`ElevenLabs WebSocket closed with code ${event.code}: ${event.reason}`);
        
        // If the socket is still open, send a message and close it
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "disconnected", message: "ElevenLabs WebSocket closed" }));
          setTimeout(() => socket.close(), 1000);
        }
      };
      
      // Handle messages from Twilio
      socket.onmessage = (event) => {
        try {
          let data;
          
          // Handle both string and binary data
          if (typeof event.data === 'string') {
            try {
              data = JSON.parse(event.data);
              console.log(`Received Twilio event: ${data.event || 'unknown'}`);
              
              // Handle different Twilio events
              switch (data.event) {
                case "start":
                  console.log("Twilio stream started");
                  break;
                  
                case "media":
                  if (data.media && data.media.payload && elevenlabsWs.readyState === WebSocket.OPEN) {
                    // Forward audio to ElevenLabs
                    elevenlabsWs.send(JSON.stringify({
                      user_audio_chunk: data.media.payload
                    }));
                  }
                  break;
                  
                case "stop":
                  console.log("Twilio stream ended");
                  elevenlabsWs.close();
                  break;
              }
            } catch (parseError) {
              console.error("Failed to parse Twilio message:", parseError);
            }
          } else {
            // Handle binary data
            console.log("Received binary data from Twilio");
            if (elevenlabsWs.readyState === WebSocket.OPEN) {
              elevenlabsWs.send(event.data);
            }
          }
        } catch (error) {
          console.error("Error handling Twilio message:", error);
        }
      };
      
      // Handle socket close
      socket.onclose = () => {
        console.log("Twilio WebSocket closed");
        elevenlabsWs.close();
      };
      
      // Return the WebSocket response
      return response;
    } catch (wsError) {
      console.error("Error setting up WebSocket:", wsError);
      return new Response(`WebSocket setup error: ${wsError.message || String(wsError)}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unhandled error:", errorMessage);
    return new Response(`Internal server error: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
