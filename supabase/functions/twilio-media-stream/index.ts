
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log(`Function "twilio-media-stream" up and running!`);

// Pre-generated error message audio in base64 format
// This is a real base64 encoded μ-law 8kHz audio file containing "We're sorry, but there was an error connecting to the AI assistant"
const ERROR_AUDIO = "UklGRpAdAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YXAdAAD//wkJ//9aWv///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3//wAA//8AAP//AAD//wAA//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//+amv///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39/////////8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize error variable to track issues
  let error = null;
  let connectionError = false;
  
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");
    const voiceId = url.searchParams.get("voice_id");
    const userId = url.searchParams.get("user_id");
    const callLogId = url.searchParams.get("call_log_id");
    const debug = url.searchParams.get("debug") === "true";
    
    if (!agentId) {
      throw new Error("Agent ID is required");
    }
    
    console.log(`Initializing media stream with:
      Agent ID: ${agentId}
      Voice ID: ${voiceId || 'not specified'}
      User ID: ${userId || 'not specified'}
      Call Log ID: ${callLogId || 'not specified'}
      Debug Mode: ${debug ? 'enabled' : 'disabled'}
    `);
    
    // Prepare for WebSocket upgrade
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Initialize Supabase client for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // If we have a userId, fetch the ElevenLabs API key
    let elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    let elevenlabsKeySource = "environment";
    
    if (userId) {
      console.log(`Fetching ElevenLabs API key for user: ${userId}`);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('elevenlabs_api_key')
        .eq('id', userId)
        .maybeSingle();
        
      if (profileError) {
        console.error("Error fetching user profile:", profileError);
      } else if (profile && profile.elevenlabs_api_key) {
        elevenlabsApiKey = profile.elevenlabs_api_key;
        elevenlabsKeySource = "user profile";
        console.log("Successfully retrieved user's ElevenLabs API key");
      } else {
        console.warn("User doesn't have an ElevenLabs API key configured");
      }
    }
    
    if (!elevenlabsApiKey) {
      console.error("ElevenLabs API key not available!");
      throw new Error("ElevenLabs API key not available. Please add it to your profile or environment variables.");
    } else {
      console.log(`Using ElevenLabs API key from ${elevenlabsKeySource}`);
    }
    
    // Validate API key format
    if (elevenlabsApiKey.length < 32) {
      console.error("ElevenLabs API key format appears to be invalid (too short)");
      throw new Error("ElevenLabs API key appears to be invalid. Please check your API key and try again.");
    }
    
    // Prepare WebSocket URL for ElevenLabs
    const wsParams = new URLSearchParams();
    wsParams.append("agent_id", agentId);
    
    if (voiceId) {
      wsParams.append("voice_id", voiceId);
    }
    
    // Configure input and output formats for telephony
    wsParams.append("input_format", "mulaw_8000");
    wsParams.append("output_format", "mulaw_8000");
    
    const elevenlabsWsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?${wsParams.toString()}`;
    console.log(`Connecting to ElevenLabs WebSocket: ${elevenlabsWsUrl}`);
    
    // Create a promise to track ElevenLabs connection status
    let elevenLabsConnectionPromise;
    let elevenLabsConnectionResolver;
    
    elevenLabsConnectionPromise = new Promise((resolve) => {
      elevenLabsConnectionResolver = resolve;
    });
    
    // Connect to ElevenLabs WebSocket with timeout
    const elevenlabsWebSocket = new WebSocket(elevenlabsWsUrl);
    let streamSid = null;
    let connectionTimeout = null;
    
    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      if (elevenlabsWebSocket.readyState !== WebSocket.OPEN) {
        console.error("ElevenLabs connection timeout after 10 seconds");
        connectionError = true;
        elevenlabsWebSocket.close();
        elevenLabsConnectionResolver(false);
        
        // Send error message to client if streamSid is available
        if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
          sendErrorAudio(clientSocket, streamSid);
        }
      }
    }, 10000);
    
    // Set authorization header
    elevenlabsWebSocket.onopen = () => {
      console.log("Connected to ElevenLabs WebSocket");
      
      // Send authorization
      const authMessage = JSON.stringify({
        "xi-api-key": elevenlabsApiKey
      });
      
      elevenlabsWebSocket.send(authMessage);
      console.log("Sent authorization to ElevenLabs");
      
      // Clear connection timeout
      clearTimeout(connectionTimeout);
    };
    
    // Handle messages from Twilio
    clientSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event === "start") {
          console.log(`Twilio stream started with ID: ${message.start.streamSid}`);
          streamSid = message.start.streamSid;
          
          // If connection error already occurred, send error audio immediately
          if (connectionError && clientSocket.readyState === WebSocket.OPEN) {
            sendErrorAudio(clientSocket, streamSid);
          }
        } else if (message.event === "media") {
          // Forward audio from Twilio to ElevenLabs
          if (elevenlabsWebSocket.readyState === WebSocket.OPEN) {
            const audioChunk = {
              user_audio_chunk: message.media.payload
            };
            elevenlabsWebSocket.send(JSON.stringify(audioChunk));
          }
        } else if (message.event === "stop") {
          console.log("Twilio stream stopped");
          elevenlabsWebSocket.close();
        }
      } catch (err) {
        console.error("Error handling message from Twilio:", err);
      }
    };
    
    // Handle messages from ElevenLabs
    elevenlabsWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (debug) {
          console.log(`[DEBUG] Message from ElevenLabs: ${event.data.substring(0, 200)}...`);
        }
        
        // Check for connection success
        if (data.type === "conversation_initiation_metadata") {
          console.log("Received conversation initiation metadata, connection successful");
          elevenLabsConnectionResolver(true);
        }
        
        if (data.type === "audio" && data.audio_event?.audio_base_64) {
          const audioData = {
            event: "media",
            streamSid,
            media: {
              payload: data.audio_event.audio_base_64
            }
          };
          clientSocket.send(JSON.stringify(audioData));
        } else if (data.type === "interruption") {
          // Clear Twilio's audio queue
          const clearMessage = JSON.stringify({ 
            event: "clear",
            streamSid 
          });
          clientSocket.send(clearMessage);
        } else if (data.type === "ping" && data.ping_event?.event_id) {
          // Respond to ping events from ElevenLabs
          const pongResponse = {
            type: "pong",
            event_id: data.ping_event.event_id
          };
          elevenlabsWebSocket.send(JSON.stringify(pongResponse));
        } else if (data.type === "conversation_initiation_metadata") {
          console.log("Received conversation initiation metadata:", 
                      data.conversation_initiation_metadata_event);
        } else if (data.type === "user_transcript" || data.type === "agent_response") {
          // Log transcript for debugging
          console.log(`${data.type}: ${JSON.stringify(data)}`);
          
          // Store transcript in call log if we have callLogId
          if (callLogId) {
            updateCallLog(supabase, callLogId, data).catch(console.error);
          }
        } else if (data.type === "error") {
          console.error("ElevenLabs error:", data);
          
          // Try to send an error message to the caller
          if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
            sendErrorAudio(clientSocket, streamSid);
          }
        }
      } catch (err) {
        console.error("Error handling message from ElevenLabs:", err);
      }
    };
    
    // Handle socket closures
    clientSocket.onclose = () => {
      console.log("Twilio WebSocket closed");
      if (elevenlabsWebSocket.readyState === WebSocket.OPEN) {
        elevenlabsWebSocket.close();
      }
    };
    
    elevenlabsWebSocket.onclose = (event) => {
      console.log(`ElevenLabs WebSocket closed with code: ${event.code}, reason: ${event.reason || "Unknown reason"}`);
      elevenLabsConnectionResolver(false);
      
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };
    
    // Handle errors
    clientSocket.onerror = (e) => {
      console.error("Twilio WebSocket error:", e);
      error = e;
    };
    
    elevenlabsWebSocket.onerror = (e) => {
      console.error("ElevenLabs WebSocket error:", e);
      error = e;
      connectionError = true;
      elevenLabsConnectionResolver(false);
      
      // Try to send a message to the user about the error
      try {
        if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
          sendErrorAudio(clientSocket, streamSid);
        }
      } catch (err) {
        console.error("Failed to send error message:", err);
      }
    };
    
    return response;
    
  } catch (err) {
    console.error("Error in twilio-media-stream:", err);
    
    // Return a proper error response
    return new Response(
      JSON.stringify({
        error: err.message || "An unexpected error occurred",
        details: error ? String(error) : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Helper function to update call log with transcript data
async function updateCallLog(supabase, callLogId, data) {
  try {
    // Use different approaches based on the message type
    if (data.type === "user_transcript" && data.user_transcription_event?.user_transcript) {
      const transcript = data.user_transcription_event.user_transcript;
      await supabase.rpc('append_to_transcript', {
        call_log_id: callLogId,
        speaker: 'user',
        text: transcript
      });
    } else if (data.type === "agent_response" && data.agent_response_event?.agent_response) {
      const response = data.agent_response_event.agent_response;
      await supabase.rpc('append_to_transcript', {
        call_log_id: callLogId,
        speaker: 'agent',
        text: response
      });
    }
  } catch (err) {
    console.error("Error in updateCallLog:", err);
  }
}

// Helper function to send error audio to the client
function sendErrorAudio(clientSocket, streamSid) {
  try {
    console.log("Sending error audio message to client");
    const audioData = {
      event: "media",
      streamSid,
      media: {
        payload: ERROR_AUDIO
      }
    };
    clientSocket.send(JSON.stringify(audioData));
    
    // After sending the error audio, send a message that will hangup the call
    setTimeout(() => {
      const hangupMessage = {
        event: "mark",
        streamSid,
        mark: {
          name: "hangup"
        }
      };
      clientSocket.send(JSON.stringify(hangupMessage));
    }, 5000); // Wait 5 seconds to allow error message to play
  } catch (e) {
    console.error("Failed to send error audio:", e);
  }
}
