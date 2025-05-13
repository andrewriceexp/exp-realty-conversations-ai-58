// supabase/functions/_shared/twilio-helper.ts
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"; // For signature validation
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Polyfill for btoa if not globally available in Deno

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export async function validateTwilioRequest(
    req: Request, 
    url: string, // Full URL Twilio POSTed/GET to (including original query string for GET)
    twilioAuthToken?: string | null, 
    bypassValidation?: boolean,
    rawBody?: string // Raw body string, especially for POST x-www-form-urlencoded
): Promise<boolean> {
  const requestTimestamp = new Date().toISOString();
  const logPrefix = `[${requestTimestamp}] [twilio-helper] validateTwilioRequest:`;

  console.log(`${logPrefix} Attempting validation. Bypass: ${bypassValidation}. URL: ${url}`);
  
  if (bypassValidation) {
    console.warn(`${logPrefix} ⚠️ VALIDATION BYPASSED - This should only be used for testing!`);
    return true;
  }
  
  const twilioSignature = req.headers.get('x-twilio-signature');
  if (!twilioSignature) {
    console.error(`${logPrefix} Missing X-Twilio-Signature header. Validation FAILED.`);
    return false; 
  }
  
  if (!twilioAuthToken) {
    console.error(`${logPrefix} Missing twilioAuthToken for validation. Validation FAILED.`);
    return false; 
  }
  // console.log(`${logPrefix} Using TwilioAuthToken (last 4): ...${twilioAuthToken.slice(-4)} for validation.`);

  let params: Record<string, string> = {};
  let dataForSig = "";
  const urlObj = new URL(url);
  const baseUrlForSig = `${urlObj.origin}${urlObj.pathname}`; // URL without query string for POST

  if (req.method === 'POST') {
    if (!rawBody) {
        console.error(`${logPrefix} Raw POST body not provided for validation. Validation FAILED.`);
        return false;
    }
    try {
      const formData = new URLSearchParams(rawBody);
      formData.sort(); // Sort parameters alphabetically by key
      formData.forEach((value, key) => {
        params[key] = value; 
      });
      
      dataForSig = baseUrlForSig;
      formData.forEach((value, key) => {
          dataForSig += key + value;
      });
      
      // console.log(`${logPrefix} POST params for validation: ${JSON.stringify(params)}`);
      // console.log(`${logPrefix} Base URL for POST validation: "${baseUrlForSig}"`);

    } catch (error) {
      console.error(`${logPrefix} Error parsing POST body for validation:`, error.message);
      return false; 
    }
  } else { // For GET requests, Twilio includes query parameters in the signature URL
      dataForSig = url; // The full URL including query string
      // console.log(`${logPrefix} GET request, using full URL for validation: "${dataForSig}"`);
  }
  
  // console.log(`${logPrefix} Data string for signature (first 100 chars): "${dataForSig.substring(0,100)}..."`);
  
  // Deno's crypto.subtle for HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(twilioAuthToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataForSig));
  const calculatedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  
  // console.log(`${logPrefix} Received Twilio signature: ${twilioSignature}`);
  // console.log(`${logPrefix} Calculated signature: ${calculatedSignature}`);
  
  const isValid = twilioSignature === calculatedSignature;
  console.log(`${logPrefix} Signature validation ${isValid ? 'PASSED ✓' : 'FAILED ✗'}`);
  
  return isValid;
}


export function isTrialAccount(accountSid: string | null): boolean {
  if (!accountSid) return false;
  // This is a heuristic. A more reliable method might involve checking account features via API if possible.
  return accountSid.startsWith('AC') && (accountSid.toLowerCase().includes('trial') || accountSid.length < 30); 
}

// Corrected TwiML builder as a Class
class VoiceResponse {
  private _content: string[];
  private _currentTagStack: string[]; // To handle nested tags like <Gather><Say/></Gather>

  constructor() {
    this._content = ['<?xml version="1.0" encoding="UTF-8"?>'];
    this._currentTagStack = []; // Stack to keep track of open tags
    this._openTag('Response');
    console.log("[twilio-helper VoiceResponse] Initialized.");
  }

  private _xmlEncode(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
  }

