
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import * as twilio from "https://esm.sh/twilio@4.20.0";

console.log("Function \"twilio-make-call\" up and running!");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const body = await req.json();
    const { prospectId, prospect_id, agent_config_id, user_id, bypass_validation, debug_mode, voice_id, use_webhook_proxy } = body;
    
    // Use either prospectId or prospect_id for backwards compatibility
    const finalProspectId = prospectId || prospect_id;
    
    console.log("Initiating call with prospect ID:", finalProspectId, "agent config ID:", agent_config_id, "user ID:", user_id);
    console.log("bypassValidation:", bypass_validation, "debugMode:", debug_mode, "voiceId:", voice_id?.substring(0, 10) + "...");
    
    if (!finalProspectId) {
      return new Response(
        JSON.stringify({ success: false, message: "Prospect ID is required", code: "MISSING_PROSPECT_ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!agent_config_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Agent configuration ID is required", code: "MISSING_AGENT_CONFIG_ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, message: "User ID is required", code: "MISSING_USER_ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create supabase client with user context
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing Supabase configuration", code: "MISSING_SUPABASE_CONFIG" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Try to get user profile
    const { data: userProfile, error: userProfileError } = await supabaseClient
      .from('profiles')
      .select('email, twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('id', user_id)
      .maybeSingle();
      
    if (userProfileError) {
      console.log("Regular client couldn't fetch profile, trying with admin client");
      
      // Use admin client as fallback
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseServiceKey) {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: adminUserProfile, error: adminUserProfileError } = await adminSupabase
          .from('profiles')
          .select('email, twilio_account_sid, twilio_auth_token, twilio_phone_number')
          .eq('id', user_id)
          .maybeSingle();
          
        if (adminUserProfileError || !adminUserProfile) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Failed to fetch user profile: ${adminUserProfileError?.message || "User not found"}`, 
              code: "PROFILE_NOT_FOUND" 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log(`Successfully fetched profile for user: ${adminUserProfile.email}`);
        userProfile = adminUserProfile;
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to fetch user profile: ${userProfileError.message}`, 
            code: "PROFILE_FETCH_ERROR" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // If we're not bypassing validation, check if Twilio credentials are set
    if (!bypass_validation) {
      if (!userProfile?.twilio_account_sid || !userProfile?.twilio_auth_token || !userProfile?.twilio_phone_number) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Twilio credentials are not configured. Please update your profile with Twilio credentials.",
            code: "TWILIO_CONFIG_INCOMPLETE"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Get the prospect's phone number
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('phone_number')
      .eq('id', finalProspectId)
      .single();
      
    if (prospectError || !prospect) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to fetch prospect: ${prospectError?.message || "Prospect not found"}`,
          code: "PROSPECT_NOT_FOUND"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!prospect.phone_number) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Prospect has no phone number",
          code: "MISSING_PHONE_NUMBER"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const prospectPhoneNumber = prospect.phone_number;
    const userTwilioPhoneNumber = userProfile?.twilio_phone_number;
    
    if (!userTwilioPhoneNumber && !bypass_validation) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Twilio phone number is not configured. Please update your profile with a Twilio phone number.",
          code: "MISSING_TWILIO_PHONE_NUMBER"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    try {
      // Create call log
      let callLogId = null;
      try {
        const callData = {
          user_id,
          prospect_id: finalProspectId,
          agent_config_id,
          status: 'Initiated',
          direction: 'outbound',
          metadata: {
            voice_id,
            debug_mode
          }
        };
        
        const { data: insertResult, error: insertError } = await supabaseClient
          .from('call_logs')
          .insert([callData])
          .select();
          
        if (insertError) {
          console.error("Error creating call log:", insertError);
        } else {
          callLogId = insertResult?.[0]?.id;
          console.log("Call log created with ID:", callLogId);
        }
      } catch (error) {
        // Non-blocking error
        console.error("Error creating call log:", error);
      }
      
      // Get configuration parameters
      const bypassValidation = bypass_validation || false;
      const debugMode = debug_mode || false;
      const voiceId = voice_id || null;
      // NEW: Check if we should use the webhook proxy (default to true for better compatibility)
      const useWebhookProxy = use_webhook_proxy !== false;
      
      // CRITICAL CHANGE: Use the correct URL format based on the proxy flag
      let twimlWebhookUrl;
      const supabaseProjectRef = Deno.env.get("SUPABASE_PROJECT_REF") || "uttebgyhijrdcjiczxrg";
      
      if (useWebhookProxy) {
        // Use the new proxy function URL that will add the required headers
        twimlWebhookUrl = `https://${supabaseProjectRef}.supabase.co/functions/v1/twilio-webhook-proxy`;
      } else {
        // Use the regular function URL (may not work with direct Twilio calls)
        twimlWebhookUrl = `https://${supabaseProjectRef}.supabase.co/functions/v1/twilio-call-webhook`;
      }
      
      // Add query parameters
      const params = new URLSearchParams();
      
      // Get agent ID from agent config
      if (agent_config_id) {
        const { data: agentConfig } = await supabaseClient
          .from('agent_configs')
          .select('elevenlabs_agent_id')
          .eq('id', agent_config_id)
          .maybeSingle();
          
        if (agentConfig?.elevenlabs_agent_id) {
          params.append("agent_id", agentConfig.elevenlabs_agent_id);
        }
      }
      
      // Use the explicitly provided agent ID if available (overrides config)
      if (body.agent_id) {
        params.append("agent_id", body.agent_id);
      }
      
      if (voiceId) {
        params.append("voice_id", voiceId);
      }
      
      if (user_id) {
        params.append("user_id", user_id);
      }
      
      if (debugMode) {
        params.append("debug", "true");
      }
      
      if (callLogId) {
        params.append("call_log_id", callLogId);
      }
      
      twimlWebhookUrl += `?${params.toString()}`;
      console.log(`Using TwiML URL: ${twimlWebhookUrl}`);
      
      // Initialize Twilio client
      const twilioClient = twilio(
        userProfile?.twilio_account_sid,
        userProfile?.twilio_auth_token
      );
      
      console.log(`Initiating Twilio call to ${prospectPhoneNumber} from ${userTwilioPhoneNumber}`);
      
      // Make the call
      const call = await twilioClient.calls.create({
        url: twimlWebhookUrl,
        to: prospectPhoneNumber,
        from: userTwilioPhoneNumber || "+18447936402" // Fallback for development
      });
      
      console.log("Call initiated successfully with SID:", call.sid);
      
      // Update call log with Twilio SID
      if (callLogId) {
        try {
          await supabaseClient
            .from('call_logs')
            .update({ twilio_call_sid: call.sid })
            .eq('id', callLogId);
        } catch (error) {
          // Non-blocking error
          console.error("Error updating call log with SID:", error);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Call initiated successfully",
          callSid: call.sid,
          callLogId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error initiating call:", error);
      
      // Check for trial account error
      const errorMessage = error.toString();
      if (errorMessage.includes("Trial account") || errorMessage.includes("trial accounts")) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Your Twilio trial account cannot make calls to unverified numbers. Please verify this number in your Twilio console or upgrade your Twilio account.",
            error: errorMessage,
            code: "TWILIO_TRIAL_ACCOUNT"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to initiate call: ${error.toString()}`,
          error: error.toString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error(`Error processing request: ${error}`);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Error processing request: ${error.toString()}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
