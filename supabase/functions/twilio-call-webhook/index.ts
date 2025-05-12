
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, twiml, validateTwilioRequest } from "../_shared/twilio-helper.ts";

serve(async (req) => {
  // Very early logging
  console.log(`--- twilio-call-webhook: INCOMING REQUEST. Method: ${req.method}, URL: ${req.url} ---`);
  
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
        console.warn("Twilio request validation failed, but proceeding anyway for testing purposes");
        // During development, we'll continue processing even if validation fails
        // In production, uncomment the following return statement
        /*
        return new Response("Twilio signature validation failed", {
          status: 403,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        });
        */
      }
    }
    
    // Continue with the existing webhook logic
    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    
    console.log(`Processing webhook for prospect: ${prospectId}, agent config: ${agentConfigId}, user: ${userId}, call log: ${callLogId}`);
    
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
    
    console.log(`Fetching agent config: ${agentConfigId}`);
    // Retrieve the agent configuration
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
    
    console.log(`Agent config retrieved: ${agentConfig?.config_name}`);
    
    console.log(`Fetching prospect: ${prospectId}`);
    // Retrieve prospect information
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
    
    console.log(`Prospect retrieved: ${prospect?.first_name} ${prospect?.last_name}`);
    
    // For this initial version, we'll use a simple prompt-based approach
    // In a more advanced version, this would be replaced with more sophisticated AI dialog management
    
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
    
    // Make sure the action URL includes the full domain
    const processResponseUrl = `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}${callLogId ? `&call_log_id=${callLogId}` : ''}`;
    console.log(`Setting Gather action URL to: ${processResponseUrl}`);
    
    // Create a TwiML response - Accept both speech AND keypad input
    const response = twiml.VoiceResponse();
    response.say(greeting);
    response.pause({ length: 1 });
    
    // First attempt to gather input
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
    
    // Add a pause between gather attempts
    response.pause({ length: 2 });
    
    // Second attempt to gather input
    const gather2 = response.gather({
      input: 'speech dtmf', // Second attempt, accepting both inputs
      action: processResponseUrl,
      method: 'POST',
      timeout: 10,
      speechTimeout: 'auto',
      language: 'en-US'
    });
    
    gather2.say("I still didn't catch that. Please speak clearly or press a key.");
    
    // Final message if no input is detected
    response.say("Thank you for your time. Goodbye.");
    response.hangup();
    
    // If we have a call_log_id, update the status using admin client
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
    
    console.log('Returning TwiML response to Twilio');
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
    console.log('Processing status callback from Twilio');
    
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
      const { data: callLog, error: findError } = await supabaseAdmin
        .from('call_logs')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();
      
      if (findError) {
        console.error('Error finding call log:', findError);
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
          // Fixed: Removed updated_at field from update operation
          const { error } = await supabaseAdmin
            .from('call_logs')
            .update(updateData)
            .eq('id', callLog.id);
            
          if (error) {
            console.error('Error updating call log:', error);
          } else {
            console.log('Call log updated successfully');
          }
        } catch (updateError) {
          console.error('Exception in call log update:', updateError);
        }
      } else {
        console.error(`No call log found for call SID: ${callSid}`);
      }
    } else {
      console.error('Missing required Twilio parameters in status callback');
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
