// supabase/functions/twilio-call-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Polyfill for btoa if not globally available
// We only need the basic twiml object and corsHeaders for this test
import { corsHeaders, twiml } from "../_shared/twilio-helper.ts"; 
// encodeXmlUrl is critical for the action attribute
import { encodeXmlUrl } from "../_shared/twiml-helpers.ts"; 

serve(async (req) => {
  const requestTimestamp = new Date().toISOString();
  const functionVersion = "ULTRA_SIMPLIFIED_V5"; // Version marker
  console.log(`--- [${requestTimestamp}] twilio-call-webhook (${functionVersion}): INCOMING REQUEST. Method: ${req.method}, URL: ${req.url} ---`);

  if (req.method === 'OPTIONS') {
    console.log(`[${requestTimestamp}] Handling OPTIONS preflight request (${functionVersion})`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url); // Needed for constructing the action URL base

    // Log all incoming query parameters from Twilio's initial request to this webhook
    const incomingQueryParams = Object.fromEntries(url.searchParams.entries());
    console.log(`[${requestTimestamp}] (${functionVersion}) Incoming query parameters: ${JSON.stringify(incomingQueryParams)}`);

    const response = twiml.VoiceResponse();

    const greeting = "Hello from the ultra simplified test. Please say something, then press any key.";
    response.say({ voice: 'alice' }, greeting);
    console.log(`[${requestTimestamp}] (${functionVersion}) Initial <Say>: "${greeting}"`);
    response.pause({ length: 1 });

    // Construct a minimal action URL for the Gather verb
    // We'll pass some dummy parameters to see if they arrive and are encoded
    const processResponseBaseUrl = `${url.origin}/twilio-process-response`;
    const actionParams: Record<string, string | undefined> = { 
      test_param: "simplified_test_value_with_spaces_and_symbols_!@#", // Test encoding
      conversation_count: "0",
      webhook_version: functionVersion, // Pass version for easier debugging in process-response
      // Include original query params if they exist, to help twilio-process-response later
      prospect_id: url.searchParams.get('prospect_id') || undefined,
      agent_config_id: url.searchParams.get('agent_config_id') || undefined,
      user_id: url.searchParams.get('user_id') || undefined,
    };
    
    const encodedActionUrl = encodeXmlUrl(processResponseBaseUrl, actionParams);
    console.log(`[${requestTimestamp}] (${functionVersion}) Gather action URL (encoded by helper): "${encodedActionUrl}"`);


    // Create the <Gather> verb directly and explicitly
    const gather = response.gather({
        input: 'speech dtmf', // Test with speech and dtmf
        action: encodedActionUrl, // Use the XML-encoded URL
        method: 'POST',
        timeout: 7, // Slightly shorter timeout for testing
        numDigits: 1, // Expect 1 digit for DTMF part of test
        speechTimeout: 'auto',
        actionOnEmptyResult: true 
    });
    // Nest the <Say> for the gather prompt directly
    const gatherPrompt = "We are listening for your speech or a key press.";
    gather.say({ voice: 'alice' }, gatherPrompt);
    console.log(`[${requestTimestamp}] (${functionVersion}) Nested <Say> in Gather: "${gatherPrompt}"`);

    // Fallback verbs *after* the <Gather> block, as siblings
    const fallbackMessage = "No input was received from the gather. Goodbye.";
    response.say({ voice: 'alice' }, fallbackMessage);
    console.log(`[${requestTimestamp}] (${functionVersion}) Fallback <Say>: "${fallbackMessage}"`);
    response.hangup();

    const twimlString = response.toString();
    console.log(`[${requestTimestamp}] (${functionVersion}) TwiML Being Sent (Full):`);
    console.log(twimlString); // Log the exact TwiML

    // Final check for common errors in the generated string
    if (!twimlString.includes('</Gather>') && twimlString.includes('<Gather')) { 
        console.error(`[${requestTimestamp}] (${functionVersion}) FINAL TwiML CHECK ERROR: String missing </Gather>!`);
    }
    if (twimlString.includes("[object Object]")) {
        console.error(`[${requestTimestamp}] (${functionVersion}) FINAL TwiML CHECK ERROR: String contains "[object Object]"!`);
    }
    // Check specifically the action attribute of the Gather verb for unencoded ampersands
    const gatherActionMatch = twimlString.match(/<Gather[^>]*action="([^"]*)"/);
    if (gatherActionMatch && gatherActionMatch[1] && gatherActionMatch[1].includes("&") && !gatherActionMatch[1].includes("&amp;")) {
        console.error(`[${requestTimestamp}] (${functionVersion}) FINAL TwiML CHECK ERROR: Gather action attribute contains unencoded ampersands: "${gatherActionMatch[1]}"`);
    }


    return new Response(twimlString, {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    console.error(`[${requestTimestamp}] FATAL ERROR in twilio-call-webhook (${functionVersion}):`, error.message, error.stack);
    const errorResponse = twiml.VoiceResponse();
    errorResponse.say({ voice: 'alice' }, "A critical server error occurred during the call. Please try again later.");
    errorResponse.hangup();
    return new Response(errorResponse.toString(), {
      status: 500,
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

// NOTE: The handleStatusCallback function is removed for this ultra-simplified test.
// If Twilio calls /status, it will likely result in a 404 or an error from Supabase,
// which is fine for this specific test focused on the initial TwiML.
