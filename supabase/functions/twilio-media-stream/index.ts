
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log(`Twilio WebSocket Media Stream Handler running.`);

serve(async (req) => {
  // We need to check if this is a WebSocket upgrade request
  const upgradeHeader = req.headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    // Initialize WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let streamSid: string | null = null;
    let elevenlabsWs: WebSocket | null = null;
    let agentId: string | null = null;
    const url = new URL(req.url);
    
    // Extract parameters from the URL
    agentId = url.searchParams.get("agent_id") || "6Optf6WRTzp3rEyj2aiL"; // Default agent ID
    const voiceId = url.searchParams.get("voice_id");
    const callLogId = url.searchParams.get("call_log_id");
    const userId = url.searchParams.get("user_id");
    const debugMode = url.searchParams.get("debug") === "true";

    // Log connection details
    console.log(`New WebSocket connection with params:
      Agent ID: ${agentId}
      Voice ID: ${voiceId || 'not specified'}
      Call Log ID: ${callLogId || 'not specified'}
      User ID: ${userId || 'not specified'}
      Debug Mode: ${debugMode ? 'enabled' : 'disabled'}
    `);

    // Handle WebSocket connection from Twilio
    socket.onopen = () => {
      console.log("[Twilio] WebSocket connection opened");
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle Twilio events
        switch (data.event) {
          case "start":
            // Store Stream SID when stream starts
            streamSid = data.start.streamSid;
            console.log(`[Twilio] Stream started with ID: ${streamSid}`);
            
            try {
              // Build the WebSocket URL with query parameters
              let wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
              
              if (voiceId) {
                wsUrl += `&voice_id=${voiceId}`;
              }
              
              console.log(`[ElevenLabs] Connecting to WebSocket at: ${wsUrl.substring(0, wsUrl.indexOf('?') + 20)}...`);
              
              // Connect to ElevenLabs WebSocket
              elevenlabsWs = new WebSocket(wsUrl);
              
              // Handle ElevenLabs WebSocket events
              elevenlabsWs.onopen = () => {
                console.log("[ElevenLabs] Connected to Conversational AI service");
              };
              
              elevenlabsWs.onmessage = (elevenlabsEvent) => {
                try {
                  const message = JSON.parse(elevenlabsEvent.data);
                  handleElevenLabsMessage(message, socket);
                } catch (error) {
                  console.error("[ElevenLabs] Error parsing message:", error);
                }
              };
              
              elevenlabsWs.onerror = (error) => {
                console.error("[ElevenLabs] WebSocket error:", error);
                // Send an error message back to Twilio
                if (streamSid) {
                  const errorMessage = {
                    event: "mark",
                    streamSid,
                    mark: { name: "error", value: "elevenlabs_connection_error" }
                  };
                  socket.send(JSON.stringify(errorMessage));
                }
              };
              
              elevenlabsWs.onclose = (closeEvent) => {
                console.log(`[ElevenLabs] Disconnected from Conversational AI service. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`);
              };
            } catch (error) {
              console.error("[ElevenLabs] Error connecting to service:", error);
              // Send an error message back to Twilio
              if (streamSid) {
                const errorMessage = {
                  event: "mark",
                  streamSid,
                  mark: { name: "error", value: "elevenlabs_connection_failed" }
                };
                socket.send(JSON.stringify(errorMessage));
              }
            }
            break;
            
          case "media":
            // Forward audio from Twilio to ElevenLabs
            if (elevenlabsWs && elevenlabsWs.readyState === WebSocket.OPEN) {
              const audioMessage = {
                user_audio_chunk: data.media.payload // Already base64 encoded
              };
              elevenlabsWs.send(JSON.stringify(audioMessage));
              
              if (debugMode) {
                console.log("[Twilio] Received audio chunk of size: " + 
                  data.media.payload.length + " bytes");
              }
            }
            break;
            
          case "stop":
            // Close ElevenLabs WebSocket when Twilio stream stops
            if (elevenlabsWs) {
              console.log(`[Twilio] Stream ${streamSid} stopped. Closing ElevenLabs connection.`);
              elevenlabsWs.close();
              elevenlabsWs = null;
            }
            streamSid = null;
            break;
            
          default:
            if (debugMode) {
              console.log(`[Twilio] Received unhandled event: ${data.event}`);
            }
        }
      } catch (error) {
        console.error("[Twilio] Error processing message:", error);
      }
    };

    socket.onclose = (closeEvent) => {
      console.log(`[Twilio] WebSocket connection closed. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`);
      if (elevenlabsWs) {
        elevenlabsWs.close();
        elevenlabsWs = null;
      }
    };

    socket.onerror = (error) => {
      console.error("[Twilio] WebSocket error:", error);
      if (elevenlabsWs) {
        elevenlabsWs.close();
        elevenlabsWs = null;
      }
    };

    // Function to handle messages from ElevenLabs
    function handleElevenLabsMessage(message: any, twilioSocket: WebSocket) {
      if (debugMode && message.type !== 'ping') {
        console.log(`[ElevenLabs] Received message type: ${message.type}`);
      }
      
      switch (message.type) {
        case "conversation_initiation_metadata":
          console.info("[ElevenLabs] Received conversation initiation metadata");
          break;
          
        case "audio":
          if (message.audio_event?.audio_base_64) {
            // Send audio data to Twilio
            const audioData = {
              event: "media",
              streamSid,
              media: {
                payload: message.audio_event.audio_base_64,
              },
            };
            twilioSocket.send(JSON.stringify(audioData));
            
            if (debugMode) {
              console.log("[ElevenLabs] Sent audio chunk of size: " + 
                message.audio_event.audio_base_64.length + " bytes");
            }
          }
          break;
          
        case "interruption":
          // Clear Twilio's audio queue
          console.log("[ElevenLabs] Received interruption event, clearing audio queue");
          twilioSocket.send(JSON.stringify({ event: "clear", streamSid }));
          break;
          
        case "ping":
          // Respond to ping events from ElevenLabs
          if (message.ping_event?.event_id) {
            const pongResponse = {
              type: "pong",
              event_id: message.ping_event.event_id,
            };
            elevenlabsWs?.send(JSON.stringify(pongResponse));
          }
          break;
          
        case "transcript":
          // Log transcript events from ElevenLabs
          if (message.transcript_event?.text) {
            console.log(`[ElevenLabs] Transcript: ${message.transcript_event.text}`);
          }
          break;
          
        case "error":
          console.error(`[ElevenLabs] Error from service: ${message.error_event?.message || "Unknown error"}`);
          // Send an error message back to Twilio
          if (streamSid) {
            const errorMessage = {
              event: "mark",
              streamSid,
              mark: { name: "error", value: "elevenlabs_error" }
            };
            twilioSocket.send(JSON.stringify(errorMessage));
          }
          break;
      }
    }

    // Return the response that successfully upgrades the connection to WebSocket
    return response;
  } catch (error) {
    console.error("Error handling WebSocket connection:", error);
    return new Response(JSON.stringify({ error: "Failed to establish WebSocket connection" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
