
import { twiml } from './twilio-helper.ts';

/**
 * XML encodes URL parameters for Twilio
 */
export function encodeXmlUrl(baseUrl: string, params: Record<string, string | undefined>) {
  const url = new URL(baseUrl);
  
  // Add parameters that are not undefined
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
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
  // Create Gather with specified options
  const gather = response.gather({
    input: 'speech dtmf',
    action: action,
    ...options
  });
  
  // Add the Say element inside Gather with text as string
  // Make sure the text is definitely a string
  const textToSay = typeof sayText === 'string' ? sayText : 'How can I assist you today?';
  
  if (options.voice) {
    gather.say({ voice: options.voice }, textToSay);
  } else {
    gather.say(textToSay);
  }
  
  // Return the gather element in case it's needed
  return gather;
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
