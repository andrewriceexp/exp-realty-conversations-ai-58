
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import twilio from 'npm:twilio@3.84.1';

console.log(`Function "twilio-end-call" up and running!`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { callSid, userId } = await req.json();

    if (!callSid) {
      throw new Error("Call SID is required");
    }
    
    console.log(`Attempting to end call with SID: ${callSid}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseAdminKey);
    
    // Get user profile with Twilio credentials
    let profile = null;
    
    if (userId) {
      console.log(`Fetching profile for user ID: ${userId}`);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('twilio_account_sid, twilio_auth_token')
        .eq('id', userId)
        .maybeSingle();
        
      if (profileError || !profileData) {
        console.error("Error fetching user profile:", profileError);
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Error fetching user profile. User profile not found."
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      profile = profileData;
      
      // Verify Twilio credentials presence
      if (!profile.twilio_account_sid || !profile.twilio_auth_token) {
        console.error("Missing Twilio credentials for user");
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Twilio configuration incomplete. Please add your Twilio credentials."
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Try to find the user ID from call_logs table using callSid
      const { data: callLog, error: callLogError } = await supabase
        .from('call_logs')
        .select('user_id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();
        
      if (callLogError || !callLog || !callLog.user_id) {
        console.error("Could not find user ID from call logs:", callLogError);
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Could not determine which user's Twilio credentials to use"
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Now fetch the profile using the user ID from call logs
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('twilio_account_sid, twilio_auth_token')
        .eq('id', callLog.user_id)
        .maybeSingle();
        
      if (profileError || !profileData) {
        console.error("Error fetching user profile from call log user ID:", profileError);
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Error fetching user profile from call log reference"
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      profile = profileData;
    }
    
    // Initialize Twilio client with user credentials
    try {
      console.log(`Initializing Twilio client with account SID: ${profile.twilio_account_sid.substring(0, 8)}...`);
      const twilioClient = twilio(profile.twilio_account_sid, profile.twilio_auth_token);
      
      // Request call cancellation from Twilio API
      console.log(`Requesting call termination for SID: ${callSid}`);
      await twilioClient.calls(callSid).update({ status: 'completed' });
      
      console.log(`Successfully requested call termination`);
      
      // Update call log if needed
      try {
        const { data: callLog, error: callLogError } = await supabase
          .from('call_logs')
          .select('id, call_status, ended_at')
          .eq('twilio_call_sid', callSid)
          .maybeSingle();
          
        if (!callLogError && callLog && !callLog.ended_at) {
          console.log(`Updating call log ${callLog.id} to completed status`);
          await supabase
            .from('call_logs')
            .update({ 
              call_status: 'completed',
              ended_at: new Date().toISOString()
            })
            .eq('twilio_call_sid', callSid);
        }
      } catch (updateError) {
        console.error("Error updating call log status:", updateError);
        // Continue anyway - this is not critical
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Call termination requested successfully"
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (twilioError) {
      console.error("Error terminating call with Twilio:", twilioError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: twilioError.message || "Error terminating call with Twilio",
        error_code: twilioError.code
      }), {
        status: 200, // Return 200 to prevent client errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error("Unexpected error in twilio-end-call:", error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || "An unexpected error occurred",
    }), {
      status: 200, // Return 200 to prevent client errors
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
