
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Twilio } from "https://esm.sh/twilio@4.20.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospectId, agentConfigId, userId, twilio_customer_id } = await req.json();
    
    console.log(`Twilio make call request: 
      prospectId: ${prospectId}
      agentConfigId: ${agentConfigId}
      userId: ${userId}
      twilio_customer_id: ${twilio_customer_id}
    `);

    if (!prospectId || !agentConfigId || !userId || !twilio_customer_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required parameters", 
          code: "MISSING_PARAMETERS" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client
    const supabaseClient = Deno.env.get('SUPABASE_URL') 
      ? (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_ANON_KEY') || '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
      : null;
    
    if (!supabaseClient) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to initialize Supabase client", 
          code: "SUPABASE_CLIENT_ERROR" 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Fetch user's Twilio configuration
    console.log(`Fetching Twilio configuration for user: ${userId}`);
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error(`Error fetching profile: ${profileError.message}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to retrieve user profile", 
          code: "PROFILE_NOT_FOUND" 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    if (!profileData.twilio_account_sid || !profileData.twilio_auth_token || !profileData.twilio_phone_number) {
      console.error(`Incomplete Twilio configuration for user: ${userId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Please complete your profile setup with Twilio credentials to make calls", 
          code: "TWILIO_CONFIG_INCOMPLETE" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Fetch agent configuration
    console.log(`Fetching agent configuration: ${agentConfigId}`);
    const { data: agentConfig, error: agentConfigError } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .single();
      
    if (agentConfigError) {
      console.error(`Error fetching agent config: ${agentConfigError.message}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to retrieve agent configuration", 
          code: "AGENT_CONFIG_ERROR" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Fetch the prospect's customer data from Twilio
    console.log(`Getting customer data from Twilio for customer ID: ${twilio_customer_id}`);
    
    // Initialize Twilio client
    const twilioClient = new Twilio(
      profileData.twilio_account_sid,
      profileData.twilio_auth_token
    );
    
    // Get service SID - we need to find which service to use
    const services = await twilioClient.sync.v1.services.list({ limit: 20 });
    const service = services.find(s => s.friendlyName === 'CustomerDataService');
    
    if (!service) {
      console.error('CustomerDataService not found for Twilio account');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Customer data service not configured in Twilio", 
          code: "TWILIO_SERVICE_NOT_FOUND" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Retrieve the customer document from Twilio
    let customerData;
    try {
      const document = await twilioClient.sync.v1
        .services(service.sid)
        .documents(`customer_${twilio_customer_id}`)
        .fetch();
      
      customerData = document.data;
      console.log('Retrieved customer data:', customerData);
    } catch (error) {
      console.error(`Error retrieving customer data from Twilio: ${error.message}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to retrieve customer data from Twilio", 
          code: "CUSTOMER_DATA_ERROR" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Validate the phone number
    if (!customerData.phone_number) {
      console.error('Missing phone number in customer data');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "The prospect doesn't have a valid phone number", 
          code: "MISSING_PHONE_NUMBER" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Format the phone number for Twilio
    const phoneNumber = customerData.phone_number.replace(/\D/g, '');
    const formattedPhoneNumber = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : phoneNumber.startsWith('1') 
        ? `+${phoneNumber}` 
        : `+1${phoneNumber}`;
    
    console.log(`Formatted phone number: ${formattedPhoneNumber}`);
    
    // Create a call log entry with initial status
    console.log('Creating call log entry');
    const { data: callLog, error: callLogError } = await supabaseClient
      .from('call_logs')
      .insert({
        prospect_id: prospectId,
        user_id: userId,
        agent_config_id: agentConfigId,
        twilio_call_sid: 'pending', // Will update this once we have the actual SID
        call_status: 'Initiated',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (callLogError) {
      console.error(`Error creating call log: ${callLogError.message}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to create call log", 
          code: "CALL_LOG_ERROR" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Make the call via Twilio
    console.log('Initiating Twilio call');
    try {
      const twilioCall = await twilioClient.calls.create({
        to: formattedPhoneNumber,
        from: profileData.twilio_phone_number,
        url: `https://uttebgyhijrdcjiczxrg.supabase.co/functions/v1/twilio-call-webhook?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLog.id}`,
        statusCallback: `https://uttebgyhijrdcjiczxrg.supabase.co/functions/v1/twilio-call-webhook?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLog.id}&status_callback=true`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true
      });
      
      console.log(`Call initiated successfully. Twilio Call SID: ${twilioCall.sid}`);
      
      // Update the call log with the Twilio Call SID
      const { error: updateError } = await supabaseClient
        .from('call_logs')
        .update({
          twilio_call_sid: twilioCall.sid
        })
        .eq('id', callLog.id);
        
      if (updateError) {
        console.error(`Error updating call log with SID: ${updateError.message}`);
        // We don't want to fail the whole request for this, just log it
      }
      
      // Update prospect status
      const { error: prospectUpdateError } = await supabaseClient
        .from('prospects')
        .update({
          status: 'Calling',
          last_call_attempted: new Date().toISOString()
        })
        .eq('id', prospectId);
        
      if (prospectUpdateError) {
        console.error(`Error updating prospect status: ${prospectUpdateError.message}`);
        // We don't want to fail the whole request for this, just log it
      }
      
      // Format name for response message
      const prospectName = [customerData.first_name, customerData.last_name]
        .filter(Boolean)
        .join(' ') || 'the prospect';
        
      return new Response(
        JSON.stringify({ 
          success: true, 
          callSid: twilioCall.sid,
          callLogId: callLog.id,
          message: `Now calling ${prospectName} at ${formattedPhoneNumber}`
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
      
    } catch (error) {
      console.error(`Twilio error: ${error.message}`);
      
      // Update the call log with the failure
      const { error: updateError } = await supabaseClient
        .from('call_logs')
        .update({
          call_status: 'Failed',
          ended_at: new Date().toISOString()
        })
        .eq('id', callLog.id);
        
      if (updateError) {
        console.error(`Error updating call log for failure: ${updateError.message}`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Twilio error: ${error.message}`, 
          code: "TWILIO_API_ERROR" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}`, 
        code: "UNEXPECTED_ERROR" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
