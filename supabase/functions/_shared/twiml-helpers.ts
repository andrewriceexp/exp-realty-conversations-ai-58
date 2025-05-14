
import { twiml } from './twilio-helper.ts';

/**
 * Properly XML encodes URL parameters for Twilio
 * This function ensures URLs are properly encoded for XML attributes
 */
export function encodeXmlUrl(baseUrl: string, params: Record<string, string | undefined>) {
  // First, build a URL object with parameters
  const url = new URL(baseUrl);
  
  // Add parameters that are not undefined
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value);
    }
  });
  
  // Now, get the full URL and XML-encode special characters
  // This is critical for XML attributes to prevent parsing errors
  let fullUrl = url.toString();
  
  // Encode ampersands for XML attributes (& -> &amp;)
  fullUrl = fullUrl.replace(/&/g, '&amp;');
  
  console.log(`Encoded XML URL: ${fullUrl}`);
  return fullUrl;
}

/**
 * Creates a properly structured Gather with Say element
 * This function ensures proper nesting of Say within Gather
 */
export function createGatherWithSay(
  response: any, 
  action: string, 
  sayText: string,
  options: Record<string, any> = {}
) {
  // Ensure action URL is XML-encoded
  const xmlEncodedAction = action.replace(/&/g, '&amp;');
  
  // Make sure the text is definitely a string
  const textToSay = typeof sayText === 'string' ? sayText : 'How can I assist you today?';
  
  // Extract voice from options before creating Gather
  const voice = options.voice;
  delete options.voice; // Remove voice from Gather options
  
  // Create Gather with the clean options (no voice attribute)
  const gather = response.gather({
    input: 'speech dtmf',
    action: xmlEncodedAction,
    ...options
  });
  
  // Add the Say element inside Gather with voice if provided
  if (voice) {
    gather.say({ voice }, textToSay);
  } else {
    gather.say(textToSay);
  }
  
  // Return the response object for chaining
  return response;
}

/**
 * Helper to create error response TwiML
 */
export function createErrorResponse(message: string): string {
  const response = twiml.VoiceResponse();
  response.say(message);
  response.hangup();
  return response.toString();
}
