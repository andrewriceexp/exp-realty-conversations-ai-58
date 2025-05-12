
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

// TwiML helper functions
const twiml = {
  VoiceResponse: function() {
    let content = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    return {
      say: function(text, options = {}) {
        const voice = options.voice || 'alice';
        content += `<Say voice="${voice}">${text}</Say>`;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Function to validate Twilio requests
async function validateTwilioRequest(req: Request, url: string): Promise<boolean> {
  console.log("Validating Twilio request");
  
  try {
    const twilioSignature = req.headers.get('x-twilio-signature');
    
    if (!twilioSignature) {
      console.error("Missing X-Twilio-Signature header");
      return false;
    }
    
    // Get Twilio auth token from environment variable or user profile
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    
    if (!twilioAuthToken) {
      console.error("Missing TWILIO_AUTH_TOKEN environment variable");
      return false;
    }
    
    // For POST requests, we need to validate with the request body
    let params = {};
    if (req.method === 'POST') {
      // Clone the request to avoid consuming it
      const clonedReq = req.clone();
      
      // Try to parse the body as form data or JSON
      try {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/x-www-form-urlencoded') ||
            contentType.includes('multipart/form-data')) {
          const formData = await clonedReq.formData();
          formData.forEach((value, key) => {
            params[key] = value;
          });
        } else if (contentType.includes('application/json')) {
          params = await clonedReq.json();
        }
      } catch (error) {
        console.error("Error parsing request body:", error);
      }
    }
    
    // Create validation signature
    const data = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        return acc + key + params[key];
      }, url);
      
    const hmac = createHmac('sha1', twilioAuthToken);
    hmac.update(data);
    const calculatedSignature = hmac.digest('base64');
    
    console.log(`Received Twilio signature: ${twilioSignature}`);
    console.log(`Calculated signature: ${calculatedSignature}`);
    
    return twilioSignature === calculatedSignature;
  } catch (error) {
    console.error("Error validating Twilio request:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Parse URL to get the full URL and query parameters
    const url = new URL(req.url);
    const fullUrl = url.origin + url.pathname;
    
    // Validate Twilio request (skip validation for OPTIONS and status updates)
    const isStatusCallback = url.pathname.endsWith('/status');
    
    if (!isStatusCallback) {
      const isValidRequest = await validateTwilioRequest(req, fullUrl);
      
      if (!isValidRequest) {
        console.error("Twilio request validation failed");
        return new Response(JSON.stringify({ error: "Forbidden - Invalid signature" }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    // Continue with the existing webhook logic
    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    
    // Check path to see if this is a status callback
    if (isStatusCallback) {
      // For status callbacks, we'll need to look up the call_log from the CallSid
      // if call_log_id is not provided in the URL
      return handleStatusCallback(req);
    }
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    // Initialize Supabase admin client with service role key for writes
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Retrieve the agent configuration
    const { data: agentConfig, error: agentConfigError } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .single();
      
    if (agentConfigError) {
      console.error('Error fetching agent config:', agentConfigError);
      // Return a simple TwiML response in case of error
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error with the AI agent configuration. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // Retrieve prospect information
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('first_name, last_name, phone_number, property_address')
      .eq('id', prospectId)
      .single();
      
    if (prospectError) {
      console.error('Error fetching prospect:', prospectError);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error retrieving your information. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // For this initial version, we'll use a simple prompt-based approach
    // In a more advanced version, this would be replaced with more sophisticated AI dialog management
    
    // Generate a greeting based on the prospect's information
    let greeting = "Hello";
    
    if (prospect.first_name) {
      greeting += `, ${prospect.first_name}`;
    }
    
    greeting += ". This is an AI assistant calling on behalf of eXp Realty. ";
    greeting += "I'm reaching out to discuss your property needs. Would you be interested in speaking with one of our agents about ";
    
    if (prospect.property_address) {
      greeting += `your property at ${prospect.property_address}?`;
    } else {
      greeting += "real estate opportunities in your area?";
    }
    
    // Create a TwiML response
    const response = twiml.VoiceResponse()
      .say(greeting)
      .pause({ length: 1 })
      .gather({
        input: 'speech',
        action: `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}`,
        method: 'POST',
        timeout: 5,
        speechTimeout: 'auto'
      })
      .say("I'm listening for your response. Please let me know if you'd be interested in speaking with an agent.")
      .endGather()
      .say("I didn't catch that. Thank you for your time. Goodbye.")
      .hangup();
    
    // If we have a call_log_id, update the status using admin client
    if (callLogId) {
      await supabaseAdmin
        .from('call_logs')
        .update({
          call_status: 'Answered'
        })
        .eq('id', callLogId);
    }
    
    return new Response(response.toString(), { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  } catch (error) {
    console.error('Error in twilio-call-webhook function:', error);
    
    // Return a simple TwiML response in case of error
    const response = twiml.VoiceResponse()
      .say("I'm sorry, there was an error processing this call. Please try again later.")
      .hangup();
      
    return new Response(response.toString(), { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  }
});

// Handle status callbacks from Twilio
async function handleStatusCallback(req: Request): Promise<Response> {
  try {
    // Initialize Supabase admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Parse the form data from Twilio
    const formData = await req.formData();
    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const callDuration = formData.get('CallDuration')?.toString();
    const recordingUrl = formData.get('RecordingUrl')?.toString();
    
    console.log(`Status update for call ${callSid}: ${callStatus}`);
    
    if (callSid && callStatus) {
      // Find the call log using the CallSid
      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();
      
      if (callLog) {
        const updateData: any = {
          call_status: callStatus.charAt(0).toUpperCase() + callStatus.slice(1) // Capitalize first letter
        };
        
        // Add fields conditionally
        if (callDuration) {
          updateData.call_duration_seconds = parseInt(callDuration, 10);
        }
        
        if (recordingUrl) {
          updateData.recording_url = recordingUrl;
        }
        
        // If call is completed or failed, update the ended_at field
        if (['completed', 'failed', 'busy', 'no-answer'].includes(callStatus)) {
          updateData.ended_at = new Date().toISOString();
        }
        
        // Update the call log with the status using admin client
        const { error } = await supabaseAdmin
          .from('call_logs')
          .update(updateData)
          .eq('id', callLog.id);
          
        if (error) {
          console.error('Error updating call log:', error);
        }
      } else {
        console.error(`No call log found for call SID: ${callSid}`);
      }
    }
    
    return new Response('Status received', { 
      headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
    });
  } catch (error) {
    console.error('Error in status callback handler:', error);
    return new Response('Error processing status callback', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
    });
  }
}
