// supabase/functions/_shared/twilio-helper.ts
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// validateTwilioRequest remains largely the same as your provided version,
// but ensure it uses the rawBody parameter if you pass it from the calling function.
// For this example, I'm keeping your version's logic for reading the body.
export async function validateTwilioRequest(
    req: Request, 
    url: string, // This should be the full URL Twilio POSTed to, including original query string for logging, but base URL for calculation
    twilioAuthToken?: string | null, 
    bypassValidation?: boolean,
    // rawBody?: string // Optional: if you prefer to pass the raw body string
): Promise<boolean> {
  const requestTimestamp = new Date().toISOString();
  console.log(`[${requestTimestamp}] [twilio-helper] Validating Twilio request. Bypass: ${bypassValidation}`);
  
  if (bypassValidation) {
    console.warn(`[${requestTimestamp}] [twilio-helper] ⚠️ VALIDATION BYPASSED - This should only be used for testing!`);
    return true;
  }
  
  const twilioSignature = req.headers.get('x-twilio-signature');
  if (!twilioSignature) {
    console.error(`[${requestTimestamp}] [twilio-helper] Missing X-Twilio-Signature header. Validation FAILED.`);
    return false; // Strict validation: fail if no signature
  }
  
  if (!twilioAuthToken) {
    console.error(`[${requestTimestamp}] [twilio-helper] Missing twilioAuthToken for validation. Validation FAILED.`);
    return false; // Strict validation: fail if no token
  }
  console.log(`[${requestTimestamp}] [twilio-helper] Using TwilioAuthToken (last 4): ...${twilioAuthToken.slice(-4)} for validation.`);

  let params: Record<string, string> = {};
  let dataForSig = "";

  if (req.method === 'POST') {
    try {
      // IMPORTANT: To validate correctly, Twilio uses the raw POST body if Content-Type is application/x-www-form-urlencoded.
      // The request body must be read only once.
      // If `rawBody` is passed, use it. Otherwise, clone and read.
      // This helper assumes it might be called before the main function consumes the body.
      const clonedReq = req.clone(); // Clone to be safe if body is needed later by main handler
      const rawBodyText = await clonedReq.text(); // Get the raw body string
      
      const formData = new URLSearchParams(rawBodyText);
      formData.forEach((value, key) => {
        params[key] = value; // No .toString() needed, URLSearchParams values are strings
      });
      
      // Construct the data string for signature: URL + sorted POST params (key + value)
      // The URL should be the one Twilio requested, without any query string if it was a POST.
      const urlObj = new URL(url);
      const baseUrlForSig = `${urlObj.origin}${urlObj.pathname}`; // URL without query string
      
      dataForSig = Object.keys(params)
        .sort()
        .reduce((acc, key) => acc + key + params[key], baseUrlForSig);
      
      console.log(`[${requestTimestamp}] [twilio-helper] POST params for validation: ${JSON.stringify(params)}`);
      console.log(`[${requestTimestamp}] [twilio-helper] Base URL for POST validation: "${baseUrlForSig}"`);

    } catch (error) {
      console.error(`[${requestTimestamp}] [twilio-helper] Error parsing POST body for validation:`, error.message);
      return false; // Fail validation if body can't be processed
    }
  } else { // For GET requests, Twilio includes query parameters in the signature URL
      dataForSig = url; // The full URL including query string
      console.log(`[${requestTimestamp}] [twilio-helper] GET request, using full URL for validation: "${dataForSig}"`);
  }
  
  console.log(`[${requestTimestamp}] [twilio-helper] Data string for signature: "${dataForSig.substring(0,100)}..."`);
  
  const hmac = createHmac('sha1', twilioAuthToken);
  hmac.update(dataForSig);
  const calculatedSignature = hmac.digest('base64');
  
  console.log(`[${requestTimestamp}] [twilio-helper] Received Twilio signature: ${twilioSignature}`);
  console.log(`[${requestTimestamp}] [twilio-helper] Calculated signature: ${calculatedSignature}`);
  
  const isValid = twilioSignature === calculatedSignature;
  console.log(`[${requestTimestamp}] [twilio-helper] Signature validation ${isValid ? 'PASSED ✓' : 'FAILED ✗'}`);
  
  return isValid;
}


export function isTrialAccount(accountSid: string | null): boolean {
  if (!accountSid) return false;
  // A more robust check might be needed if Twilio changes trial SID patterns.
  // For now, this is a common indicator but not foolproof.
  return accountSid.startsWith('AC') && (accountSid.toLowerCase().includes('trial') || accountSid.length < 30); // Example, adjust if needed
}

// Simplified TwiML builder
class VoiceResponse {
  private _content: string[];
  private _currentTag: string | null;

