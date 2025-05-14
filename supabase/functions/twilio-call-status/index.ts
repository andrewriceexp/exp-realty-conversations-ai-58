
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import twilio from 'npm:twilio@3.84.1';

console.log(`Function "twilio-call-status" up and running!`);

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
    
    console.log(`Checking call status for SID: ${callSid}`);

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
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (profileError || !profileData) {
        console.error("Error fetching user profile:", profileError);
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Error fetching user profile. User profile not found."
        }), {
          status: 200, // Return 200 instead of error code to prevent client errors
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
          status: 200, // Return 200 instead of error code to prevent client errors
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn("No userId provided - will try to find profile from call_logs");
      // Try to find the profile from call_logs table using callSid
      const { data: callLog, error: callLogError } = await supabase
        .from('call_logs')
        .select('user_id')
        .eq('call_sid', callSid)
        .maybeSingle();
        
      if (callLogError || !callLog || !callLog.user_id) {
        console.error("Could not find user ID from call logs:", callLogError);
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Could not determine which user's Twilio credentials to use"
        }), {
          status: 200, // Return 200 instead of error code to prevent client errors
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Now fetch the profile using the user ID from call logs
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', callLog.user_id)
        .maybeSingle();
        
      if (profileError || !profileData) {
        console.error("Error fetching user profile from call log user ID:", profileError);
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Error fetching user profile from call log reference"
        }), {
          status: 200, // Return 200 instead of error code to prevent client errors
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      profile = profileData;
    }
    
    // Initialize Twilio client with user credentials
    try {
      console.log(`Initializing Twilio client with account SID: ${profile.twilio_account_sid.substring(0, 8)}...`);
      const twilioClient = twilio(profile.twilio_account_sid, profile.twilio_auth_token);
      
      // Call Twilio API to get call status
      console.log(`Fetching call status from Twilio for SID: ${callSid}`);
      const call = await twilioClient.calls(callSid).fetch();
      
      console.log(`Call status retrieved: ${call.status}`);
      
      // Update call log if needed
      try {
        const { data: callLog, error: callLogError } = await supabase
          .from('call_logs')
          .select('id, status')
          .eq('call_sid', callSid)
          .maybeSingle();
          
        if (!callLogError && callLog && callLog.status !== call.status) {
          console.log(`Updating call log ${callLog.id} status from ${callLog.status} to ${call.status}`);
          await supabase
            .from('call_logs')
            .update({ status: call.status })
            .eq('call_sid', callSid);
        }
      } catch (updateError) {
        console.error("Error updating call log status:", updateError);
        // Continue anyway - this is not critical
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        call_status: call.status,
        call_direction: call.direction,
        call_duration: call.duration,
        call_price: call.price,
        call_answered_by: call.answeredBy,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (twilioError) {
      console.error("Error fetching call status from Twilio:", twilioError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: twilioError.message || "Error fetching call status from Twilio",
        error_code: twilioError.code
      }), {
        status: 200, // Return 200 to prevent client errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error("Unexpected error in twilio-call-status:", error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || "An unexpected error occurred",
    }), {
      status: 200, // Return 200 to prevent client errors
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
