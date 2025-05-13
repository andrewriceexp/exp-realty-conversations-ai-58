// supabase/functions/_shared/twilio-helper.ts
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // For btoa

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export async function validateTwilioRequest(
    req: Request,
    validationUrl: string, // Full URL Twilio actually requested (used for GET, or as base for POST)
    twilioAuthToken?: string | null,
    bypassValidation?: boolean,
    rawBodyText?: string // Raw POST body text (x-www-form-urlencoded)
): Promise<boolean> {
  const requestTimestamp = new Date().toISOString();
  const logPrefix = `[${requestTimestamp}] [twilio-helper] validateTwilioRequest:`;

  console.log(`${logPrefix} Attempting validation. Bypass: ${bypassValidation}. Validation URL: ${validationUrl}`);

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
  console.log(`${logPrefix} Using TwilioAuthToken (last 4): ...${twilioAuthToken.slice(-4)} for validation.`);

  let dataForSig = "";
  const urlObj = new URL(validationUrl);

  if (req.method === 'POST') {
    if (!rawBodyText) {
        console.error(`${logPrefix} Raw POST body (rawBodyText) not provided for validation. Validation FAILED.`);
        return false;
    }
    try {
      // For POST, Twilio uses the URL without any query string parameters for signature calculation
      const baseUrlForPostSig = `${urlObj.origin}${urlObj.pathname}`;
      dataForSig = baseUrlForPostSig;

      const formData = new URLSearchParams(rawBodyText);
      const paramsArray: [string, string][] = [];
      formData.forEach((value, key) => {
        paramsArray.push([key, value]);
      });

      // Sort POST parameters alphabetically by key
      paramsArray.sort((a, b) => a[0].localeCompare(b[0]));

      // Concatenate sorted key-value pairs
      for (const [key, value] of paramsArray) {
        dataForSig += key + value;
      }

      console.log(`${logPrefix} POST params for validation (sorted & concatenated): ${paramsArray.map(p => p[0]+p[1]).join('')}`);
      console.log(`${logPrefix} Base URL for POST validation: "${baseUrlForPostSig}"`);

    } catch (error) {
      console.error(`${logPrefix} Error processing POST body for validation:`, error.message);
      return false;
    }
  } else { // For GET requests, Twilio includes query parameters in the signature URL
      dataForSig = validationUrl; // The full URL including query string
      console.log(`${logPrefix} GET request, using full URL for validation: "${dataForSig}"`);
  }

  console.log(`${logPrefix} Data string for signature (first 100 chars): "${dataForSig.substring(0,100)}..."`);

  // Create HMAC-SHA1 signature
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(twilioAuthToken),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataForSig));
  const calculatedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  console.log(`${logPrefix} Received Twilio signature: ${twilioSignature}`);
  console.log(`${logPrefix} Calculated signature: ${calculatedSignature}`);

  const isValid = twilioSignature === calculatedSignature;
  if (!isValid) {
      console.error(`${logPrefix} Signature validation FAILED ✗. URL: ${validationUrl}, Method: ${req.method}`);
      console.error(`${logPrefix} Data for Sig: "${dataForSig.substring(0,200)}..."`);
      console.error(`${logPrefix} Received Sig: ${twilioSignature}, Calculated Sig: ${calculatedSignature}`);
  } else {
      console.log(`${logPrefix} Signature validation PASSED ✓`);
  }

  return isValid;
}

export function isTrialAccount(accountSid: string | null): boolean {
  if (!accountSid) return false;
  // This is a heuristic. A more reliable method might be needed if Twilio changes trial SID patterns.
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
    // console.log("[twilio-helper VoiceResponse] Initialized.");
  }

  private _xmlEncode(text: string): string {
    if (typeof text !== 'string') {
        // console.warn(`[twilio-helper VoiceResponse] _xmlEncode received non-string: ${typeof text}. Converting to string.`);
        text = String(text); // Ensure it's a string
    }
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
  }

  private _addContent(text: string): void {
    if (this._currentTagStack.length === 0) {
        throw new Error("[twilio-helper VoiceResponse] Cannot add content outside of an open tag.");
    }
    this._content.push(this._xmlEncode(text));
  }

  private _closeTag(verb: string): void {
    if (this._currentTagStack.length === 0 || this._currentTagStack[this._currentTagStack.length - 1] !== verb) {
        console.error(`[twilio-helper VoiceResponse] Mismatched closing tag. Expected </${this._currentTagStack[this._currentTagStack.length - 1] || 'None'}> but trying to close </${verb}>. Stack: ${this._currentTagStack}`);
        while(this._currentTagStack.length > 0) {
            const openTag = this._currentTagStack.pop();
            this._content.push(`</${openTag}>`);
            // console.warn(`[twilio-helper VoiceResponse] Auto-closed </${openTag}> due to mismatch.`);
        }
        if (this._currentTagStack.length === 0 && this._content[0].startsWith('<?xml')) {
             this._openTag('Response'); // Should not happen if used correctly
        }
        return;
    }
    this._content.push(`</${verb}>`);
    this._currentTagStack.pop();
  }

  say(attributesOrText: Record<string, any> | string, textToSay?: string): this {
    let attrs: Record<string, any> = {};
    let message: string;

    if (typeof attributesOrText === 'string') {
      message = attributesOrText;
    } else if (attributesOrText && typeof attributesOrText === 'object') {
      attrs = { ...attributesOrText }; // Clone to avoid modifying original
      message = typeof textToSay === 'string' ? textToSay : (attrs.message || '');
      delete attrs.message;
    } else {
      message = '';
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
    // URL for Redirect content should NOT be XML encoded here. Twilio expects a plain URL.
    // encodeXmlUrl is for URLs in ATTRIBUTES like <Gather action="URL_WITH_&amp;_PARAMS">
    this._openTag('Redirect', attributes);
    this._addContent(url); // URL goes inside the Redirect tag as plain text
    this._closeTag('Redirect');
    return this;
  }

  gather(attributes: Record<string, any>, nestedCallback: (gatherNode: VoiceResponse) => void): this {
    if (!attributes.action) throw new Error("<Gather> 'action' attribute is required and must be XML-encoded if it has query params.");

    this._openTag('Gather', attributes);
    nestedCallback(this);
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
