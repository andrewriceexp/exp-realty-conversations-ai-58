// supabase/functions/twilio-call-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Polyfill for btoa if not globally available
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Ensure this path is correct and the helper functions are as expected.
import { corsHeaders, twiml, validateTwilioRequest, isTrialAccount, createDebugTwiML } from "../_shared/twilio-helper.ts";
import { encodeXmlUrl, createGatherWithSay, createErrorResponse } from "../_shared/twiml-helpers.ts"; 

serve(async (req) => {
  const requestTimestamp = new Date().toISOString();
  console.log(`--- [${requestTimestamp}] twilio-call-webhook: INCOMING REQUEST. Method: ${req.method}, URL: ${req.url} ---`);
  console.log(`[${requestTimestamp}] Request headers: ${JSON.stringify([...req.headers.entries()].reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {}))}`);


  if (req.method === 'OPTIONS') {
    console.log(`[${requestTimestamp}] Handling OPTIONS preflight request for twilio-call-webhook`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fullUrl = url.origin + url.pathname; // Used for validation
    console.log(`[${requestTimestamp}] Parsed URL: ${fullUrl}, Search params: ${url.search}`);

    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    const voiceId = url.searchParams.get('voice_id'); 
    const bypassValidation = url.searchParams.get('bypass_validation') === 'true';
    const debugMode = url.searchParams.get('debug_mode') === 'true' || bypassValidation;


    console.log(`[${requestTimestamp}] Query parameters: call_log_id=${callLogId}, prospect_id=${prospectId}, agent_config_id=${agentConfigId}, user_id=${userId}, voice_id=${voiceId ? voiceId.substring(0, 8) + '...' : 'undefined'}, bypass_validation=${bypassValidation}, debug_mode=${debugMode}`);

    const isStatusCallback = url.pathname.endsWith('/status');
    console.log(`[${requestTimestamp}] Is status callback? ${isStatusCallback}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error(`[${requestTimestamp}] CRITICAL ERROR: Missing Supabase environment variables in twilio-call-webhook.`);
      return new Response(createErrorResponse("I'm sorry, there was an error with the configuration. Please try again later."), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
    console.log(`[${requestTimestamp}] Supabase admin client initialized for twilio-call-webhook.`);

    let accountSid = null;
    let callSid = null;
    let requestBodyForValidation = ""; 

    if (req.method === 'POST') {
        try {
            const clonedReqForBody = req.clone();
            requestBodyForValidation = await clonedReqForBody.text(); 
            
            const formData = new URLSearchParams(requestBodyForValidation);
            accountSid = formData.get('AccountSid') || null;
            callSid = formData.get('CallSid') || null;
            console.log(`[${requestTimestamp}] Extracted from POST body: AccountSid: ${accountSid ? accountSid.substring(0, 6) + '...' : 'null'}, CallSid: ${callSid || 'null'}`);
        } catch (error) {
            console.warn(`[${requestTimestamp}] Could not parse POST body in twilio-call-webhook:`, error.message);
        }
    }

    const isTrial = isTrialAccount(accountSid);
    console.log(`[${requestTimestamp}] Is Twilio trial account? ${isTrial}`);

    let userTwilioAuthToken = null;
    if (userId) {
      console.log(`[${requestTimestamp}] Attempting to fetch Twilio auth token for user ${userId} in twilio-call-webhook`);
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('twilio_auth_token')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          console.error(`[${requestTimestamp}] Error fetching profile for user ${userId} for validation in twilio-call-webhook:`, profileError.message);
        } else if (profile && profile.twilio_auth_token) {
          userTwilioAuthToken = profile.twilio_auth_token;
          console.log(`[${requestTimestamp}] Auth token fetched successfully for user ${userId} in twilio-call-webhook.`);
        } else {
          console.warn(`[${requestTimestamp}] No auth token found in profile for user ${userId} in twilio-call-webhook. Validation will likely fail unless bypassed.`);
        }
      } catch (profileFetchError) {
        console.error(`[${requestTimestamp}] Exception fetching profile for user ${userId} in twilio-call-webhook:`, profileFetchError.message);
      }
    } else {
      console.warn(`[${requestTimestamp}] No userId in twilio-call-webhook URL. Twilio signature validation will use default/empty token unless bypassed.`);
    }

    if (!isStatusCallback) {
      console.log(`[${requestTimestamp}] Attempting to validate Twilio request signature for twilio-call-webhook. Full URL: ${fullUrl}`);
      const isValidRequest = await validateTwilioRequest(req, fullUrl, userTwilioAuthToken, bypassValidation, requestBodyForValidation);

      if (!isValidRequest) {
        console.error(`[${requestTimestamp}] Twilio request validation FAILED for twilio-call-webhook. URL: ${fullUrl}. Returning 403 Forbidden.`);
        return new Response("Twilio signature validation failed.", {
          status: 403,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
        });
      }
      console.log(`[${requestTimestamp}] Twilio request validated successfully for twilio-call-webhook.`);
    }

    if (isStatusCallback) {
      console.log(`[${requestTimestamp}] Processing status callback request in twilio-call-webhook.`);
      return await handleStatusCallback(req, supabaseAdmin, requestTimestamp, requestBodyForValidation);
    }

    console.log(`[${requestTimestamp}] Processing standard webhook request for initial call TwiML in twilio-call-webhook.`);

    const response = twiml.VoiceResponse(); 

    if (debugMode) {
      console.log(`[${requestTimestamp}] Debug mode active for twilio-call-webhook. Adding debug TwiML.`);
      response.say(`Debug Mode Active. SID: ${callSid || 'N/A'}. User: ${userId || 'N/A'}. VoiceID: ${voiceId || 'N/A'}`);
      response.pause({length: 1});
    }
    
    const processResponseBaseUrl = `${url.origin}/twilio-process-response`;
    const processResponseParams: Record<string, string | undefined> = { 
        prospect_id: prospectId || undefined,
        agent_config_id: agentConfigId || undefined,
        user_id: userId || undefined,
        voice_id: voiceId || undefined, 
        conversation_count: '0',
        bypass_validation: bypassValidation ? 'true' : undefined,
        debug_mode: debugMode ? 'true' : undefined
    };
    if (callLogId) {
        processResponseParams.call_log_id = callLogId;
    }
    // Ensure encodeXmlUrl is used here as it's critical for action attributes
    const processResponseUrl = encodeXmlUrl(processResponseBaseUrl, processResponseParams);


    if (isTrial) {
      console.log(`[${requestTimestamp}] Trial account detected for twilio-call-webhook. Providing modified TwiML.`);
      response.say("Hello, this is the eXp Realty AI assistant. This is a trial account which has limitations. I'm here to help with your real estate needs.");
      response.pause({ length: 1 });
      
      createGatherWithSay(
        response,
        processResponseUrl, // Already encoded
        "How can I assist you with your real estate needs today?", // Explicit string
        {
          timeout: 10,
          speechTimeout: 'auto',
          language: 'en-US',
          method: 'POST'
        }
      );
      // Fallback redirect URL must also be encoded
      response.redirect({ method: 'POST' }, processResponseUrl); 

    } else { // Standard Account Logic
      let greeting = "Hello, this is the eXp Realty AI assistant. I'm here to help with your real estate needs."; // Default greeting
      let useElevenLabs = false;
      let agentVoiceId = voiceId || null; 

      if (agentConfigId) {
        try {
          console.log(`[${requestTimestamp}] Fetching agent config ${agentConfigId} for greeting in twilio-call-webhook.`);
          const { data: agentConfig, error: agentConfigError } = await supabaseAdmin
            .from('agent_configs')
            .select('system_prompt, config_name, voice_provider, voice_id') 
            .eq('id', agentConfigId)
            .maybeSingle();

          if (agentConfigError) {
            console.error(`[${requestTimestamp}] Error fetching agent config in twilio-call-webhook: ${agentConfigError.message}`);
          } else if (agentConfig) {
            console.log(`[${requestTimestamp}] Found agent config: ${agentConfig.config_name} for twilio-call-webhook.`);
            if (agentConfig.system_prompt && agentConfig.system_prompt.trim() !== "") { // Check if not empty
              const promptLines = agentConfig.system_prompt.split(/[.!?]/); 
              if (promptLines.length > 0) {
                const introLine = promptLines[0].trim();
                if (introLine.length > 10) { 
                   greeting = introLine + (/[.!?]$/.test(introLine) ? "" : ".");
                }
              }
            } else {
                console.warn(`[${requestTimestamp}] Agent config system_prompt is empty. Using default greeting.`);
            }
            if (agentConfig.voice_provider === 'elevenlabs' && agentConfig.voice_id) {
              useElevenLabs = true;
              if (!agentVoiceId) agentVoiceId = agentConfig.voice_id; 
              console.log(`[${requestTimestamp}] Using ElevenLabs voice from agent config: ${agentVoiceId}`);
            }
          } else {
            console.warn(`[${requestTimestamp}] Agent config ${agentConfigId} not found for twilio-call-webhook. Using default greeting/voice.`);
          }
        } catch (error) {
          console.error(`[${requestTimestamp}] Exception fetching agent config for greeting in twilio-call-webhook:`, error.message);
        }
      }
      
      const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
      if (useElevenLabs && !elevenLabsApiKey) {
          console.warn(`[${requestTimestamp}] ElevenLabs selected but ELEVENLABS_API_KEY is not set. Falling back to default Twilio voice.`);
          useElevenLabs = false;
      } else if (useElevenLabs || (voiceId && elevenLabsApiKey)) { 
          console.log(`[${requestTimestamp}] ELEVENLABS_API_KEY is available. Voice synthesis will attempt ElevenLabs if configured/requested.`);
          useElevenLabs = true; 
          if (!agentVoiceId && voiceId) agentVoiceId = voiceId; 
      }

      // Construct the final processResponseUrl with the potentially updated agentVoiceId
      const finalProcessResponseParams: Record<string, string | undefined> = {
        prospect_id: prospectId || undefined,
        agent_config_id: agentConfigId || undefined,
        user_id: userId || undefined,
        voice_id: agentVoiceId || undefined, // Use determined agentVoiceId
        conversation_count: '0',
        bypass_validation: bypassValidation ? 'true' : undefined,
        debug_mode: debugMode ? 'true' : undefined
      };
      if (callLogId) finalProcessResponseParams.call_log_id = callLogId;
      // Ensure this URL is also encoded
      const finalProcessResponseUrl = encodeXmlUrl(processResponseBaseUrl, finalProcessResponseParams);

      // Ensure greeting is not an empty string before passing to <Say>
      const greetingToSay = (greeting && greeting.trim() !== "") ? greeting : "Hello.";
      if (useElevenLabs) {
        response.say({ voice: 'Polly.Amy-Neural' }, greetingToSay); 
      } else {
        response.say(greetingToSay);
      }
      response.pause({ length: 1 });

      // Ensure the message for createGatherWithSay is a string
      const gatherPrompt = "How can I assist you with your real estate needs today?";
      createGatherWithSay(
        response,
        finalProcessResponseUrl, // Already encoded
        gatherPrompt, // Explicit string
        {
          timeout: 10,
          speechTimeout: 'auto',
          language: 'en-US',
          voice: useElevenLabs ? 'Polly.Amy-Neural' : undefined, 
          method: 'POST'
        }
      );
      // Fallback redirect URL must also be encoded
      response.redirect({ method: 'POST' }, finalProcessResponseUrl); 
    }

    const twimlString = response.toString();
    console.log(`[${requestTimestamp}] Returning TwiML from twilio-call-webhook (full TwiML):`);
    console.log(twimlString); 
    if (!twimlString.includes('</Gather>') && twimlString.includes('<Gather')) { 
        console.error(`[${requestTimestamp}] ERROR: Generated TwiML might be missing a closing Gather tag! Review createGatherWithSay helper.`);
    }
    if (twimlString.includes("[object Object]")) {
        console.error(`[${requestTimestamp}] ERROR: Generated TwiML contains "[object Object]". Review Say calls.`);
    }
    if (twimlString.match(/action="[^"]*&[^a][^m][^p;]/) || twimlString.match(/<Redirect>[^<]*&[^a][^m][^p;]/) ) { // Basic check for unencoded &
        console.error(`[${requestTimestamp}] ERROR: Generated TwiML likely contains unencoded ampersands in URL! Review encodeXmlUrl usage.`);
    }

    return new Response(twimlString, { headers: { 'Content-Type': 'text/xml', ...corsHeaders } });

  } catch (error) {
    console.error(`[${requestTimestamp}] FATAL ERROR in twilio-call-webhook:`, error.message, error.stack);
    return new Response(createErrorResponse("I'm sorry, there was an error processing this call. Please try again later."), {
      status: 500, 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

async function handleStatusCallback(req: Request, supabaseAdmin: any, requestTimestamp: string, rawBody?: string): Promise<Response> {
  try {
    console.log(`[${requestTimestamp}] Processing status callback from Twilio in handleStatusCallback.`);
    let formData;
    if (rawBody) {
        formData = new URLSearchParams(rawBody);
    } else {
        console.warn(`[${requestTimestamp}] Raw body not available in handleStatusCallback, attempting req.formData()`);
        formData = await req.formData(); 
    }

    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const callDuration = formData.get('CallDuration')?.toString();
    const recordingUrl = formData.get('RecordingUrl')?.toString();
    const accountSid = formData.get('AccountSid')?.toString() || null;

    console.log(`[${requestTimestamp}] Status update for call ${callSid}: ${callStatus}`);
    console.log(`[${requestTimestamp}] Additional data - Duration: ${callDuration}, Recording URL: ${Boolean(recordingUrl)}, AccountSid: ${accountSid}`);

    const isTrial = isTrialAccount(accountSid);
    console.log(`[${requestTimestamp}] Is Twilio trial account (status)? ${isTrial}`);

    if (callSid && callStatus) {
      console.log(`[${requestTimestamp}] Looking up call log for CallSid: ${callSid} in handleStatusCallback.`);
      const { data: callLog, error: findError } = await supabaseAdmin
        .from('call_logs')
        .select('id, prospect_id') 
        .eq('twilio_call_sid', callSid)
        .maybeSingle();

      if (findError) {
        console.error(`[${requestTimestamp}] Error finding call log in handleStatusCallback:`, findError.message);
      } else if (callLog) {
        console.log(`[${requestTimestamp}] Found call log: ${callLog.id} for CallSid: ${callSid} in handleStatusCallback.`);
        let statusCapitalized = callStatus.charAt(0).toUpperCase() + callStatus.slice(1);
        const updateObj: Record<string, any> = { call_status: statusCapitalized };

        if (callDuration) updateObj.call_duration_seconds = parseInt(callDuration, 10);
        if (recordingUrl) updateObj.recording_url = recordingUrl;
        if (['completed', 'failed', 'busy', 'no-answer'].includes(callStatus.toLowerCase())) { 
          updateObj.ended_at = new Date().toISOString();
        }
        if (isTrial && !updateObj.notes) updateObj.notes = "Call made with Twilio Trial Account";

        console.log(`[${requestTimestamp}] Updating call log ${callLog.id} with fields:`, JSON.stringify(updateObj));
        const { error: updateError } = await supabaseAdmin
          .from('call_logs')
          .update(updateObj)
          .eq('id', callLog.id);

        if (updateError) {
          console.error(`[${requestTimestamp}] Error updating call log ${callLog.id} in handleStatusCallback:`, updateError.message);
        } else {
          console.log(`[${requestTimestamp}] Call log ${callLog.id} updated successfully in handleStatusCallback.`);
          if (['Completed', 'Failed', 'Busy', 'No-answer'].includes(statusCapitalized) && callLog.prospect_id) {
              const { error: prospectUpdateError } = await supabaseAdmin
                  .from('prospects')
                  .update({ status: statusCapitalized, last_call_attempted: new Date().toISOString() })
                  .eq('id', callLog.prospect_id);
              if (prospectUpdateError) {
                  console.error(`[${requestTimestamp}] Error updating prospect ${callLog.prospect_id} status:`, prospectUpdateError.message);
              } else {
                  console.log(`[${requestTimestamp}] Prospect ${callLog.prospect_id} status updated to ${statusCapitalized}.`);
              }
          }
        }
      } else {
        console.log(`[${requestTimestamp}] No call log found for call SID: ${callSid} during status update. This might be an early status update or an issue.`);
      }
    } else {
      console.error(`[${requestTimestamp}] Missing CallSid or CallStatus in Twilio status callback. Form Data:`, Object.fromEntries(formData.entries()));
    }
    console.log(`[${requestTimestamp}] Completed status callback processing in handleStatusCallback.`);
    return new Response('Status received', { headers: { 'Content-Type': 'text/plain', ...corsHeaders } });
  } catch (error) {
    console.error(`[${requestTimestamp}] Error in handleStatusCallback:`, error.message, error.stack);
    return new Response('Status received despite internal error', {
      status: 200, 
      headers: { 'Content-Type': 'text/plain', ...corsHeaders }
    });
  }
}
