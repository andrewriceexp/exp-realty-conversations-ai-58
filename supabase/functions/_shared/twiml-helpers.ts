
import { twiml } from "./twilio-helper.ts";

/**
 * Encodes a URL with parameters for safe use in TwiML
 * This ensures that the '&' characters in the URL are properly encoded as '&amp;'
 * @param baseUrl The base URL without query parameters
 * @param params An object containing the query parameters to add
 * @returns A properly encoded URL string safe for use in XML/TwiML
 */
export function encodeXmlUrl(baseUrl: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(baseUrl);
  
  // Add each parameter to the URL if it's defined
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  }
  
  // Replace all & with &amp; for XML compatibility
  return url.toString().replace(/&/g, '&amp;');
}

/**
 * Creates a properly structured TwiML <Gather> with <Say> for collecting speech input
 * @param response The TwiML voice response to build upon
 * @param actionUrl The URL to post gathered input to (already XML-encoded)
 * @param message The text to speak in the gather
 * @param options Additional gather options
 * @returns The modified TwiML response
 */
export function createGatherWithSay(
  response: any,
  actionUrl: string,
  message: string,
  options: {
    timeout?: number;
    speechTimeout?: string;
    language?: string;
    voice?: string;
    method?: string;
  } = {}
) {
  const gather = response.gather({
    input: 'speech dtmf',
    action: actionUrl,
    method: options.method || 'POST',
    timeout: options.timeout || 10,
    speechTimeout: options.speechTimeout || 'auto',
    language: options.language || 'en-US'
  });
  
  // Add the message inside the gather
  if (options.voice) {
    gather.say({ voice: options.voice }, message);
  } else {
    gather.say(message);
  }
  
  return response;
}

/**
 * Creates a standard error response when something goes wrong
 * @param errorMessage The error message to communicate to the caller
 * @returns TwiML string ready to be included in a Response
 */
export function createErrorResponse(errorMessage = "I'm sorry, there was an error processing this call. Please try again later.") {
  const response = twiml.VoiceResponse();
  response.say(errorMessage);
  response.hangup();
  
  return response.toString();
}
