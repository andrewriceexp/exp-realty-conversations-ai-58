// supabase/functions/_shared/twiml-helpers.ts
import { twiml } from './twilio-helper.ts'; // twiml.VoiceResponse is now a class

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
      queryParams.append(key, params[key]!);
    }
  }
  const queryString = queryParams.toString();
  if (!queryString) {
    return baseUrl;
  }
  const xmlSafeQueryString = queryString.replace(/&/g, '&amp;');
  // console.log(`[twiml-helpers] encodeXmlUrl: original query="${queryString}", xmlSafeQuery="${xmlSafeQueryString}"`);
  return `${baseUrl}?${xmlSafeQueryString}`;
}

/**
 * Creates a properly structured Gather with Say element
 */
export function createGatherWithSay(
  responseInstance: any, // Should be an instance of new twiml.VoiceResponse()
  action: string, // Expect this to be ALREADY XML-encoded by encodeXmlUrl
  sayText: string,
  options: Record<string, any> = {}
): void {
  const gatherAttributes: Record<string, any> = {
    input: 'speech dtmf',
    method: 'POST',
    actionOnEmptyResult: true,
    ...options,
    action: action, // Action URL is mandatory and should be pre-encoded
  };

  // console.log(`[twiml-helpers] createGatherWithSay: actionUrl="${action}", sayText="${sayText}", gatherAttributes="${JSON.stringify(gatherAttributes)}"`);

  responseInstance.gather(gatherAttributes, (gatherNode: any) => { // gatherNode is the same responseInstance
    const textToSay = (typeof sayText === 'string' && sayText.trim() !== "") ? sayText.trim() : "How can I assist you today?";

    const sayAttributesInGather: Record<string, string> = {};
    if (options.voice) {
      sayAttributesInGather.voice = options.voice;
    } else {
      sayAttributesInGather.voice = 'alice';
    }

    gatherNode.say(sayAttributesInGather, textToSay);
    // console.log(`[twiml-helpers] createGatherWithSay: Nested <Say voice="${sayAttributesInGather.voice}">: "${textToSay}"`);
  });
}

/**
 * Helper to create error response TwiML
 */
export function createErrorResponse(message: string): string {
  const response = new twiml.VoiceResponse(); // FIXED: Added 'new' keyword
  const messageToSay = (message && message.trim() !== "") ? message.trim() : "An application error occurred.";
  response.say(messageToSay);
  response.hangup();
  const twimlString = response.toString();
  // console.log(`[twiml-helpers] createErrorResponse: "${twimlString}"`);
  return twimlString;
}

/**
 * Helper to create debug TwiML
 */
export function createDebugTwiML(info: Record<string, any>): string {
  const response = new twiml.VoiceResponse(); // FIXED: Added 'new' keyword
  response.say("Debug mode active.");
  for (const key in info) {
    if (info[key] !== undefined && info[key] !== null) {
      const valueStr = typeof info[key] === 'object' ? JSON.stringify(info[key]) : info[key].toString();
      response.say(`${key} is ${valueStr}`);
      response.pause({length: 1});
    }
  }
  response.hangup();
  const twimlString = response.toString();
  // console.log(`[twiml-helpers] createDebugTwiML: "${twimlString}"`);
  return twimlString;
}
