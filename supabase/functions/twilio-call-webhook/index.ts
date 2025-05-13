
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
    const bypassValidation = url.searchParams.get('bypass_validation') === 'true';
    
    console.log(`Query parameters: call_log_id=${callLogId}, prospect_id=${prospectId}, agent_config_id=${agentConfigId}, user_id=${userId}, bypass_validation=${bypassValidation}`);
    
    // Check path to see if this is a status callback
    const isStatusCallback = url.pathname.endsWith('/status');
    console.log(`Is status callback? ${isStatusCallback}`);
    
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
    
    // Fetch the user's Twilio auth token from their profile
    let userTwilioAuthToken = null;
    if (userId) {
      console.log(`Attempting to fetch Twilio auth token for user ${userId}`);
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('twilio_auth_token')
          .eq('id', userId)
          .maybeSingle();
          
        if (profileError) {
          console.error(`Failed to fetch profile for user ${userId} for validation:`, profileError);
        } else if (profile && profile.twilio_auth_token) {
          userTwilioAuthToken = profile.twilio_auth_token;
          console.log(`Auth token fetched successfully for user ${userId}`);
        } else {
          console.warn(`No auth token found in profile for user ${userId}`);
        }
      } catch (profileFetchError) {
        console.error(`Exception fetching profile for user ${userId}:`, profileFetchError);
      }
    } else {
      console.warn("No userId in webhook URL for validation");
    }
    
    // Validate Twilio request (skip validation for OPTIONS and status updates if needed)
    if (!isStatusCallback) {
      console.log('Attempting to validate Twilio request signature with user-specific auth token');
      const isValidRequest = await validateTwilioRequest(req, fullUrl, userTwilioAuthToken, bypassValidation);
      
      if (!isValidRequest) {
        console.error("Twilio request validation FAILED - Returning 403 Forbidden");
        // Strict validation mode - return 403 if validation fails
        return new Response("Twilio signature validation failed", {
          status: 403,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        });
      } else {
        console.log('Twilio request validated successfully');
      }
    }
    
    // Process status callback if that's what this is
    if (isStatusCallback) {
      console.log('Processing status callback request');
      return handleStatusCallback(req, supabaseAdmin);
    }
    
    console.log('Processing standard webhook request for initial call TwiML');
    
    // For testing, let's simplify the TwiML response to isolate any potential issues
    // Return a simple message to confirm the webhook is responding
    const simpleResponse = twiml.VoiceResponse()
      .say("Webhook reached and validated. Hello from the main webhook.")
      .hangup();
    
    console.log('Returning simplified TwiML response for testing');
    return new Response(simpleResponse.toString(), { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
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
async function handleStatusCallback(req: Request, supabaseAdmin: any): Promise<Response> {
  try {
    console.log('Processing status callback from Twilio');
    
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
          // IMPORTANT: Make sure we're not including updated_at in the updateData
          // Triple-check there's no updated_at field
          delete updateData.updated_at; // Just in case
          
          console.log('Final update data (without updated_at):', updateData);
          
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
