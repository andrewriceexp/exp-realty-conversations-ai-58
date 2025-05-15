
// Import required packages
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log(`Function "twilio-media-stream" up and running!`);

// Define an error helper function for consistent error handling and logging
function formatError(error: Error | string): string {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : "No stack trace available";
  console.error(`Error: ${message}\nStack: ${stack}`);
  return message;
}

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Check if the request is a WebSocket upgrade request
    const upgradeHeader = req.headers.get("upgrade") || "";
    if (upgradeHeader.toLowerCase() !== "websocket") {
      console.error("Expected WebSocket connection, received regular HTTP request");
      return new Response("Expected WebSocket connection", { 
        status: 400, 
        headers: corsHeaders 
      });
    }
    
    // Get query parameters from URL
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");
    const voiceId = url.searchParams.get("voice_id");
    const userId = url.searchParams.get("user_id");
    const callLogId = url.searchParams.get("call_log_id");
    const debug = url.searchParams.get("debug") === "true";
    
    // Verify that required parameters are present
    if (!agentId) {
      const errorMessage = "Missing required parameter: agent_id";
      console.error(errorMessage);
      return new Response(errorMessage, { 
        status: 400, 
        headers: corsHeaders 
      });
    }
    
    // Add detailed logging for debugging
    console.log("WebSocket connection request with params:", {
      agentId,
      voiceId: voiceId || "default",
      userId: userId || "none",
      callLogId: callLogId || "none",
      debug
    });
    
    try {
      // Upgrade the connection to WebSocket
      const { socket: twilioSocket, response } = Deno.upgradeWebSocket(req);
      
      console.log("WebSocket connection established with Twilio");
      
      // Parameters for ElevenLabs WebSocket URL
      const elevenLabsParams = new URLSearchParams();
      elevenLabsParams.append("agent_id", agentId);
      
      // Add optional parameters if available
      if (voiceId) elevenLabsParams.append("voice_id", voiceId);
      
      // CRITICAL: Always specify the audio format for telephony use cases
      elevenLabsParams.append("input_format", "mulaw_8000");
      elevenLabsParams.append("output_format", "mulaw_8000");
      
      // Construct the ElevenLabs WebSocket URL
      const elevenLabsWsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?${elevenLabsParams.toString()}`;
      
      console.log(`Connecting to ElevenLabs at ${elevenLabsWsUrl}`);
      
      // Set up variables for state management
      let streamSid: string | null = null;
      let callSid: string | null = null;
      let elevenLabsSocket: WebSocket | null = null;
      let pingTimeout: number | null = null;
      
      // Create a function to handle reconnection logic if needed
      const connectToElevenLabs = () => {
        try {
          console.log("Establishing connection to ElevenLabs");
          
          // Create WebSocket connection to ElevenLabs
          elevenLabsSocket = new WebSocket(elevenLabsWsUrl);
          
          // Handle successful connection
          elevenLabsSocket.onopen = () => {
            console.log("Connected to ElevenLabs Conversational AI WebSocket");
            
            // If we have an API key, send it as the first message for authentication
            const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
            if (apiKey) {
              console.log("Sending API key for authentication");
              elevenLabsSocket?.send(JSON.stringify({"xi-api-key": apiKey}));
            }
          };
          
          // Handle messages from ElevenLabs
          elevenLabsSocket.onmessage = (event) => {
            try {
              // Parse the message from ElevenLabs
              const message = JSON.parse(event.data);
              
              // Log the message type (but don't log audio data)
              if (message.type !== "audio" && message.type !== "ping") {
                console.log(`Received message from ElevenLabs: ${message.type}`);
              } else if (message.type === "ping") {
                console.log("Received ping from ElevenLabs");
              }
              
              // Handle different message types
              switch (message.type) {
                case "conversation_initiation_metadata":
                  console.log("Conversation initialized with ElevenLabs");
                  break;
                  
                case "audio":
                  // Only forward audio if we have a valid stream ID
                  if (!streamSid) {
                    console.warn("Received audio but no StreamSid available");
                    break;
                  }
                  
                  // Handle audio from ElevenLabs and forward to Twilio
                  if (message.audio_event?.audio_base_64) {
                    // Construct the media event for Twilio
                    const audioData = {
                      event: "media",
                      streamSid,
                      media: {
                        payload: message.audio_event.audio_base_64
                      }
                    };
                    
                    // Send the audio data to Twilio
                    twilioSocket.send(JSON.stringify(audioData));
                  }
                  break;
                  
                case "interruption":
                  // Handle interruption events by clearing Twilio's audio queue
                  console.log("Received interruption event from ElevenLabs");
                  if (streamSid) {
                    const clearMessage = {
                      event: "clear",
                      streamSid
                    };
                    twilioSocket.send(JSON.stringify(clearMessage));
                  }
                  break;
                  
                case "ping":
                  // Respond to ping events from ElevenLabs
                  if (message.ping_event?.event_id) {
                    const pongResponse = {
                      type: "pong",
                      event_id: message.ping_event.event_id
                    };
                    elevenLabsSocket?.send(JSON.stringify(pongResponse));
                    
                    // Reset ping timeout
                    if (pingTimeout) {
                      clearTimeout(pingTimeout);
                    }
                    
                    // Set new ping timeout (30 seconds)
                    pingTimeout = setTimeout(() => {
                      console.warn("No ping received from ElevenLabs for 30 seconds, closing connection");
                      elevenLabsSocket?.close();
                    }, 30000);
                  }
                  break;
                  
                case "error":
                  // Log error messages from ElevenLabs
                  console.error("Error from ElevenLabs:", message.error || "Unknown error");
                  break;
                  
                default:
                  // Log any other message types
                  console.log(`Unhandled message type from ElevenLabs: ${message.type}`);
              }
            } catch (error) {
              console.error("Error processing message from ElevenLabs:", formatError(error));
            }
          };
          
          // Handle errors from ElevenLabs WebSocket
          elevenLabsSocket.onerror = (error) => {
            console.error("ElevenLabs WebSocket error:", error);
          };
          
          // Handle disconnection from ElevenLabs
          elevenLabsSocket.onclose = (event) => {
            console.log(`Disconnected from ElevenLabs: Code ${event.code}, Reason: ${event.reason || "No reason provided"}`);
            
            // Clear ping timeout
            if (pingTimeout) {
              clearTimeout(pingTimeout);
              pingTimeout = null;
            }
          };
          
          return true;
        } catch (error) {
          console.error("Error establishing connection to ElevenLabs:", formatError(error));
          return false;
        }
      };
      
      // Initial connection to ElevenLabs
      if (!connectToElevenLabs()) {
        throw new Error("Failed to establish connection to ElevenLabs");
      }
      
      // Handle messages from Twilio
      twilioSocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log all non-media events
          if (data.event !== "media") {
            console.log(`Received ${data.event} event from Twilio`);
          }
          
          // Handle different event types
          switch (data.event) {
            case "start":
              // Store Stream SID and Call SID when the stream starts
              streamSid = data.start.streamSid;
              callSid = data.start.callSid;
              console.log(`Stream started with StreamSid: ${streamSid}, CallSid: ${callSid}`);
              break;
              
            case "media":
              // Forward audio from Twilio to ElevenLabs if connection is open
              if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
                try {
                  // Construct the message for ElevenLabs
                  const audioMessage = {
                    user_audio_chunk: data.media.payload
                  };
                  
                  // Send the audio data to ElevenLabs
                  elevenLabsSocket.send(JSON.stringify(audioMessage));
                } catch (error) {
                  console.error("Error sending audio to ElevenLabs:", formatError(error));
                }
              }
              break;
              
            case "stop":
              // Close ElevenLabs WebSocket when Twilio stream stops
              console.log(`Stream ${streamSid} ended`);
              if (elevenLabsSocket) {
                elevenLabsSocket.close();
              }
              
              // Clear state variables
              streamSid = null;
              callSid = null;
              break;
              
            default:
              console.log(`Unhandled event from Twilio: ${data.event}`);
          }
        } catch (error) {
          console.error("Error processing message from Twilio:", formatError(error));
        }
      };
      
      // Handle disconnection from Twilio
      twilioSocket.onclose = () => {
        console.log("Twilio client disconnected");
        
        // Clean up resources
        if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
          elevenLabsSocket.close();
        }
        
        if (pingTimeout) {
          clearTimeout(pingTimeout);
          pingTimeout = null;
        }
      };
      
      // Handle errors from Twilio WebSocket
      twilioSocket.onerror = (error) => {
        console.error("Twilio WebSocket error:", error);
        
        // Clean up resources on error
        if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
          elevenLabsSocket.close();
        }
        
        if (pingTimeout) {
          clearTimeout(pingTimeout);
          pingTimeout = null;
        }
      };
      
      // Return the upgraded WebSocket response
      return response;
    } catch (error) {
      console.error("Error establishing WebSocket connection:", formatError(error));
      return new Response(`WebSocket error: ${error instanceof Error ? error.message : String(error)}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  } catch (error) {
    const errorMessage = formatError(error);
    console.error("Unhandled error in twilio-media-stream:", errorMessage);
    return new Response(`Internal server error: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
