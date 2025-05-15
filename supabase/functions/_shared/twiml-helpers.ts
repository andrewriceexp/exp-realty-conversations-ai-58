// Helper functions to generate TwiML responses for Twilio

/**
 * Generates a TwiML response with a Connect and Stream tag
 * @param mediaStreamUrl The WebSocket stream URL to connect to
 * @param debug Whether to include additional debugging information
 * @returns TwiML response as a string
 */
export function generateTwiMLResponse(mediaStreamUrl: string, debug: boolean = false): string {
  // Basic header for all TwiML responses
  let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

  // If debug mode is enabled, add a Say tag with debugging information
  if (debug) {
    twiml += `
  <Say>Debug mode is enabled. Connecting to media stream at ${truncateUrl(mediaStreamUrl)}.</Say>`;
  }

  // Add the Connect and Stream tags
  twiml += `
  <Connect>
    <Stream url="${mediaStreamUrl}" />
  </Connect>`;

  // Close the Response tag
  twiml += `
</Response>`;

  return twiml;
}

/**
 * Helper function to truncate URLs for logging/debugging
 * @param url The URL to truncate
 * @returns Truncated URL
 */
function truncateUrl(url: string): string {
  // Keep the protocol and host, but truncate the query string
  const urlObj = new URL(url);
  return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}?...`;
}

/**
 * Generates an error TwiML response
 * @param message Error message to say to the user
 * @returns TwiML response as a string
 */
export function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message || "We're sorry, but an error occurred. Please try again later."}</Say>
  <Hangup/>
</Response>`;
}
