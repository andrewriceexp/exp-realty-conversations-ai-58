
// Helper functions for Twilio-related operations in Edge Functions
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export async function validateTwilioRequest(req: Request, url: string, twilioAuthToken?: string | null, bypassValidation?: boolean): Promise<boolean> {
  console.log("Validating Twilio request");
  
  // If bypass is explicitly enabled, skip validation but log this decision
  if (bypassValidation) {
    console.log("⚠️ VALIDATION BYPASSED - This should only be used for testing!");
    return true;
  }
  
  try {
    const twilioSignature = req.headers.get('x-twilio-signature');
    
    if (!twilioSignature) {
      console.error("Missing X-Twilio-Signature header");
      return false;
    }
    
    // Check if the provided auth token is valid
    if (!twilioAuthToken) {
      console.error("Missing twilioAuthToken parameter - user profile may be incomplete");
      return false; // Strict validation - no token means reject
    }
    
    console.log(`Using provided twilioAuthToken for validation: ${twilioAuthToken.substring(0, 4)}...${twilioAuthToken.substring(twilioAuthToken.length - 4)}`);
    
    // For POST requests, we need to validate with the request body
    let params: Record<string, string> = {};
    if (req.method === 'POST') {
      // Clone the request to avoid consuming it
      const clonedReq = req.clone();
      
      try {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/x-www-form-urlencoded') ||
            contentType.includes('multipart/form-data')) {
          const formData = await clonedReq.formData();
          formData.forEach((value, key) => {
            params[key] = value.toString();
          });
        } else if (contentType.includes('application/json')) {
          params = await clonedReq.json();
        }
      } catch (error) {
        console.error("Error parsing request body:", error);
        // In strict mode, parsing failure means validation fails
        return false;
      }
    }
    
    // Log each parameter separately for better debugging
    console.log("Parameters for validation:");
    Object.keys(params).sort().forEach(key => {
      console.log(`  - ${key}: ${params[key]}`);
    });
    
    // IMPORTANT FIX: Ensure we're using the exact URL without query parameters
    // Extract base URL without query string for validation
    const urlObj = new URL(url);
    // For validation, we need the path without query parameters
    const baseUrl = `${urlObj.origin}${urlObj.pathname}`;
    console.log(`Original URL: "${url}"`);
    console.log(`Base URL for validation: "${baseUrl}"`);
    
    // Create validation signature
    const data = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        return acc + key + params[key];
      }, baseUrl);
      
    console.log(`Data string for validation: "${data}"`);
    
    const hmac = createHmac('sha1', twilioAuthToken);
    hmac.update(data);
    const calculatedSignature = hmac.digest('base64');
    
    console.log(`Received Twilio signature: ${twilioSignature}`);
    console.log(`Calculated signature: ${calculatedSignature}`);
    
    const isValid = twilioSignature === calculatedSignature;
    console.log(`Signature validation ${isValid ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    return isValid;
  } catch (error) {
    console.error("Error validating Twilio request:", error);
    return false;
  }
}

// Helper to detect if a Twilio account is a trial account
export function isTrialAccount(accountSid: string | null): boolean {
  if (!accountSid) return false;
  
  // Twilio trial accounts typically start with "AC" and often have specific patterns
  // Most reliable way is to check for the word "trial" in the account SID or response
  return accountSid.startsWith('AC') && accountSid.includes('trial');
}

// TwiML helper functions to generate XML responses for Twilio
export const twiml = {
  VoiceResponse: function() {
    let content = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    return {
      say: function(text, options = {}) {
        if (typeof text === 'object' && text !== null) {
          // Handle options passed as first argument
          options = text;
          text = options.message || '';
          delete options.message;
        }
          
        // Start the Say tag with any attributes
        content += '<Say';
        for (const [key, value] of Object.entries(options)) {
          if (key !== 'voice' && key !== 'language') {
            content += ` ${key}="${value}"`;
          }
        }
        
        // Add voice and language if provided
        if (options.voice) {
          content += ` voice="${options.voice}"`;
        }
        
        if (options.language) {
          content += ` language="${options.language}"`;
        }
        
        // Close the opening tag and add content
        content += '>';
        
        // Add the text content
        content += text;
        
        // Close the Say tag
        content += '</Say>';
        
        return this;
      },
      play: function(url) {
        // Handle both string URLs and options objects
        if (typeof url === 'string') {
          content += `<Play>${url}</Play>`;
        } else if (typeof url === 'object' && url !== null) {
          // If it's an object with a url property, use that
          const urlStr = url.url || url.digits || '';
          content += `<Play>${urlStr}</Play>`;
        } else {
          // Default empty Play tag if nothing valid is provided
          content += '<Play></Play>';
        }
        return this;
      },
      pause: function(options = {}) {
        const length = options.length || 1;
        content += `<Pause length="${length}"/>`;
        return this;
      },
      record: function(options = {}) {
        content += '<Record';
        for (const [key, value] of Object.entries(options)) {
          content += ` ${key}="${value}"`;
        }
        content += '/>';
        return this;
      },
      gather: function(options = {}) {
        content += '<Gather';
        for (const [key, value] of Object.entries(options)) {
          content += ` ${key}="${value}"`;
        }
        content += '>';
        return {
          say: function(text, sayOptions = {}) {
            const voice = sayOptions.voice || 'alice';
            content += `<Say voice="${voice}">${text}</Say>`;
            return this;
          },
          play: function(url) {
            // Handle both string URLs and option objects
            if (typeof url === 'string') {
              content += `<Play>${url}</Play>`;
            } else if (typeof url === 'object' && url !== null) {
              const urlStr = url.url || url.digits || '';
              content += `<Play>${urlStr}</Play>`;
            } else {
              content += '<Play></Play>';
            }
            return this;
          },
          endGather: function() {
            content += '</Gather>';
            return twiml.VoiceResponse();
          }
        };
      },
      hangup: function() {
        content += '<Hangup/>';
        return this;
      },
      toString: function() {
        return content + '</Response>';
      }
    };
  }
};

// Create a simplified TwiML response that works better with trial accounts
export function createTrialAccountTwiML(message: string): string {
  return twiml.VoiceResponse()
    .pause({ length: 1 }) // Add a pause to wait for the trial message to complete
    .say(message)
    .pause({ length: 1 }) // Add another pause for better flow
    .hangup()
    .toString();
}

// Create a debugging TwiML that echoes back information about the request
export function createDebugTwiML(info: Record<string, any>): string {
  // Create a simple message summarizing the request data
  let debugMessage = "Debug mode active. ";
  
  if (info.accountSid) {
    debugMessage += `Account SID: ${info.accountSid.substring(0, 6)}...${info.accountSid.substring(info.accountSid.length - 4)}. `;
  }
  
  if (info.isTrial) {
    debugMessage += "This is a trial account. ";
  }
  
  if (info.callSid) {
    debugMessage += `Call SID: ${info.callSid.substring(0, 4)}. `;
  }
  
  debugMessage += "Call parameters received successfully. Goodbye.";
  
  return twiml.VoiceResponse()
    .pause({ length: 2 }) // Longer pause for trial message
    .say(debugMessage)
    .pause({ length: 1 })
    .hangup()
    .toString();
}
