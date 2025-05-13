// supabase/functions/_shared/twiml-helpers.ts
import { twiml } from './twilio-helper.ts'; // Assuming twiml is correctly exported from your twilio-helper and VoiceResponse is a class

/**
 * Encodes a URL with query parameters for safe use in TwiML attributes.
 * Specifically, it replaces ampersands with &amp;
 * @param baseUrl - The base URL without query string.
 * @param params - An object of query parameters.
 * @returns The fully constructed URL with ampersands XML-encoded.
 */
export function encodeXmlUrl(baseUrl: string, params: Record<string, string | undefined>): string {
  const queryParams = new URLSearchParams();
  for (const key in params) {
    if (params[key] !== undefined) {
      queryParams.append(key, params[key]!); // Assert non-undefined with '!'
    }
  }
  const queryString = queryParams.toString();
  if (!queryString) {
    return baseUrl;
  }
  // IMPORTANT: Replace '&' with '&amp;' for XML validity in TwiML attributes
  const xmlSafeQueryString = queryString.replace(/&/g, '&amp;');
  console.log(`[twiml-helpers] encodeXmlUrl: original query="${queryString}", xmlSafeQuery="${xmlSafeQueryString}"`);
  return `${baseUrl}?${xmlSafeQueryString}`;
}

/**
 * Creates a properly structured Gather with Say element
 * This function ensures proper nesting of Say within Gather
 */
export function createGatherWithSay(
  response: any, // Should be an instance of twiml.VoiceResponse class
  action: string, // Expect this to be ALREADY XML-encoded by encodeXmlUrl
  sayText: string,
  options: Record<string, any> = {} // e.g., { voice: 'Polly.Joanna-Neural', timeout: 10, actionOnEmptyResult: true }
): void {
  const gatherAttributes: Record<string, any> = {
    input: 'speech dtmf', // Default input type
    method: 'POST',       // Default method
    actionOnEmptyResult: true, // Default to true, critical for robust flow
    ...options,         // Allow overriding defaults
    action: action,     // Action URL is mandatory and should be pre-encoded
  };

  console.log(`[twiml-helpers] createGatherWithSay: actionUrl="${action}", sayText="${sayText}", gatherAttributes="${JSON.stringify(gatherAttributes)}"`);

  // Assuming 'response' is an instance of your VoiceResponse class which has a 'gather' method
  const gatherNode = response.gather(gatherAttributes, (nestedGatherNode: any) => {
    const textToSay = (typeof sayText === 'string' && sayText.trim() !== "") ? sayText.trim() : "How can I assist you today?";
  
    const sayAttributesInGather: Record<string, string> = {};
    if (options.voice) {
      sayAttributesInGather.voice = options.voice;
    } else {
      sayAttributesInGather.voice = 'alice'; 
    }
    
    nestedGatherNode.say(sayAttributesInGather, textToSay);
    console.log(`[twiml-helpers] createGatherWithSay: Nested <Say voice="${sayAttributesInGather.voice}">: "${textToSay}"`);
  });
}

/**
 * Helper to create error response TwiML
 */
export function createErrorResponse(message: string): string {
  const response = new twiml.VoiceResponse(); // FIXED: Added 'new' keyword
  const messageToSay = (message && message.trim() !== "") ? message.trim() : "An application error occurred.";
  response.say(messageToSay); // Assuming .say() is a method of the instance
  response.hangup(); // Assuming .hangup() is a method of the instance
  const twimlString = response.toString();
  console.log(`[twiml-helpers] createErrorResponse: "${twimlString}"`);
  return twimlString;
}

/**
 * Helper to create debug TwiML (example, ensure it's used if needed)
 */
export function createDebugTwiML(info: Record<string, any>): string {
  const response = new twiml.VoiceResponse(); // FIXED: Added 'new' keyword
  response.say("Debug mode active."); 
  for (const key in info) {
    if (info[key] !== undefined && info[key] !== null) {
      // Ensure the value is a string before passing to say
      const valueStr = typeof info[key] === 'object' ? JSON.stringify(info[key]) : info[key].toString();
      response.say(`${key} is ${valueStr}`);
      response.pause({length: 1}); 
    }
  }
  response.hangup();
  const twimlString = response.toString();
  console.log(`[twiml-helpers] createDebugTwiML: "${twimlString}"`);
  return twimlString;
}