  constructor() {
    this._content = ['<?xml version="1.0" encoding="UTF-8"?><Response>'];
    this._currentTag = 'Response'; // Track the current open tag
  }

  private _addVerb(verb: string, attributes: Record<string, any> = {}, nestedContent?: string | ((verbNode: VoiceResponse) => void)): this {
    if (this._currentTag !== 'Response' && this._currentTag !== 'Gather') {
        throw new Error(`Cannot nest <${verb}> inside <${this._currentTag}>. Invalid TwiML structure.`);
    }

    let tag = `<${verb}`;
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        // Ensure attribute values are properly escaped for XML if they can contain special chars
        // For simplicity, assuming basic string/number values here.
        // For URLs in attributes (like 'action'), they must be XML-encoded separately BEFORE passing.
        tag += ` ${key}="${value.toString().replace(/"/g, '&quot;')}"`;
      }
    }
    tag += '>';
    this._content.push(tag);

    if (nestedContent) {
      if (typeof nestedContent === 'string') {
        // Escape text content for XML
        this._content.push(nestedContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
        );
      } else if (typeof nestedContent === 'function') {
        // For verbs like <Gather> that allow nested verbs like <Say>
        const previousTag = this._currentTag;
        this._currentTag = verb; // Set current tag to the one being opened (e.g., Gather)
        nestedContent(this);      // Allow calling .say() etc. on 'this' which will now nest correctly
        this._currentTag = previousTag; // Restore previous tag context
      }
    }
    this._content.push(`</${verb}>`);
    return this;
  }
  
  // Specific verb methods
  say(attributesOrText: Record<string, any> | string, text?: string): this {
    let attrs: Record<string, any> = {};
    let message: string;

    if (typeof attributesOrText === 'string') {
      message = attributesOrText;
    } else {
      attrs = attributesOrText;
      message = typeof text === 'string' ? text : ''; // Ensure text is a string
    }
    
    if (message.trim() === "" && Object.keys(attrs).length === 0) {
        console.warn("[twilio-helper] Attempted to create an empty <Say> tag with no attributes. Skipping.");
        return this; // Avoid empty <Say></Say> if no text and no attributes
    }
    if (message.includes('[object Object]')) {
        console.error("[twilio-helper] ERROR: <Say> verb received '[object Object]' as text. Fallback or check input.");
        message = "I seem to have a slight issue with my script."; // Fallback
    }

    return this._addVerb('Say', attrs, message);
  }

  pause(attributes: { length?: number } = {}): this {
    return this._addVerb('Pause', attributes);
  }

  hangup(): this {
    return this._addVerb('Hangup');
  }
  
  redirect(attributes: { method?: string } = {}, url: string): this {
    if (!url || url.trim() === "") throw new Error("Redirect URL cannot be empty.");
    // Ensure URL is XML-escaped by the caller using encodeXmlUrl if it contains query params
    return this._addVerb('Redirect', attributes, url);
  }

  gather(attributes: Record<string, any>, nested: (gatherNode: VoiceResponse) => void): this {
    if (!attributes.action) throw new Error("<Gather> 'action' attribute is required.");
    // The 'action' URL should be pre-encoded using encodeXmlUrl by the caller
    return this._addVerb('Gather', attributes, nested);
  }

  toString(): string {
    if (this._currentTag !== 'Response') {
        // This would indicate an unclosed nested tag, e.g. forgot to close Gather
        console.error(`[twilio-helper] toString() called but current open tag is ${this._currentTag}, not Response. TwiML might be malformed.`);
        // Attempt to close any open tags gracefully, though this is a sign of a bug
        while(this._currentTag !== 'Response' && this._currentTag !== null) {
            this._content.push(`</${this._currentTag}>`);
            // This logic is too simple for complex nesting, but better than nothing
            this._currentTag = 'Response'; // Assume we are back at response
        }
    }
    return this._content.join('') + (this._currentTag === 'Response' ? '</Response>' : '');
  }
}

export const twiml = {
  VoiceResponse: VoiceResponse // Export the class
};

// createTrialAccountTwiML and createDebugTwiML need to be updated to use the new class
export function createTrialAccountTwiML(message: string): string {
  const response = new twiml.VoiceResponse();
  response.pause({ length: 1 });
  response.say(message);
  response.pause({ length: 1 });
  response.hangup();
  return response.toString();
}

export function createDebugTwiML(info: Record<string, any>): string {
  const response = new twiml.VoiceResponse();
  response.say("Debug mode active.");
  for (const key in info) {
    if (info[key] !== undefined && info[key] !== null) {
      response.say(`${key} is ${info[key].toString()}`); // Ensure it's a string
      response.pause({length: 1});
    }
  }
  response.hangup();
  return response.toString();
}