  private _openTag(verb: string, attributes: Record<string, any> = {}): void {
    let tag = `<${verb}`;
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        tag += ` ${key}="${this._xmlEncode(value.toString())}"`;
      }
    }
    tag += '>';
    this._content.push(tag);
    this._currentTagStack.push(verb);
    // console.log(`[twilio-helper VoiceResponse] Opened <${verb}>. Stack: ${this._currentTagStack}`);
  }

  private _addContent(text: string): void {
    if (this._currentTagStack.length === 0) {
        throw new Error("Cannot add content outside of an open tag.");
    }
    this._content.push(this._xmlEncode(text));
  }
  
  private _closeTag(verb: string): void {
    if (this._currentTagStack.length === 0 || this._currentTagStack[this._currentTagStack.length - 1] !== verb) {
        console.error(`[twilio-helper VoiceResponse] Mismatched closing tag. Expected </${this._currentTagStack[this._currentTagStack.length - 1]}> but trying to close </${verb}>. Stack: ${this._currentTagStack}`);
        // Attempt to gracefully close all open tags if there's a mismatch to prevent totally broken XML
        while(this._currentTagStack.length > 0) {
            const openTag = this._currentTagStack.pop();
            this._content.push(`</${openTag}>`);
            console.warn(`[twilio-helper VoiceResponse] Auto-closed </${openTag}> due to mismatch.`);
        }
        // Re-open Response if everything was closed
        if (this._currentTagStack.length === 0 && this._content[0].startsWith('<?xml')) {
             this._openTag('Response'); // Should not happen if used correctly
        }
        return; // Avoid pushing the mismatched closing tag
    }
    this._content.push(`</${verb}>`);
    this._currentTagStack.pop();
    // console.log(`[twilio-helper VoiceResponse] Closed </${verb}>. Stack: ${this._currentTagStack}`);
  }

  // Public verb methods
  say(attributesOrText: Record<string, any> | string, textToSay?: string): this {
    let attrs: Record<string, any> = {};
    let message: string;

    if (typeof attributesOrText === 'string') {
      message = attributesOrText;
    } else {
      attrs = attributesOrText;
      message = typeof textToSay === 'string' ? textToSay : ''; 
    }
    
    const finalMessage = (message && message.trim() !== "") ? message.trim() : " "; // Use a space if empty to ensure valid <Say> </Say>
    if (finalMessage.includes('[object Object]')) {
        console.error("[twilio-helper VoiceResponse] ERROR: <Say> verb received '[object Object]' as text. Using fallback.");
        message = "I have a slight issue with my script."; 
    }

    this._openTag('Say', attrs);
    this._addContent(finalMessage);
    this._closeTag('Say');
    return this;
  }

  pause(attributes: { length?: number } = { length: 1 }): this {
    this._openTag('Pause', attributes);
    // Pause is a self-closing style tag in terms of content, but XML needs explicit close
    this._closeTag('Pause'); 
    return this;
  }

  hangup(): this {
    this._openTag('Hangup');
    this._closeTag('Hangup');
    return this;
  }
  
  redirect(attributes: { method?: string } = { method: 'POST' }, url: string): this {
    if (!url || url.trim() === "") throw new Error("Redirect URL cannot be empty.");
    // URL for Redirect content should be XML encoded by the caller if it contains special chars,
    // but typically it's just a URL. encodeXmlUrl is for query params in attributes.
    this._openTag('Redirect', attributes);
    this._addContent(url); // URL goes inside the Redirect tag
    this._closeTag('Redirect');
    return this;
  }

  gather(attributes: Record<string, any>, nestedCallback: (gatherNode: VoiceResponse) => void): this {
    if (!attributes.action) throw new Error("<Gather> 'action' attribute is required and must be XML-encoded if it has query params.");
    
    this._openTag('Gather', attributes);
    nestedCallback(this); // 'this' allows calling .say(), .play() which will be nested
    this._closeTag('Gather');
    return this;
  }

  toString(): string {
    // Ensure the main Response tag is closed if it's the only one left
    if (this._currentTagStack.length === 1 && this._currentTagStack[0] === 'Response') {
      this._closeTag('Response');
    } else if (this._currentTagStack.length > 0) {
        console.error(`[twilio-helper VoiceResponse] toString() called with unclosed tags: ${this._currentTagStack.join(', ')}. Attempting to close all.`);
        while(this._currentTagStack.length > 0) {
            const openTag = this._currentTagStack.pop();
            this._content.push(`</${openTag}>`);
        }
    }
    const finalTwiML = this._content.join('');
    // console.log(`[twilio-helper VoiceResponse] Final TwiML: ${finalTwiML}`);
    return finalTwiML;
  }
}

export const twiml = {
  VoiceResponse: VoiceResponse 
};
