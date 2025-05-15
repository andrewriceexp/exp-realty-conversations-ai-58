
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as base64 from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.167.0/crypto/mod.ts";
import twilio from 'npm:twilio@3.84.1';

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, elevenlabs-signature, x-elevenlabs-api-key, x-deno-subhost, twilio-signature, X-Twilio-Signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

/**
 * Initializes a Twilio Voice Response (TwiML) object
 * @returns A TwiML VoiceResponse object
 */
export const twiml = twilio.twiml;

/**
 * Validates a Twilio request signature to ensure it's coming from Twilio
 * @param {Request} request - The original request
 * @param {string} url - The full URL that the request was sent to
 * @param {string} authToken - The Twilio auth token for validation
 * @returns {Promise<boolean>} True if valid, false otherwise
 */
export async function validateTwilioRequest(request: Request, url: string, authToken?: string | null): Promise<boolean> {
  try {
    if (!authToken) {
      console.warn("No auth token provided for Twilio validation");
      return false;
    }
    
    // Get Twilio signature from headers
    const signature = request.headers.get("X-Twilio-Signature") || request.headers.get("twilio-signature");
    if (!signature) {
      console.warn("No Twilio signature found in request headers");
      return false;
    }
    
    // Clone the request to handle the FormData extraction
    const clonedRequest = request.clone();
    let formData: FormData;
    
    try {
      formData = await clonedRequest.formData();
    } catch (formDataError) {
      console.warn("Failed to extract form data from request:", formDataError);
      return false;
    }

    // Convert FormData to a params object for validation
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });
    
    // Use Twilio's helper to validate the request
    return twilio.validateRequest(authToken, signature, url, params);
  } catch (error) {
    console.error("Error validating Twilio request:", error);
    return false;
  }
}
