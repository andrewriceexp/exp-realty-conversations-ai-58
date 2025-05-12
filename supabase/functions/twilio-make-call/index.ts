// Updated: 2025-05-12 - Changed Twilio params to PascalCase. Includes formatting, validation, logging.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Required for btoa polyfill in older Deno versions if needed
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define Twilio SDK client wrapper using fetch
const twilioClient = (accountSid: string, authToken: string) => {
  const client = {
    calls: {
      create: async (params: Record<string, any>) => {
        // NOTE: This wrapper passes keys exactly as received in `params` to the formData.
        // The main logic below now creates `params` with PascalCase keys.
        console.log("DEBUG [twilioClient]: Creating call with params:", JSON.stringify(params));

        try {
          // Validate required parameters first (using PascalCase now)
          if (!params.To || params.To === '') {
            throw new Error("[twilioClient] Missing required 'To' parameter for Twilio call");
          }
          if (!params.From || params.From === '') {
            throw new Error("[twilioClient] Missing required 'From' parameter for Twilio call");
          }
          if (!params.Url && !params.Twiml) { // Need either Url or Twiml
             throw new Error("[twilioClient] Missing required 'Url' or 'Twiml' parameter for Twilio call");
          }

          // Convert parameters to form data format expected by Twilio
          const formData = new URLSearchParams();

          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
              // Send keys AS-IS (expecting PascalCase from main logic)
              if (Array.isArray(value)) {
                for (const item of value) {
                  formData.append(key, item.toString());
                }
              } else {
                 const finalValue = typeof value === 'boolean' ? value.toString() : value;
                 formData.append(key, finalValue.toString());
              }
            }
          }

          console.log("DEBUG [twilioClient]: Sending form data to Twilio:", formData.toString());

          // Check using PascalCase 'To'
          console.log("!!! IMMEDIATELY BEFORE TWILIO API CALL - Form data contains 'To':",
            formData.has('To'), // Check PascalCase
            "Value:", formData.get('To')); // Get PascalCase

          // Make the actual API call to Twilio
          const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          });

          const responseText = await response.text();
          console.log(`DEBUG [twilioClient]: Twilio API Response Status: ${response.status}`);

          if (!response.ok) {
            console.error(`ERROR [twilioClient]: Twilio API Error Response Text: ${responseText}`);
            let errorDetails = responseText;
            try {
                const parsedError = JSON.parse(responseText);
                errorDetails = `Code ${parsedError.code}: ${parsedError.message} (More info: ${parsedError.more_info})`;
            } catch (e) { /* Ignore parsing error, use raw text */ }
            throw new Error(`Twilio API Error: ${response.status} - ${errorDetails}`);
          }

          // Parse successful response
          try {
            const responseData = JSON.parse(responseText);
            console.log("DEBUG [twilioClient]: Successfully initiated call. SID:", responseData.sid);
            return responseData;
          } catch (parseError) {
            console.error("ERROR [twilioClient]: Error parsing successful Twilio response:", parseError);
            console.log("DEBUG [twilioClient]: Raw success response:", responseText);
            throw new Error("Invalid success response format from Twilio API");
          }
        } catch (error) {
          console.error("ERROR [twilioClient]: Error within twilioClient:", error);
          throw error;
        }
      }
    }
  };

  return client;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("INFO: Received twilio-make-call request");

  let userId: string | null = null;
  let prospectId: string | null = null;
  // Declare these here so they are accessible in the twilioError catch block
  let formattedPhoneNumber: string | null = null;
  let twilioPhoneNumber: string | null = null;
  let webhookWithParams: string | null = null;

  try {
    // Get request payload
    const requestBody = await req.json();
    prospectId = requestBody.prospectId;
    const agentConfigId = requestBody.agentConfigId;
    userId = requestBody.userId;

    console.log("INFO: Request params:", { prospectId, agentConfigId, userId });
    console.log("DEBUG: Full request body:", JSON.stringify(requestBody, null, 2));

    if (!prospectId || !agentConfigId || !userId) {
        console.error("ERROR: Missing required parameters in request body.");
        return new Response( JSON.stringify({ error: 'Missing required parameters (prospectId, agentConfigId, or userId)', success: false, code: 'MISSING_PARAMETERS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
        console.error("ERROR: Supabase environment variables are not set.");
        throw new Error("Server configuration error: Supabase environment variables missing.");
    }
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
    console.log("INFO: Initialized Supabase clients");

    // Fetch profile (Twilio credentials)
    let profileData: any = null;
    let profileError: any = null;
    console.log("INFO: Attempting to fetch profile for user ID:", userId);
    try { /* ... (Profile fetch logic remains the same) ... */
        const { data, error } = await supabaseClient.from('profiles').select('twilio_account_sid, twilio_auth_token, twilio_phone_number').eq('id', userId).maybeSingle();
        if (error) { console.warn("WARN: Regular client profile fetch error (might be RLS):", error.message); profileError = error; }
        else if (data) { console.log("INFO: Profile found with regular client"); profileData = data; }
        else { console.log("INFO: No profile found with regular client, trying admin."); }
    } catch (err) { console.error("ERROR: Exception during regular profile fetch:", err); profileError = err;}
    if (!profileData) {
        try {
            const { data, error } = await supabaseAdmin.from('profiles').select('twilio_account_sid, twilio_auth_token, twilio_phone_number').eq('id', userId).maybeSingle();
            if (error) { console.error("ERROR: Admin client profile fetch error:", error); profileError = error; }
            else if (data) { console.log("INFO: Profile found with admin client"); profileData = data; }
            else { console.log("ERROR: No profile found for user with admin client either."); profileError = new Error("Profile record not found");}
        } catch (err) { console.error("ERROR: Exception during admin profile fetch:", err); profileError = err; }
    }
    if (!profileData) {
        console.error(`ERROR: Profile not found for user ID: ${userId}. Last error: ${profileError?.message}`);
        return new Response( JSON.stringify({ error: 'Profile setup incomplete or database error. Please visit your profile settings and verify your Twilio credentials.', success: false, code: 'PROFILE_NOT_FOUND', details: profileError ? String(profileError) : undefined }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }
    console.log("INFO: Profile fetched. Checking Twilio credentials.");
    if (!profileData.twilio_account_sid || !profileData.twilio_auth_token || !profileData.twilio_phone_number) {
        console.error("ERROR: Twilio configuration incomplete in profile.");
        return new Response( JSON.stringify({ error: 'Twilio configuration is incomplete. Please update your profile with your Twilio Account SID, Auth Token, and Phone Number.', success: false, code: 'TWILIO_CONFIG_INCOMPLETE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }
     // Assign twilioPhoneNumber here now that profileData is confirmed
    twilioPhoneNumber = profileData.twilio_phone_number;

    // Fetch prospect details
    let prospectData: any = null;
    let prospectError: any = null;
    console.log("INFO: Attempting to fetch prospect for ID:", prospectId);
    try { /* ... (Prospect fetch logic remains the same) ... */
        const { data, error } = await supabaseClient.from('prospects').select('phone_number, first_name, last_name, property_address').eq('id', prospectId).maybeSingle();
        if (error) { console.warn("WARN: Regular client prospect fetch error (might be RLS):", error.message); prospectError = error; }
        else if (data) { console.log("INFO: Prospect found with regular client"); prospectData = data; }
        else { console.log("INFO: No prospect found with regular client, trying admin."); }
    } catch (err) { console.error("ERROR: Exception during regular prospect fetch:", err); prospectError = err;}
    if (!prospectData) {
        try {
            const { data, error } = await supabaseAdmin.from('prospects').select('phone_number, first_name, last_name, property_address').eq('id', prospectId).maybeSingle();
             if (error) { console.error("ERROR: Admin client prospect fetch error:", error); prospectError = error; }
             else if (data) { console.log("INFO: Prospect found with admin client"); prospectData = data; }
             else { console.log("ERROR: No prospect found for ID with admin client either."); prospectError = new Error("Prospect record not found"); }
        } catch (err) { console.error("ERROR: Exception during admin prospect fetch:", err); prospectError = err; }
    }
    if (!prospectData) {
        console.error(`ERROR: Prospect not found for ID: ${prospectId}. Last error: ${prospectError?.message}`);
        return new Response( JSON.stringify({ error: `Prospect not found. The prospect with ID ${prospectId} does not exist or you may lack permission to view it.`, success: false, code: 'PROSPECT_NOT_FOUND' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }
    if (!prospectData.phone_number) {
        console.error(`ERROR: Prospect ${prospectId} has no phone number.`);
        return new Response( JSON.stringify({ error: 'Prospect has no phone number. Please update the prospect with a valid phone number.', success: false, code: 'MISSING_PHONE_NUMBER' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }
    console.log("INFO: Prospect fetched with phone_number:", prospectData.phone_number);

    // --- Start of Call Preparation Logic ---

    let statusWebhook: string | null = null; // Declare here for scope

    // --- 1. Robust Phone Number Formatting ---
    const rawPhoneNumber = prospectData.phone_number;
    console.log(`DEBUG: Starting formatting for raw phone: "${rawPhoneNumber}" (Type: ${typeof rawPhoneNumber})`);
    if (rawPhoneNumber && typeof rawPhoneNumber === 'string') { /* ... (Formatting logic remains the same) ... */
        let tempFormatted = rawPhoneNumber.trim();
        console.log(`DEBUG: After trim: "${tempFormatted}"`);
        tempFormatted = tempFormatted.replace(/\D/g, '');
        console.log(`DEBUG: After removing non-numeric: "${tempFormatted}"`);
        if (tempFormatted.length === 10) {
            tempFormatted = '1' + tempFormatted;
            console.log(`DEBUG: After adding '1': "${tempFormatted}"`);
        } else if (tempFormatted.length === 11 && tempFormatted.startsWith('1')) {
             console.log(`DEBUG: Number already has '1' prefix: "${tempFormatted}"`);
        } else if (tempFormatted.length > 11) {
             console.log(`DEBUG: Number is longer than 11 digits, assuming existing format: "${tempFormatted}"`);
        } else {
             console.warn(`WARN: Number too short after cleaning: "${tempFormatted}". Raw was: "${rawPhoneNumber}"`);
        }
        if (tempFormatted.length > 0 && !tempFormatted.startsWith('+')) {
            tempFormatted = '+' + tempFormatted;
            console.log(`DEBUG: After adding '+': "${tempFormatted}"`);
        }
        if (tempFormatted.startsWith('+') && tempFormatted.length >= 11) {
             formattedPhoneNumber = tempFormatted; // Assign to higher scoped variable
             console.log(`DEBUG: Final formatted number: "${formattedPhoneNumber}"`);
        } else {
             console.warn(`WARN: Phone number formatting resulted in invalid or short E.164 format: "${tempFormatted}". Raw was: "${rawPhoneNumber}"`);
             formattedPhoneNumber = null;
        }
    } else {
        console.error(`ERROR: Raw phone number from prospectData is invalid or not a string: "${rawPhoneNumber}"`);
        formattedPhoneNumber = null;
    }

    // --- 2. Construct Webhook URLs ---
    const baseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectRef = baseUrl.split('https://')[1]?.split('.')[0] || '';
    const webhookBaseUrl = `https://${projectRef}.functions.supabase.co/twilio-call-webhook`;
    webhookWithParams = `${webhookBaseUrl}?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}`; // Assign to higher scoped variable
    statusWebhook = `${webhookBaseUrl}/status`; // Assign to higher scoped variable
    console.log("INFO: Webhook URL:", webhookWithParams);
    console.log("INFO: Status webhook URL:", statusWebhook);
    console.log("INFO: From number:", twilioPhoneNumber);

    // --- 3. Pre-Call Validation ---
    if (!formattedPhoneNumber) {
        const errorMsg = `Invalid 'To' phone number after formatting. Raw value was: "${rawPhoneNumber}". Cannot place call.`;
        console.error("PRE-CALL VALIDATION FAILED:", errorMsg);
        return new Response( JSON.stringify({ error: errorMsg, success: false, code: 'INVALID_PHONE_FORMAT' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }
    if (!twilioPhoneNumber) {
        const errorMsg = "Invalid 'From' phone number. Check profile configuration.";
        console.error("PRE-CALL VALIDATION FAILED:", errorMsg);
        return new Response( JSON.stringify({ error: errorMsg, success: false, code: 'INVALID_FROM_NUMBER' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }
     if (!webhookWithParams || !statusWebhook) {
        const errorMsg = "Failed to construct required webhook URLs.";
        console.error("PRE-CALL VALIDATION FAILED:", errorMsg);
        return new Response( JSON.stringify({ error: errorMsg, success: false, code: 'WEBHOOK_URL_ERROR' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }

    // --- 4. Define Call Parameters (Using PascalCase Keys) ---
    const callParams = {
        Url: webhookWithParams,         // PascalCase
        To: formattedPhoneNumber,       // PascalCase
        From: twilioPhoneNumber,       // PascalCase
        StatusCallback: statusWebhook,  // PascalCase
        StatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'], // PascalCase Key
        StatusCallbackMethod: 'POST',  // PascalCase
        Record: true,                  // PascalCase
    };

    console.log("INFO: Final Twilio call parameters prepared:", JSON.stringify(callParams, null, 2));

    // Initialize Twilio client
    const twilioAccountSid = profileData.twilio_account_sid;
    const twilioAuthToken = profileData.twilio_auth_token;
    const twilio = twilioClient(twilioAccountSid, twilioAuthToken);

    // --- Start Twilio Call Attempt ---
    try {
        // Log right before the actual API call attempt
        console.log("!!! CHECK PARAMS BEFORE twilio.calls.create:", JSON.stringify({
            To_value: callParams.To,         // Check PascalCase
            From_value: callParams.From,     // Check PascalCase
            Url_value: callParams.Url,       // Check PascalCase
        }, null, 2));

        // Make the API call using the custom client
        const call = await twilio.calls.create(callParams);

        console.log("INFO: Twilio call initiated successfully. SID:", call.sid);

        // Create call log
        console.log("INFO: Creating call log using admin client");
        const { data: callLogData, error: callLogError } = await supabaseAdmin.from('call_logs').insert({
            prospect_id: prospectId, user_id: userId, agent_config_id: agentConfigId,
            call_status: call.status || 'Initiated', twilio_call_sid: call.sid, started_at: new Date().toISOString()
        }).select().single();

        if (callLogError) {
            console.error("ERROR: Failed to create call log:", callLogError);
            return new Response( JSON.stringify({ success: true, message: 'Call initiated successfully, but failed to create call log.', callSid: call.sid, error: `Failed to create call log: ${callLogError.message}`, code: 'CALL_LOG_ERROR' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
        }
        console.log("INFO: Call log created successfully:", callLogData);

        // Update prospect status
        console.log("INFO: Updating prospect status to 'Calling' using admin client");
        const { error: updateError } = await supabaseAdmin.from('prospects').update({ status: 'Calling', last_call_attempted: new Date().toISOString() }).eq('id', prospectId);
        if (updateError) { console.error("ERROR: Failed to update prospect status:", updateError); }

        // Return final success response
        return new Response( JSON.stringify({ success: true, message: 'Call initiated successfully', callSid: call.sid, callLogId: callLogData.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );

    } catch (twilioError) {
        // Catches errors specifically from twilio.calls.create()
        console.error('ERROR: Twilio call failed:', twilioError.message || twilioError);
        // Log the attempted parameters using PascalCase keys
        console.error('!!! FAILED CALL PARAMS (in twilioError catch):', JSON.stringify({
            To: formattedPhoneNumber,   // PascalCase
            From: twilioPhoneNumber, // PascalCase
            Url: webhookWithParams   // PascalCase
        }, null, 2));
        let twilioCode = 'UNKNOWN_TWILIO_ERROR';
        if (twilioError.message && typeof twilioError.message === 'string') {
            const match = twilioError.message.match(/Code (\d+):/);
            if (match && match[1]) { twilioCode = match[1]; }
        }
        return new Response( JSON.stringify({ error: `Twilio error: ${twilioError.message}`, success: false, code: 'TWILIO_API_ERROR', twilio_code: twilioCode }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
    }

  } catch (error) {
    // Catches errors from the main function logic
    console.error('FATAL ERROR in twilio-make-call function:', error.message || error);
    console.error('Context:', { userId, prospectId }); // Log context
    return new Response( JSON.stringify({ error: error.message || 'An unknown server error occurred', success: false, code: error.code || 'UNKNOWN_ERROR' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } );
  }
});