
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define Twilio SDK client
const twilioClient = (accountSid: string, authToken: string) => {
  const client = {
    calls: {
      create: async (params: any) => {
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(params).toString(),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(JSON.stringify(error));
        }
        
        return response.json();
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

  try {
    // Get request payload
    const { prospectId, agentConfigId, userId } = await req.json();
    
    if (!prospectId || !agentConfigId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    // Get the user's profile for Twilio credentials
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Failed to get user profile: ${profileError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!profileData.twilio_account_sid || !profileData.twilio_auth_token || !profileData.twilio_phone_number) {
      return new Response(
        JSON.stringify({ error: 'Twilio configuration is incomplete. Please update your profile.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get the prospect details
    const { data: prospectData, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('phone_number, first_name, last_name, property_address')
      .eq('id', prospectId)
      .single();
      
    if (prospectError) {
      return new Response(
        JSON.stringify({ error: `Failed to get prospect: ${prospectError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Create a call log entry before initiating the call
    const { data: callLogData, error: callLogError } = await supabaseClient
      .from('call_logs')
      .insert({
        prospect_id: prospectId,
        user_id: userId,
        agent_config_id: agentConfigId,
        call_status: 'Initiated',
        twilio_call_sid: 'pending', // Will be updated after Twilio response
        started_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (callLogError) {
      return new Response(
        JSON.stringify({ error: `Failed to create call log: ${callLogError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Create Twilio client
    const twilioAccountSid = profileData.twilio_account_sid;
    const twilioAuthToken = profileData.twilio_auth_token;
    const twilioPhoneNumber = profileData.twilio_phone_number;
    const twilio = twilioClient(twilioAccountSid, twilioAuthToken);
    
    // Calculate the absolute URL for the webhook
    const baseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectRef = baseUrl.split('https://')[1]?.split('.')[0] || '';
    const webhookUrl = `https://${projectRef}.functions.supabase.co/twilio-call-webhook`;
    
    // Add query parameters with context info
    const webhookWithParams = `${webhookUrl}?call_log_id=${callLogData.id}&prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}`;
    
    try {
      // Initiate the call via Twilio
      const call = await twilio.calls.create({
        url: webhookWithParams,
        to: prospectData.phone_number,
        from: twilioPhoneNumber,
        statusCallback: `${webhookUrl}/status?call_log_id=${callLogData.id}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: 'true',
      });
      
      // Update the call log with the Twilio SID
      await supabaseClient
        .from('call_logs')
        .update({
          twilio_call_sid: call.sid
        })
        .eq('id', callLogData.id);
      
      // Update prospect status to "Calling"
      await supabaseClient
        .from('prospects')
        .update({
          status: 'Calling',
          last_call_attempted: new Date().toISOString()
        })
        .eq('id', prospectId);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Call initiated successfully',
          callSid: call.sid,
          callLogId: callLogData.id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (twilioError) {
      console.error('Twilio error:', twilioError);
      
      // Update the call log to mark as failed
      await supabaseClient
        .from('call_logs')
        .update({
          call_status: 'Failed',
          ended_at: new Date().toISOString()
        })
        .eq('id', callLogData.id);
      
      return new Response(
        JSON.stringify({ error: `Twilio error: ${twilioError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in twilio-make-call function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
