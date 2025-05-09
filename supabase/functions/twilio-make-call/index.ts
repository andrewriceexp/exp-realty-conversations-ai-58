
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define Twilio SDK client
const twilioClient = (accountSid: string, authToken: string) => {
  const client = {
    calls: {
      create: async (params: any) => {
        console.log("Creating call with params:", JSON.stringify(params));
        
        try {
          const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params).toString(),
          });
          
          const responseText = await response.text();
          console.log(`Twilio API Response Status: ${response.status}`);
          
          if (!response.ok) {
            console.error(`Twilio API Error: ${responseText}`);
            throw new Error(`Twilio API Error: ${response.status} - ${responseText}`);
          }
          
          try {
            return JSON.parse(responseText);
          } catch (parseError) {
            console.error("Error parsing Twilio response:", parseError);
            console.log("Raw response:", responseText);
            throw new Error("Invalid response format from Twilio API");
          }
        } catch (error) {
          console.error("Error making Twilio API call:", error);
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

  console.log("Received twilio-make-call request");

  try {
    // Get request payload
    const { prospectId, agentConfigId, userId } = await req.json();
    
    console.log("Request params:", { prospectId, agentConfigId, userId });
    
    if (!prospectId || !agentConfigId || !userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters',
          success: false,
          code: 'MISSING_PARAMETERS'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Initialize Supabase client with anon key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false }
      }
    );
    
    // Initialize Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false }
      }
    );

    console.log("Initialized Supabase clients");
    
    // Try to get profile - first with regular client, then with admin if needed
    let profileData = null;
    let profileError = null;
    
    // First attempt - try with regular client
    try {
      console.log("Attempting to fetch profile with regular client for ID:", userId);
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
        .eq('id', userId)
        .maybeSingle();
        
      if (error) {
        console.error("Regular client profile fetch error:", error);
        profileError = error;
      } else if (data) {
        console.log("Profile found with regular client");
        profileData = data;
      } else {
        console.log("No profile found with regular client, will try admin client");
      }
    } catch (err) {
      console.error("Error during regular profile fetch:", err);
    }
    
    // Second attempt - if first failed, try with admin client
    if (!profileData) {
      try {
        console.log("Attempting to fetch profile with admin client for ID:", userId);
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
          .eq('id', userId)
          .maybeSingle();
          
        if (error) {
          console.error("Admin client profile fetch error:", error);
          profileError = error;
        } else if (data) {
          console.log("Profile found with admin client");
          profileData = data;
        } else {
          console.log("No profile found with admin client either");
          
          // Debug query to check if the profiles table has any data at all
          const { data: debugData, error: debugError } = await supabaseAdmin
            .from('profiles')
            .select('count')
            .limit(1);
            
          if (debugError) {
            console.error("Debug query error:", debugError);
          } else {
            console.log("Debug query results:", debugData);
          }
        }
      } catch (err) {
        console.error("Error during admin profile fetch:", err);
        profileError = err;
      }
    }
    
    // If we still don't have profile data, return a useful error
    if (!profileData) {
      console.error("Profile not found for user ID:", userId, "Error:", profileError);
      return new Response(
        JSON.stringify({ 
          error: 'Profile setup incomplete or database error. Please visit your profile settings and verify your Twilio credentials.',
          success: false,
          code: 'PROFILE_NOT_FOUND',
          details: profileError ? String(profileError) : undefined
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log("Profile fetched, checking Twilio credentials");
    
    if (!profileData.twilio_account_sid || !profileData.twilio_auth_token || !profileData.twilio_phone_number) {
      return new Response(
        JSON.stringify({ 
          error: 'Twilio configuration is incomplete. Please update your profile with your Twilio Account SID, Auth Token, and Phone Number.',
          success: false,
          code: 'TWILIO_CONFIG_INCOMPLETE'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get the prospect details using first the regular client, then admin client if needed
    let prospectData = null;
    let prospectError = null;
    
    // First attempt - try with regular client
    try {
      console.log("Attempting to fetch prospect with regular client for ID:", prospectId);
      const { data, error } = await supabaseClient
        .from('prospects')
        .select('phone_number, first_name, last_name, property_address')
        .eq('id', prospectId)
        .maybeSingle();
        
      if (error) {
        console.error("Regular client prospect fetch error:", error);
        prospectError = error;
      } else if (data) {
        console.log("Prospect found with regular client");
        prospectData = data;
      } else {
        console.log("No prospect found with regular client, will try admin client");
      }
    } catch (err) {
      console.error("Error during regular prospect fetch:", err);
    }
    
    // Second attempt - if first failed, try with admin client
    if (!prospectData) {
      try {
        console.log("Attempting to fetch prospect with admin client for ID:", prospectId);
        const { data, error } = await supabaseAdmin
          .from('prospects')
          .select('phone_number, first_name, last_name, property_address')
          .eq('id', prospectId)
          .maybeSingle();
          
        if (error) {
          console.error("Admin client prospect fetch error:", error);
          prospectError = error;
        } else if (data) {
          console.log("Prospect found with admin client");
          prospectData = data;
        } else {
          console.log("No prospect found with admin client either");
          
          // Debug query to check if the prospects table has any data at all and if it has this specific ID
          const { data: debugData, error: debugError } = await supabaseAdmin
            .from('prospects')
            .select('id')
            .limit(5);
            
          if (debugError) {
            console.error("Debug query error:", debugError);
          } else {
            console.log("Debug query sample IDs:", debugData);
            
            // Check if there are any prospects at all
            const { count, error: countError } = await supabaseAdmin
              .from('prospects')
              .select('*', { count: 'exact', head: true });
              
            console.log("Total prospect count:", count, "Error:", countError);
            
            // Check if this specific prospect exists in any form
            const { data: specificCheck, error: specificError } = await supabaseAdmin
              .from('prospects')
              .select('id')
              .filter('id', 'ilike', `%${prospectId.slice(0, 8)}%`)
              .limit(5);
              
            console.log("Similar ID check:", specificCheck, "Error:", specificError);
          }
        }
      } catch (err) {
        console.error("Error during admin prospect fetch:", err);
        prospectError = err;
      }
    }
    
    if (!prospectData) {
      console.error("No prospect found with ID:", prospectId);
      return new Response(
        JSON.stringify({ 
          error: `Prospect not found. The prospect with ID ${prospectId} does not exist or has been deleted.`,
          success: false,
          code: 'PROSPECT_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log("Prospect fetched, creating call log");
    
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
      console.error("Call log error:", callLogError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create call log: ${callLogError.message}`,
          success: false,
          code: 'CALL_LOG_ERROR'
        }),
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
    
    console.log("Call log created, preparing webhook URLs");
    
    // Calculate the absolute URL for the webhook
    const baseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectRef = baseUrl.split('https://')[1]?.split('.')[0] || '';
    const webhookUrl = `https://${projectRef}.functions.supabase.co/twilio-call-webhook`;
    
    // Add query parameters with context info
    const webhookWithParams = `${webhookUrl}?call_log_id=${callLogData.id}&prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}`;
    const statusWebhook = `${webhookUrl}/status?call_log_id=${callLogData.id}`;
    
    console.log("Webhook URL:", webhookWithParams);
    console.log("Status webhook URL:", statusWebhook);
    
    try {
      // Format the phone number to E.164 format if needed
      let formattedPhoneNumber = prospectData.phone_number;
      if (!formattedPhoneNumber.startsWith('+')) {
        formattedPhoneNumber = `+1${formattedPhoneNumber.replace(/\D/g, '')}`;
      }
      
      console.log(`Initiating Twilio call to ${formattedPhoneNumber} from ${twilioPhoneNumber}`);
      
      // Initiate the call via Twilio
      const call = await twilio.calls.create({
        url: webhookWithParams,
        to: formattedPhoneNumber,
        from: twilioPhoneNumber,
        statusCallback: statusWebhook,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: 'true',
      });
      
      console.log("Twilio call initiated successfully:", call.sid);
      
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
        JSON.stringify({ 
          error: `Twilio error: ${twilioError.message}`,
          success: false,
          code: 'TWILIO_API_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in twilio-make-call function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false,
        code: 'UNKNOWN_ERROR'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
