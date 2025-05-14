
// Helper functions for TwiML generation

/**
 * Create a TwiML response with a WebSocket stream
 * @param host - The host server URL
 * @param agentId - Optional ElevenLabs agent ID
 * @returns XML string for TwiML response
 */
export function createWebSocketStreamTwiML(host: string, params?: Record<string, string>): string {
  // Build the WebSocket URL for media streaming
  let mediaStreamUrl = `wss://${host}/twilio-media-stream`;
  
  // Add URL parameters if present
  if (params) {
    const urlParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        urlParams.append(key, value);
      }
    }
    
    const paramString = urlParams.toString();
    if (paramString) {
      mediaStreamUrl += `?${paramString}`;
    }
  }

  // Create the TwiML response with WebSocket stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${mediaStreamUrl}" />
  </Connect>
</Response>`;

  return twiml;
}

/**
 * Create a standard TwiML HTTP response
 * @param twimlString - TwiML XML string
 * @param headers - Additional headers to include
 * @returns Response object
 */
export function createTwiMLResponse(twimlString: string, headers: Record<string, string> = {}): Response {
  return new Response(twimlString, {
    headers: {
      'Content-Type': 'text/xml',
      ...headers
    }
  });
}

/**
 * Create an error response in TwiML format
 * @param errorMessage - Error message to include
 * @returns TwiML string with error message
 */
export function createErrorResponse(errorMessage: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Error: ${errorMessage}</Say>
  <Hangup />
</Response>`;
}

/**
 * Encode URL parameters safely for use in TwiML
 * @param baseUrl - Base URL for the webhook
 * @param params - URL parameters to encode
 * @returns XML-safe encoded URL 
 */
export function encodeXmlUrl(baseUrl: string, params: Record<string, string | undefined>): string {
  // Build URL with parameters
  const url = new URL(baseUrl);
  
  // Add parameters that are defined
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.append(key, value);
    }
  }
  
  // XML-encode the URL
  return url.toString().replace(/&/g, '&amp;');
}

/**
 * Helper to create a TwiML Gather with Say element 
 * Ensures proper nesting and voice attributes are applied correctly
 */
export function createGatherWithSay(
  response: any, 
  actionUrl: string, 
  sayText: string, 
  gatherOptions: Record<string, any> = {}
) {
  // Create the Gather element with proper action URL
  const gather = response.gather({
    input: 'speech dtmf',
    action: actionUrl,
    ...gatherOptions
  });
  
  // Add Say element inside the Gather
  gather.say(sayText);
  
  return gather;
}

/**
 * Create a safe TwiML response with timeout protection
 * This prevents the function from hanging if TwiML generation times out
 */
export function createTimeoutSafetyTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>I'm sorry, but I'm having trouble understanding. Please try again later.</Say>
  <Pause length="1"/>
  <Hangup />
</Response>`;
}
