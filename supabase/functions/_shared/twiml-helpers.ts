
// Helper functions to generate TwiML responses for Twilio

/**
 * Escapes special characters for XML to prevent parsing errors
 * @param str String to escape
 * @returns Escaped string safe for XML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a TwiML response with a Connect and Stream tag
 * @param mediaStreamUrl The WebSocket stream URL to connect to
 * @param debug Whether to include additional debugging information
 * @returns TwiML response as a string
 */
export function generateTwiMLResponse(mediaStreamUrl: string, debug: boolean = false): string {
  // Escape the URL to make it safe for XML
  const escapedMediaStreamUrl = escapeXml(mediaStreamUrl);
  
  // Basic header for all TwiML responses
  let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

  // If debug mode is enabled, add a Say tag with debugging information
  if (debug) {
    twiml += `
  <Say>Debug mode is enabled. Connecting to media stream at ${truncateUrl(mediaStreamUrl)}.</Say>`;
  }

  // Add the Connect and Stream tags with properly escaped URL
  twiml += `
  <Connect>
    <Stream url="${escapedMediaStreamUrl}" />
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
  return escapeXml(`${urlObj.protocol}//${urlObj.host}${urlObj.pathname}?...`);
}

/**
 * Generates an error TwiML response
 * @param message Error message to say to the user
 * @returns TwiML response as a string
 */
export function generateErrorTwiML(message: string): string {
  const escapedMessage = escapeXml(message || "We're sorry, but an error occurred. Please try again later.");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapedMessage}</Say>
  <Hangup/>
</Response>`;
}
