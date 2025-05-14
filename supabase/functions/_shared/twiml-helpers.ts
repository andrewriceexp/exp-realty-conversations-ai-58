
import { corsHeaders } from "./cors.ts";

/**
 * Creates a TwiML response for establishing a WebSocket connection
 * @param host The host URL for the WebSocket connection
 * @returns TwiML string to establish a WebSocket connection
 */
export function createWebSocketStreamTwiML(host: string): string {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/twilio-media-stream" />
  </Connect>
</Response>`;
  return twiml;
}

/**
 * Creates a TwiML response that handles timeouts and errors
 * @param debugMode If true, adds additional debugging information
 * @returns TwiML string with timeout handling
 */
export function createTimeoutSafetyTwiML(debugMode = false): string {
  const debugInfo = debugMode ? 
    "<Say>Debug mode active. This is a voice connection test.</Say>" : "";
    
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${debugInfo}
  <Say>Connecting to your ElevenLabs agent. Please wait a moment.</Say>
  <Pause length="2"/>
  <Say>We're experiencing a brief connection delay. Please stay on the line.</Say>
  <Pause length="5"/>
  <Say>Sorry, we're having trouble establishing the connection. Please try again later.</Say>
</Response>`;
  return twiml;
}

/**
 * Helper function for responding with a TwiML in case of errors
 * @param errorMessage The error message to include
 * @param debugMode If true, includes more detailed error information
 * @returns TwiML string with error information
 */
export function createErrorTwiML(errorMessage: string, debugMode = false): string {
  const debugInfo = debugMode ? 
    `<Say>Debug information: ${errorMessage}</Say>` : "";
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, we encountered an error connecting to our AI system.</Say>
  ${debugInfo}
</Response>`;
  return twiml;
}

/**
 * Creates a Response object with TwiML content and proper headers
 * @param twiml The TwiML string to include in the response
 * @returns Response object with TwiML content
 */
export function createTwiMLResponse(twiml: string): Response {
  return new Response(twiml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/xml",
    },
  });
}
