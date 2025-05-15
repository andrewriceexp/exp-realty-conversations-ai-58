
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
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Error parsing request body:", error.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Invalid request format. Expected JSON body.",
          error: error.message
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Validate required parameters
    const callSid = body.call_sid;
    
    if (!callSid) {
      console.error("Call SID is required but was not provided");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Call SID is required",
          error: "MISSING_PARAMETER"
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log(`Checking status for call SID: ${callSid}`);
    
    // Initialize Supabase client (for future use if we need to log/store results)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase credentials in environment");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Server configuration error", 
          error: "SERVER_CONFIG_ERROR"
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Get user Twilio credentials if userId is provided
    const userId = body.user_id;
    let twilioAccountSid = null;
    let twilioAuthToken = null;
    
    if (userId) {
      // Initialize admin client to access profiles
      const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!supabaseAdminKey) {
        console.error("Missing Supabase admin key");
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Server configuration error", 
            error: "SERVER_CONFIG_ERROR"
          }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('twilio_account_sid, twilio_auth_token')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error("Error fetching user profile:", profileError);
      } else if (profile) {
        twilioAccountSid = profile.twilio_account_sid;
        twilioAuthToken = profile.twilio_auth_token;
      }
    }
    
    // Fall back to environment variables if no user credentials
    if (!twilioAccountSid || !twilioAuthToken) {
      twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      
      if (!twilioAccountSid || !twilioAuthToken) {
        console.error("No Twilio credentials available");
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Twilio credentials not available", 
            error: "TWILIO_CREDS_UNAVAILABLE"
          }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    }
    
    // Initialize Twilio client
    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    
    try {
      // Fetch call status from Twilio
      const call = await twilioClient.calls(callSid).fetch();
      
      // Create the response
      return new Response(
        JSON.stringify({
          success: true,
          status: call.status,
          duration: call.duration,
          timestamp: new Date().toISOString(),
          direction: call.direction,
          from: call.from,
          to: call.to,
          price: call.price
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    } catch (twilioError) {
      console.error("Twilio API error:", twilioError);
      
      // Determine if this is an authentication error or other error
      const errorMessage = twilioError.message || "Unknown Twilio error";
      const statusCode = twilioError.status || 400;
      const errorCode = twilioError.code || "TWILIO_ERROR";
      
      return new Response(
        JSON.stringify({
          success: false,
          message: errorMessage,
          code: errorCode
        }),
        {
          status: statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error("Unexpected error in twilio-call-status:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "An unexpected error occurred",
        error: "UNEXPECTED_ERROR"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
