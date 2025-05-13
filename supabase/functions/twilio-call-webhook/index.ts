// supabase/functions/twilio-call-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; // Ensure this is present
// Import the CLASS VoiceResponse from the twiml object in your corrected helper
import { corsHeaders, twiml, validateTwilioRequest, isTrialAccount } from "../_shared/twilio-helper.ts"; 
import { encodeXmlUrl, createErrorResponse, createDebugTwiML, createGatherWithSay } from "../_shared/twiml-helpers.ts"; 

serve(async (req) => {
  const requestTimestamp = new Date().toISOString();
  const functionVersion = "FINAL_FIX_V1"; 
  console.log(`--- [${requestTimestamp}] twilio-call-webhook (${functionVersion}): INCOMING REQUEST. Method: ${req.method}, URL: ${req.url} ---`);

  if (req.method === 'OPTIONS') {
    console.log(`[${requestTimestamp}] Handling OPTIONS preflight request (${functionVersion})`);
    return new Response(null, { headers: corsHeaders });
  }

  let requestBodyForValidation = ""; 
  if (req.method === 'POST') {
      try {
          const clonedReqForBody = req.clone();
          requestBodyForValidation = await clonedReqForBody.text();
      } catch (e) {
          console.warn(`[${requestTimestamp}] (${functionVersion}) Error cloning/reading body for validation: ${e.message}`);
      }
  }

  try {
    const url = new URL(req.url); 
    const fullUrlForValidation = url.toString(); 
    console.log(`[${requestTimestamp}] (${functionVersion}) Parsed URL: ${url.origin + url.pathname}, Search params: ${url.search}`);

    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    const voiceIdFromUrl = url.searchParams.get('voice_id'); 
    const bypassValidation = url.searchParams.get('bypass_validation') === 'true';
    const debugMode = url.searchParams.get('debug_mode') === 'true' || bypassValidation;

    console.log(`[${requestTimestamp}] (${functionVersion}) Query parameters: call_log_id=${callLogId}, prospect_id=${prospectId}, agent_config_id=${agentConfigId}, user_id=${userId}, voice_id=${voiceIdFromUrl || 'undefined'}, bypass_validation=${bypassValidation}, debug_mode=${debugMode}`);

    const isStatusCallback = url.pathname.endsWith('/status');
    console.log(`[${requestTimestamp}] (${functionVersion}) Is status callback? ${isStatusCallback}`);

    // Initialize Supabase client first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error(`[${requestTimestamp}] (${functionVersion}) CRITICAL ERROR: Missing Supabase environment variables.`);
      return new Response(createErrorResponse("I'm sorry, there was an error with the server configuration. Please try again later."), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
    console.log(`[${requestTimestamp}] (${functionVersion}) Supabase admin client initialized.`);

    let accountSid = null;
    let callSid = null;
    
    if (req.method === 'POST' && requestBodyForValidation) { 
        try {
            const formData = new URLSearchParams(requestBodyForValidation);
            accountSid = formData.get('AccountSid') || null;
            callSid = formData.get('CallSid') || null;
            console.log(`[${requestTimestamp}] (${functionVersion}) Extracted from POST body: AccountSid: ${accountSid ? accountSid.substring(0, 6) + '...' : 'null'}, CallSid: ${callSid || 'null'}`);
        } catch (error) {
            console.warn(`[${requestTimestamp}] (${functionVersion}) Could not parse POST body string as form data:`, error.message);
        }
    }

    let userTwilioAuthToken = null;
    if (userId) {
      console.log(`[${requestTimestamp}] (${functionVersion}) Attempting to fetch Twilio auth token for user ${userId}`);
      try {
        const { data: profile, error: profileError } = await supabaseAdmin 
          .from('profiles')
          .select('twilio_auth_token')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          console.error(`[${requestTimestamp}] (${functionVersion}) Error fetching profile for user ${userId}:`, profileError.message);
        } else if (profile && profile.twilio_auth_token) {
          userTwilioAuthToken = profile.twilio_auth_token;
          console.log(`[${requestTimestamp}] (${functionVersion}) Auth token fetched successfully for user ${userId}.`);
        } else {
          console.warn(`[${requestTimestamp}] (${functionVersion}) No auth token found in profile for user ${userId}.`);
        }
      } catch (profileFetchError) {
        console.error(`[${requestTimestamp}] (${functionVersion}) Exception fetching profile for user ${userId}:`, profileFetchError.message);
      }
    } else {
      console.warn(`[${requestTimestamp}] (${functionVersion}) No userId in webhook URL. Cannot fetch user-specific Twilio auth token for validation.`);
    }
    
    const validationUrlToUse = url.origin + url.pathname + (req.method === 'GET' ? url.search : '');

    if (!isStatusCallback) {
      console.log(`[${requestTimestamp}] (${functionVersion}) Attempting to validate Twilio request. Validation URL: ${validationUrlToUse}`);
      const isValidRequest = await validateTwilioRequest(req, validationUrlToUse, userTwilioAuthToken, bypassValidation, requestBodyForValidation);

      if (!isValidRequest) {
        console.error(`[${requestTimestamp}] (${functionVersion}) Twilio request validation FAILED. URL: ${validationUrlToUse}. Returning 403 Forbidden.`);
        return new Response("Twilio signature validation failed.", {
          status: 403,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders } 
        });
      }
      console.log(`[${requestTimestamp}] (${functionVersion}) Twilio request validated successfully.`);
    }

    if (isStatusCallback) {
      console.log(`[${requestTimestamp}] (${functionVersion}) Processing status callback request.`);
      return await handleStatusCallback(req, supabaseAdmin, requestTimestamp, requestBodyForValidation);
    }

    console.log(`[${requestTimestamp}] (${functionVersion}) Processing standard webhook request for initial TwiML.`);

    const response = new twiml.VoiceResponse(); 

    if (debugMode) {
      console.log(`[${requestTimestamp}] (${functionVersion}) Debug mode active. Adding debug TwiML.`);
      const debugTwimlString = createDebugTwiML({ 
          accountSid: accountSid, 
          callSid: callSid, 
          isTrial: isTrialAccount(accountSid),
          prospectId: prospectId, 
          agentConfigId: agentConfigId, 
          userId: userId, 
          voiceId: voiceIdFromUrl 
      });
      // Since createDebugTwiML returns a string, we can't directly add to it.
      // A better way would be for createDebugTwiML to accept the response object.
      // For now, just log it and add a simple say.
      console.log(`[${requestTimestamp}] (${functionVersion}) Generated Debug TwiML String: ${debugTwimlString}`);
      response.say({voice: 'alice'}, `Debug. CallSID: ${callSid || 'N/A'}.`);
      response.pause({ length: 1 });
    }
    
    let greeting = "Hello! This is a helpful assistant from eXp Realty.";
    const defaultGreeting = "Hello, this is the eXp Realty AI assistant. I'm here to help with your real estate needs.";
    let useElevenLabs = false;
    let finalAgentVoiceId = voiceIdFromUrl || null; 
    let initialSayVoice = 'alice'; 

    if (agentConfigId) {
        try {
            console.log(`[${requestTimestamp}] (${functionVersion}) Fetching agent config ${agentConfigId}.`);
            const { data: agentConfig, error: agentConfigError } = await supabaseAdmin
                .from('agent_configs')
                .select('system_prompt, config_name, voice_provider, voice_id')
                .eq('id', agentConfigId)
                .maybeSingle();

            if (agentConfigError) throw agentConfigError;

            if (agentConfig) {
                console.log(`[${requestTimestamp}] (${functionVersion}) Found agent config: ${agentConfig.config_name}.`);
                const systemPromptFirstSentence = (agentConfig.system_prompt && agentConfig.system_prompt.trim() !== "") 
                    ? agentConfig.system_prompt.split(/[.!?]/)[0].trim() 
                    : "";
                greeting = (systemPromptFirstSentence.length > 10) ? systemPromptFirstSentence + "." : defaultGreeting;

                if (agentConfig.voice_provider === 'elevenlabs' && agentConfig.voice_id) {
                    if (!finalAgentVoiceId) finalAgentVoiceId = agentConfig.voice_id; 
                    useElevenLabs = true;
                    console.log(`[${requestTimestamp}] (${functionVersion}) Agent config suggests ElevenLabs. Voice ID to use: ${finalAgentVoiceId}`);
                }
            } else {
                console.warn(`[${requestTimestamp}] (${functionVersion}) Agent config ${agentConfigId} not found. Using defaults.`);
                greeting = defaultGreeting;
            }
        } catch (error) {
            console.error(`[${requestTimestamp}] (${functionVersion}) Error fetching agent config: ${error.message}. Using defaults.`);
            greeting = defaultGreeting;
        }
    } else {
        greeting = defaultGreeting;
        if (voiceIdFromUrl) { 
             console.log(`[${requestTimestamp}] (${functionVersion}) No agentConfigId, but voiceIdFromUrl (${voiceIdFromUrl}) present.`);
        }
    }
    
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (finalAgentVoiceId && elevenLabsApiKey) { 
        useElevenLabs = true;
        initialSayVoice = 'Polly.Amy-Neural'; 
        console.log(`[${requestTimestamp}] (${functionVersion}) ElevenLabs will be attempted. Voice ID: ${finalAgentVoiceId}. Base Twilio voice: ${initialSayVoice}`);
    } else if (finalAgentVoiceId && !elevenLabsApiKey) {
        console.warn(`[${requestTimestamp}] (${functionVersion}) ElevenLabs voice ID ${finalAgentVoiceId} present, but ELEVENLABS_API_KEY missing. Using default Twilio voice.`);
        useElevenLabs = false; 
        initialSayVoice = 'alice';
    } else {
        useElevenLabs = false; 
        initialSayVoice = 'alice';
    }

    const processResponseBaseUrl = `${url.origin}/twilio-process-response`;
    const finalProcessResponseParams: Record<string, string | undefined> = {
        prospect_id: prospectId || undefined,
        agent_config_id: agentConfigId || undefined,
        user_id: userId || undefined,
        voice_id: finalAgentVoiceId || undefined, 
        conversation_count: '0',
        bypass_validation: bypassValidation ? 'true' : undefined,
        debug_mode: debugMode ? 'true' : undefined
    };
    if (callLogId) finalProcessResponseParams.call_log_id = callLogId;
    const encodedProcessResponseUrl = encodeXmlUrl(processResponseBaseUrl, finalProcessResponseParams);
    console.log(`[${requestTimestamp}] (${functionVersion}) Final processResponseUrl (encoded): ${encodedProcessResponseUrl}`);

    const greetingToSay = (greeting && greeting.trim() !== "") ? greeting.trim() : "Hello.";
    response.say({ voice: initialSayVoice }, greetingToSay);
    console.log(`[${requestTimestamp}] (${functionVersion}) Initial <Say voice="${initialSayVoice}">: "${greetingToSay}"`);
    response.pause({ length: 1 });

    const gatherPromptToSay = "How can I assist you with your real estate needs today?";
    // Use the createGatherWithSay helper from twiml-helpers.ts
    createGatherWithSay(
        response, // Pass the response instance
        encodedProcessResponseUrl,
        gatherPromptToSay,
        { // Options for gather and its nested say
            timeout: 10,
            speechTimeout: 'auto',
            language: 'en-US',
            voice: initialSayVoice, // Voice for the nested <Say>
            actionOnEmptyResult: true
        }
    );
    console.log(`[${requestTimestamp}] (${functionVersion}) Gather block defined using createGatherWithSay. Action: ${encodedProcessResponseUrl}`);

    const fallbackMessage = "I'm sorry, I didn't catch that. We may need to try again later.";
    response.say({ voice: initialSayVoice }, fallbackMessage); 
    console.log(`[${requestTimestamp}] (${functionVersion}) Fallback <Say voice="${initialSayVoice}">: "${fallbackMessage}"`);
    response.hangup();

    const twimlString = response.toString();
    console.log(`[${requestTimestamp}] (${functionVersion}) TwiML Being Sent (Full from Corrected Helper V1):`);
    console.log(twimlString); 

    // Final TwiML validation checks
    if (!twimlString.includes('</Gather>') && twimlString.includes('<Gather')) { 
        console.error(`[${requestTimestamp}] (${functionVersion}) FINAL TwiML CHECK ERROR: String missing </Gather>!`);
    }
    if (twimlString.includes("[object Object]")) {
        console.error(`[${requestTimestamp}] (${functionVersion}) FINAL TwiML CHECK ERROR: String contains "[object Object]"!`);
    }
    const gatherActionMatch = twimlString.match(/<Gather[^>]*action="([^"]*)"/);
    if (gatherActionMatch && gatherActionMatch[1] && gatherActionMatch[1].includes("&") && !gatherActionMatch[1].includes("&amp;")) {
        console.error(`[${requestTimestamp}] (${functionVersion}) FINAL TwiML CHECK ERROR: Gather action attribute contains unencoded ampersands: "${gatherActionMatch[1]}"`);
    }
    if (twimlString.includes("<Redirect")) { 
        console.error(`[${requestTimestamp}] (${functionVersion}) FINAL TwiML CHECK ERROR: TwiML string unexpectedly contains a Redirect tag!`);
    }


    return new Response(twimlString, {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    const catchTimestamp = new Date().toISOString();
    console.error(`[${catchTimestamp}] FATAL ERROR in twilio-call-webhook (${functionVersion}):`, error.message, error.stack);
    return new Response(createErrorResponse("A critical server error occurred during the call. Please try again later."), {
      status: 500, 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

async function handleStatusCallback(req: Request, supabaseAdmin: any, requestTimestamp: string, rawBody?: string): Promise<Response> {
  try {
    console.log(`[${requestTimestamp}] Processing status callback from Twilio in handleStatusCallback.`);
    let formData;
    if (rawBody && rawBody.length > 0) { 
        formData = new URLSearchParams(rawBody);
    } else {
        console.warn(`[${requestTimestamp}] Raw body not available or empty in handleStatusCallback, attempting req.formData()`);
        try {
            formData = await req.formData();
        } catch (e) {
            console.error(`[${requestTimestamp}] Failed to parse formData in handleStatusCallback: ${e.message}. Assuming no relevant form data.`);
            formData = new URLSearchParams(); 
        }
    }

    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const callDuration = formData.get('CallDuration')?.toString();
    const recordingUrl = formData.get('RecordingUrl')?.toString();
    const accountSid = formData.get('AccountSid')?.toString() || null;

    console.log(`[${requestTimestamp}] Status update for call ${callSid || 'UNKNOWN_SID'}: ${callStatus || 'UNKNOWN_STATUS'}`);
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
