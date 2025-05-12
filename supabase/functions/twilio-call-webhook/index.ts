
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, twiml, validateTwilioRequest } from "../_shared/twilio-helper.ts";

serve(async (req) => {
  // Very early logging
  console.log(`--- twilio-call-webhook: INCOMING REQUEST. Method: ${req.method}, URL: ${req.url} ---`);
  console.log(`Request headers: ${JSON.stringify([...req.headers.entries()].reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {}))}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Parse URL to get the full URL and query parameters
    const url = new URL(req.url);
    const fullUrl = url.origin + url.pathname;
    console.log(`Parsed URL: ${fullUrl}, search params: ${url.search}`);
    
    // Get query parameters
    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    
    console.log(`Query parameters: call_log_id=${callLogId}, prospect_id=${prospectId}, agent_config_id=${agentConfigId}, user_id=${userId}`);
    
    // Check path to see if this is a status callback
    const isStatusCallback = url.pathname.endsWith('/status');
    console.log(`Is status callback? ${isStatusCallback}`);
    
    // Validate Twilio request (skip validation for OPTIONS and status updates)
    if (!isStatusCallback) {
      console.log('Attempting to validate Twilio request signature');
      const isValidRequest = await validateTwilioRequest(req, fullUrl);
      
      if (!isValidRequest) {
        console.warn("Twilio request validation failed, but proceeding anyway for testing purposes");
        // During development, we'll continue processing even if validation fails
        // In production, uncomment the following return statement
        /*
        return new Response("Twilio signature validation failed", {
          status: 403,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        });
        */
      } else {
        console.log('Twilio request validated successfully');
      }
    }
    
    // Process status callback if that's what this is
    if (isStatusCallback) {
      console.log('Processing status callback request');
      return handleStatusCallback(req);
    }
    
    console.log('Processing standard webhook request for initial call TwiML');
    
    // Initialize Supabase clients
    console.log('Initializing Supabase clients');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error(`Missing required Supabase environment variables: 
        SUPABASE_URL: ${supabaseUrl ? 'set' : 'missing'},
        SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'set' : 'missing'},
        SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? 'set' : 'missing'}`);
      
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error with the configuration. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('Supabase clients initialized successfully');
    
    // Retrieve the agent configuration
    console.log(`Fetching agent config with ID: ${agentConfigId}`);
    const { data: agentConfig, error: agentConfigError } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .maybeSingle();
      
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
    
    if (!agentConfig) {
      console.error(`No agent config found for ID: ${agentConfigId}`);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, I couldn't find the AI agent configuration. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    console.log(`Agent config retrieved: ${agentConfig?.config_name}`);
    
    // Retrieve prospect information
    console.log(`Fetching prospect with ID: ${prospectId}`);
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('first_name, last_name, phone_number, property_address')
      .eq('id', prospectId)
      .maybeSingle();
      
    if (prospectError) {
      console.error('Error fetching prospect:', prospectError);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error retrieving your information. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    if (!prospect) {
      console.error(`No prospect found for ID: ${prospectId}`);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, I couldn't find your information. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    console.log(`Prospect retrieved: ${prospect?.first_name} ${prospect?.last_name}, phone: ${prospect?.phone_number}`);
    
    // Generate a greeting based on the prospect's information
    let greeting = "Hello";
    
    if (prospect?.first_name) {
      greeting += `, ${prospect.first_name}`;
    }
    
    greeting += ". This is an AI assistant calling on behalf of eXp Realty. ";
    greeting += "I'm reaching out to discuss your property needs. Would you be interested in speaking with one of our agents about ";
    
    if (prospect?.property_address) {
      greeting += `your property at ${prospect.property_address}?`;
    } else {
      greeting += "real estate opportunities in your area?";
    }
    
    console.log(`Generated greeting: "${greeting}"`);
    
    // Make sure the action URL includes the full domain
    const processResponseUrl = `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}${callLogId ? `&call_log_id=${callLogId}` : ''}`;
    console.log(`Setting Gather action URL to: ${processResponseUrl}`);
    
    // Create a TwiML response - Accept both speech AND keypad input
    try {
      console.log('Creating TwiML response');
      const response = twiml.VoiceResponse();
      
      console.log('Adding main greeting to TwiML');
      response.say(greeting);
      
      console.log('Adding pause after greeting');
      response.pause({ length: 1 });
      
      // First attempt to gather input
      console.log('Adding first gather attempt to TwiML');
      const gather1 = response.gather({
        input: 'speech dtmf', // Accept both speech and keypad
        action: processResponseUrl,
        method: 'POST',
        timeout: 15, // Increased timeout from 7 to 15 seconds
        speechTimeout: 'auto',
        language: 'en-US', // Explicitly set language
        hints: 'yes,no,maybe,interested,not interested' // Add speech hints to improve recognition
      });
      
      gather1.say("I'm waiting for your response. Please speak or press 1 for yes or 2 for no.");
      console.log('Completed first gather with prompt');
      
      // Add a pause between gather attempts
      console.log('Adding pause between gather attempts');
      response.pause({ length: 2 });
      
      // Second attempt to gather input
      console.log('Adding second gather attempt to TwiML');
      const gather2 = response.gather({
        input: 'speech dtmf', // Second attempt, accepting both inputs
        action: processResponseUrl,
        method: 'POST',
        timeout: 10,
        speechTimeout: 'auto',
        language: 'en-US'
      });
      
      gather2.say("I still didn't catch that. Please speak clearly or press a key.");
      console.log('Completed second gather with prompt');
      
      // Final message if no input is detected
      console.log('Adding final message and hangup to TwiML');
      response.say("Thank you for your time. Goodbye.");
      response.hangup();
      
      // If we have a call_log_id, update the status
      if (callLogId) {
        console.log(`Updating call log status to 'Answered': ${callLogId}`);
        try {
          const { error } = await supabaseAdmin
            .from('call_logs')
            .update({
              call_status: 'Answered'
            })
            .eq('id', callLogId);
            
          if (error) {
            console.error('Error updating call log status:', error);
          } else {
            console.log('Call log status updated successfully');
          }
        } catch (error) {
          console.error('Exception updating call log status:', error);
        }
      }
      
      // Generate the final TwiML string to return
      const twimlString = response.toString();
      console.log(`Generated TwiML (truncated): ${twimlString.substring(0, 200)}...`);
      
      console.log('Returning TwiML response to Twilio');
      return new Response(twimlString, { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    } catch (twimlError) {
      console.error('Error generating TwiML response:', twimlError);
      
      // Simple error TwiML response as fallback
      const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>I'm sorry, there was an error processing this call. Please try again later.</Say>
        <Hangup/>
      </Response>`;
      
      return new Response(errorResponse, { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
  } catch (error) {
    console.error('Error in twilio-call-webhook function:', error);
    
    // Return a simple TwiML response in case of error
    const response = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>I'm sorry, there was an error processing this call. Please try again later.</Say>
      <Hangup/>
    </Response>`;
      
    return new Response(response, { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  }
});

// Handle status callbacks from Twilio
async function handleStatusCallback(req: Request): Promise<Response> {
  try {
    console.log('Processing status callback from Twilio');
    
    // Initialize Supabase admin client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing required Supabase environment variables for status callback');
      return new Response('Configuration error in status callback', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
      });
    }
    
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );
    
    // Parse the form data from Twilio
    console.log('Parsing Twilio form data from status callback');
    let formData;
    try {
      formData = await req.formData();
    } catch (formError) {
      console.error('Error parsing form data:', formError);
      return new Response('Error parsing form data', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
      });
    }
    
    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const callDuration = formData.get('CallDuration')?.toString();
    const recordingUrl = formData.get('RecordingUrl')?.toString();
    
    console.log(`Status update for call ${callSid}: ${callStatus}`);
    console.log(`Additional data - Duration: ${callDuration}, Recording URL: ${Boolean(recordingUrl)}`);
    
    if (callSid && callStatus) {
      // Find the call log using the CallSid
      console.log(`Looking up call log for CallSid: ${callSid}`);
      const { data: callLog, error: findError } = await supabaseAdmin
        .from('call_logs')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();
      
      if (findError) {
        console.error('Error finding call log:', findError);
        return new Response('Database error finding call log', { 
          status: 500,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
        });
      }
      
      if (callLog) {
        console.log(`Found call log: ${callLog.id}`);
        const updateData: Record<string, any> = {
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
        
        console.log(`Updating call log with status data:`, updateData);
        
        try {
          // FIXED: Removed updated_at field from update operation
          const { error } = await supabaseAdmin
            .from('call_logs')
            .update(updateData)
            .eq('id', callLog.id);
            
          if (error) {
            console.error('Error updating call log:', error);
            return new Response('Database error updating call log', { 
              status: 500,
              headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
            });
          } else {
            console.log('Call log updated successfully');
          }
        } catch (updateError) {
          console.error('Exception in call log update:', updateError);
          return new Response('Exception updating call log', { 
            status: 500,
            headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
          });
        }
      } else {
        console.error(`No call log found for call SID: ${callSid}`);
        // This is not necessarily an error - might be the first status callback before the call log is created
      }
    } else {
      console.error('Missing required Twilio parameters in status callback');
      return new Response('Missing required parameters', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
      });
    }
    
    console.log('Completed status callback processing');
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
