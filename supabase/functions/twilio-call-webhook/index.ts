import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, twiml, validateTwilioRequest, isTrialAccount, createTrialAccountTwiML, createDebugTwiML } from "../_shared/twilio-helper.ts";
import { encodeXmlUrl, createGatherWithSay, createErrorResponse } from "../_shared/twiml-helpers.ts";

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
    const voiceId = url.searchParams.get('voice_id');
    const bypassValidation = url.searchParams.get('bypass_validation') === 'true';
    const debugMode = url.searchParams.get('debug_mode') === 'true' || bypassValidation;
    
    console.log(`Query parameters: call_log_id=${callLogId}, prospect_id=${prospectId}, agent_config_id=${agentConfigId}, user_id=${userId}, voice_id=${voiceId ? voiceId.substring(0, 8) + '...' : 'undefined'}, bypass_validation=${bypassValidation}, debug_mode=${debugMode}`);
    
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
      
      return new Response(createErrorResponse("I'm sorry, there was an error with the configuration. Please try again later."), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('Supabase clients initialized successfully');
    
    // Extract Twilio account info from the request for trial detection
    let accountSid = null;
    let callSid = null;
    
    if (req.method === 'POST') {
      try {
        const clonedReq = req.clone();
        const formData = await clonedReq.formData();
        accountSid = formData.get('AccountSid')?.toString() || null;
        callSid = formData.get('CallSid')?.toString() || null;
        
        console.log(`Extracted AccountSid: ${accountSid ? accountSid.substring(0, 6) + '...' : 'null'}`);
        console.log(`Extracted CallSid: ${callSid || 'null'}`);
      } catch (error) {
        console.warn("Could not extract form data for trial account detection:", error);
      }
    }
    
    // Check if this is likely a trial account
    const isTrial = isTrialAccount(accountSid);
    console.log(`Is Twilio trial account? ${isTrial}`);
    
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
    } else if (!isStatusCallback) {
      // Only warn about missing userId for non-status callbacks
      console.warn("No userId in webhook URL for validation - this is required for initial calls");
    }
    
    // Process status callback if that's what this is
    if (isStatusCallback) {
      console.log('Processing status callback request');
      return handleStatusCallback(req, supabaseAdmin);
    }
    
    // Validate Twilio request (skip validation for OPTIONS and status updates if needed)
    if (!isStatusCallback) {
      console.log('Attempting to validate Twilio request signature with user-specific auth token');
      const isValidRequest = await validateTwilioRequest(req, req.url, userTwilioAuthToken, bypassValidation);
      
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
    
    console.log('Processing standard webhook request for initial call TwiML');
    
    // If in development or debug mode, provide more verbose details
    if (debugMode) {
      console.log('Debug mode detected - returning debug TwiML response');
      const debugResponse = createDebugTwiML({
        accountSid,
        callSid,
        isTrial,
        prospectId,
        agentConfigId,
        userId,
        bypassValidation,
        voiceId
      });
      
      return new Response(debugResponse, { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // For trial accounts, provide a simplified TwiML response that works better but still continues the call
    if (isTrial) {
      console.log('Trial account detected - providing modified TwiML response for trial account');
      
      // Now set up the process-response call to continue the conversation
      const processResponseBaseUrl = `${url.origin}/twilio-process-response`;
      const processResponseParams = {
        prospect_id: prospectId,
        agent_config_id: agentConfigId,
        user_id: userId,
        voice_id: voiceId,
        conversation_count: '0',
        bypass_validation: bypassValidation ? 'true' : undefined, 
        debug_mode: debugMode ? 'true' : undefined
      };
      
      if (callLogId) {
        processResponseParams.call_log_id = callLogId;
      }
      
      // Create XML-encoded URL
      const processResponseUrl = encodeXmlUrl(processResponseBaseUrl, processResponseParams);
      
      // Create a TwiML response
      const response = twiml.VoiceResponse();
      
      // First say the trial message
      response.say("Hello, this is the eXp Realty AI assistant. This is a trial account which has limitations. I'm here to help with your real estate needs.");
      
      // Add a pause to make it more natural
      response.pause({ length: 1 });
      
      // Create a Gather with Say element
      const gather = response.gather({
        input: 'speech dtmf',
        action: processResponseUrl,
        timeout: 10,
        speechTimeout: 'auto',
        language: 'en-US',
        method: 'POST'
      });
      
      // Add the Say element inside Gather
      gather.say("How can I assist you with your real estate needs today?");
      
      // End the Gather element
      gather.endGather();
      
      // If gather times out, redirect to the process-response endpoint anyway
      // This must be outside the Gather element
      response.redirect({
        method: 'POST'
      }, processResponseUrl);
      
      // Log the final TwiML for debugging
      const twimlString = response.toString();
      console.log(`Final TwiML response for trial account (full TwiML):`);
      console.log(twimlString);
      
      // Verify the TwiML structure is correct
      if (!twimlString.includes('</Gather>')) {
        console.error('ERROR: Generated TwiML does not contain a closing Gather tag!');
      }
      
      return new Response(twimlString, { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // For standard accounts, do the same but without the trial message
    console.log('Standard account - providing TwiML response');
    
    // Create a response that will redirect to the process-response webhook
    const response = twiml.VoiceResponse();
    
    // Fetch agent configuration to use the correct greeting
    let greeting = "Hello, this is the eXp Realty AI assistant. I'm here to help with your real estate needs.";
    let useElevenLabs = false;
    let agentVoiceId = voiceId || null; 
    
    try {
      if (agentConfigId) {
        console.log(`Fetching agent config with ID: ${agentConfigId}`);
        const { data: agentConfig, error: agentConfigError } = await supabaseAdmin
          .from('agent_configs')
          .select('*')
          .eq('id', agentConfigId)
          .maybeSingle();
          
        if (agentConfig && !agentConfigError) {
          console.log(`Found agent config: ${agentConfig.config_name}`);
          // Use system prompt as a base for the greeting if available
          if (agentConfig.system_prompt) {
            const promptLines = agentConfig.system_prompt.split('.');
            if (promptLines.length > 0) {
              const introLine = promptLines[0].trim();
              if (introLine.length > 10) { // Make sure it's not just a short phrase
                greeting = introLine + ".";
              }
            }
          }
          
          // Check if we should use ElevenLabs from the agent config
          if (agentConfig.voice_provider === 'elevenlabs' && agentConfig.voice_id) {
            useElevenLabs = true;
            // If no specific voice ID was passed, use the one from the agent config
            if (!voiceId) {
              agentVoiceId = agentConfig.voice_id;
            }
            console.log(`Using ElevenLabs voice from agent config: ${agentVoiceId}`);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching agent config:', error);
    }
    
    // Check if ElevenLabs API key is available
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      console.warn('ELEVENLABS_API_KEY is not set in environment variables. Using default Twilio voice.');
      useElevenLabs = false;
    } else if (useElevenLabs || voiceId) {
      console.log('ELEVENLABS_API_KEY is available. Voice synthesis will use ElevenLabs.');
      useElevenLabs = true;
    }
    
    // Say the greeting
    if (useElevenLabs) {
      // When using ElevenLabs, use a nicer Twilio voice as fallback for initial greeting
      response.say({
        voice: 'Polly.Amy-Neural' // Use a higher quality voice
      }, greeting);
    } else {
      response.say(greeting);
    }
    
    // Add a pause to make it more natural
    response.pause({ length: 1 });
    
    // Now set up the process-response call to continue the conversation
    const processResponseBaseUrl = `${url.origin}/twilio-process-response`;
    const processResponseParams = {
      prospect_id: prospectId,
      agent_config_id: agentConfigId,
      user_id: userId,
      voice_id: agentVoiceId,
      conversation_count: '0',
      bypass_validation: bypassValidation ? 'true' : undefined, 
      debug_mode: debugMode ? 'true' : undefined
    };
    
    if (callLogId) {
      processResponseParams.call_log_id = callLogId;
    }
    
    // Create XML-encoded URL for the next step
    const processResponseUrl = encodeXmlUrl(processResponseBaseUrl, processResponseParams);
    
    // Create a Gather with Say element
    const gather = response.gather({
      input: 'speech dtmf',
      action: processResponseUrl,
      timeout: 10,
      speechTimeout: 'auto',
      language: 'en-US',
      voice: useElevenLabs ? 'Polly.Amy-Neural' : undefined,
      method: 'POST'
    });
    
    // Add the Say element inside Gather
    gather.say("How can I assist you with your real estate needs today?");
    
    // End the Gather element
    gather.endGather();
    
    // If gather times out, redirect to the process-response endpoint anyway
    // This must be outside the Gather element
    response.redirect({
      method: 'POST'
    }, processResponseUrl);
    
    // Log the full final TwiML for debugging
    const twimlString = response.toString();
    console.log(`Final TwiML response (full TwiML):`);
    console.log(twimlString);
    
    // Verify the TwiML structure is correct
    if (!twimlString.includes('</Gather>')) {
      console.error('ERROR: Generated TwiML does not contain a closing Gather tag!');
    }
    
    console.log('Returning full TwiML response');
    return new Response(twimlString, { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  } catch (error) {
    console.error('Error in twilio-call-webhook function:', error);
    
    // Return a simple TwiML response in case of error
    return new Response(createErrorResponse("I'm sorry, there was an error processing this call. Please try again later."), { 
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
    const accountSid = formData.get('AccountSid')?.toString() || null;
    
    console.log(`Status update for call ${callSid}: ${callStatus}`);
    console.log(`Additional data - Duration: ${callDuration}, Recording URL: ${Boolean(recordingUrl)}`);
    
    // Check if this is likely a trial account
    const isTrial = isTrialAccount(accountSid);
    console.log(`Is Twilio trial account? ${isTrial}`);
    
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
        
        // FIX: Define only the exact fields we want to update, excluding updated_at
        // Capitalize first letter of status
        let statusCapitalized = callStatus;
        if (statusCapitalized) {
          statusCapitalized = statusCapitalized.charAt(0).toUpperCase() + statusCapitalized.slice(1);
        }
        
        // Build a specific update object with only the fields that exist in the table
        // IMPORTANT: Do not include updated_at field which is causing the error
        const updateObj: Record<string, any> = {
          call_status: statusCapitalized
        };
        
        // Conditionally add fields only if they exist
        if (callDuration) {
          updateObj.call_duration_seconds = parseInt(callDuration, 10);
        }
        
        if (recordingUrl) {
          updateObj.recording_url = recordingUrl;
        }
        
        // If call is completed or failed, update the ended_at field
        if (['completed', 'failed', 'busy', 'no-answer'].includes(callStatus || '')) {
          updateObj.ended_at = new Date().toISOString();
        }
        
        // Add a flag for trial accounts
        if (isTrial) {
          updateObj.notes = "Call made with Twilio Trial Account";
        }
        
        console.log('Updating call log with these fields:', updateObj);
        
        try {
          // Update call log without touching updated_at field
          const { error } = await supabaseAdmin
            .from('call_logs')
            .update(updateObj)
            .eq('id', callLog.id);
            
          if (error) {
            console.error('Error updating call log:', error);
            // Don't return error response, just log it and continue
            console.log('Continuing despite update error to avoid call interruption');
          } else {
            console.log('Call log updated successfully');
          }
        } catch (updateError) {
          console.error('Exception in call log update:', updateError);
          // Don't return error response, just log it and continue
          console.log('Continuing despite exception to avoid call interruption');
        }
      } else {
        console.log(`No call log found for call SID: ${callSid}`);
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
    // Always return success to Twilio, even if we had internal errors
    return new Response('Status received', { 
      headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
    });
  } catch (error) {
    console.error('Error in status callback handler:', error);
    // Return success to Twilio despite internal errors
    // This prevents Twilio from retrying and possibly causing more errors
    return new Response('Status received despite errors', { 
      headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
    });
  }
}
