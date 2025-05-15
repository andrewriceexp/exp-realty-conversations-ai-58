import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import twilio from 'npm:twilio@3.84.1';

console.log(`Function "twilio-make-call" up and running!`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const requestBody = await req.json();
    const { 
      prospectId, 
      agent_config_id, 
      user_id, 
      prospect_id, // Handle both camelCase and snake_case for backward compatibility
      agent_config_id: agentConfigId, // Handle both formats
      bypassValidation = false, 
      bypass_validation = false, // Handle both formats
      debugMode = false, 
      debug_mode = false, // Handle both formats
      voiceId, 
      voice_id 
    } = requestBody;

    // Use whichever format is provided
    const finalProspectId = prospectId || prospect_id;
    const finalAgentConfigId = agent_config_id || agentConfigId;
    const finalBypassValidation = bypassValidation || bypass_validation || false;
    const finalDebugMode = debugMode || debug_mode || false;
    const finalVoiceId = voiceId || voice_id;
    const finalUserId = user_id; // This is critical - ensure it exists

    // Log incoming request with all parameters
    console.log(`Request received:`, {
      prospectId: finalProspectId,
      agentConfigId: finalAgentConfigId,
      userId: finalUserId,
      bypassValidation: finalBypassValidation,
      debugMode: finalDebugMode,
      voiceId: finalVoiceId ? `${finalVoiceId.slice(0, 8)}...` : 'none'
    });

    // Validate required parameters
    if (!finalUserId) {
      console.error("Missing user ID in request");
      return new Response(JSON.stringify({
        success: false,
        message: "Missing user ID",
        code: "MISSING_USER_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!finalProspectId) {
      console.error("Missing prospect ID in request");
      return new Response(JSON.stringify({
        success: false,
        message: "Missing prospect ID",
        code: "MISSING_PROSPECT_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!finalAgentConfigId) {
      console.error("Missing agent config ID in request");
      return new Response(JSON.stringify({
        success: false,
        message: "Missing agent configuration ID",
        code: "MISSING_AGENT_CONFIG_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey || !supabaseAdminKey) {
      console.error("Missing Supabase configuration");
      return new Response(JSON.stringify({
        success: false,
        message: "Server configuration error",
        code: "SERVER_CONFIG_ERROR"
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Initialize with regular anon key first
    const supabase = createClient(supabaseUrl, supabaseKey);
    // And another client with admin privileges for certain operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

    // Log incoming request data
    console.log(`Initiating call with prospect ID: ${finalProspectId}, agent config ID: ${finalAgentConfigId}, user ID: ${finalUserId}`);
    console.log(`bypassValidation: ${finalBypassValidation}, debugMode: ${finalDebugMode}, voiceId: ${finalVoiceId ? `${finalVoiceId.slice(0, 8)}...` : 'none'}`);

    // Step 1: Get user profile with Twilio credentials
    // First try with regular client
    let profile = null;
    let profileError = null;
    
    // Try fetching the profile with the anon key first (respecting RLS)
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', finalUserId)
      .maybeSingle();
    
    if (profileErr || !profileData) {
      console.log("Regular client couldn't fetch profile, trying with admin client");
      
      // If that fails, try with the admin key (bypassing RLS)
      const { data: adminProfileData, error: adminProfileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', finalUserId)
        .maybeSingle();
        
      if (adminProfileError || !adminProfileData) {
        // If both attempts fail, return an error
        console.error("Error fetching user profile with both clients:", adminProfileError || "No profile found");
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Error fetching user profile. Please complete your profile setup first.",
          code: "PROFILE_NOT_FOUND"
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Use the profile fetched with admin privileges
      profile = adminProfileData;
    } else {
      // Use the profile fetched with regular privileges
      profile = profileData;
    }
    
    console.log(`Successfully fetched profile for user: ${profile.email || finalUserId}`);
    
    // Ensure Twilio credentials are present
    if (!profile.twilio_account_sid || !profile.twilio_auth_token || !profile.twilio_phone_number) {
      console.error("Missing Twilio credentials");
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Twilio configuration incomplete. Please add your Twilio credentials in the profile setup.",
        code: "TWILIO_CONFIG_INCOMPLETE"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Get prospect data - use admin client to ensure we can access it
    const { data: prospect, error: prospectError } = await supabaseAdmin
      .from('prospects')
      .select('*')
      .eq('id', finalProspectId)
      .single();
      
    if (prospectError || !prospect) {
      console.error("Error fetching prospect:", prospectError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Prospect not found",
        code: "PROSPECT_NOT_FOUND"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Step 3: Get agent configuration - use admin client
    const { data: agentConfig, error: agentConfigError } = await supabaseAdmin
      .from('agent_configs')
      .select('*')
      .eq('id', finalAgentConfigId)
      .single();
      
    if (agentConfigError || !agentConfig) {
      console.error("Error fetching agent configuration:", agentConfigError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Agent configuration not found",
        code: "AGENT_CONFIG_NOT_FOUND"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Create a new call log entry - use admin client
    const { data: callLog, error: callLogError } = await supabaseAdmin
      .from('call_logs')
      .insert([{
        user_id: finalUserId,
        prospect_id: finalProspectId,
        agent_config_id: finalAgentConfigId,
        status: 'Initiating',
        notes: `Call initiated with agent: ${agentConfig.config_name}`,
      }])
      .select();
      
    if (callLogError) {
      console.error("Error creating call log:", callLogError);
      // Don't return error - proceed with call attempt even if logging fails
    }
    
    // Log the call log creation
    console.log(`Call log created with ID: ${callLog ? callLog[0].id : 'unknown'}`);

    // Initialize Twilio client with user credentials
    const twilioClient = twilio(profile.twilio_account_sid, profile.twilio_auth_token);
    
    // Set up the webhook URL for the call
    // We need to use the hostname (server) where the edge functions are running
    const edgeFunctionHost = req.headers.get('host') || '';
    let twimlUrl = `https://${edgeFunctionHost}/twilio-call-webhook`;
    
    // Add parameters to the URL
    const urlParams = new URLSearchParams();
    if (agentConfig.elevenlabs_agent_id) {
      urlParams.append('agent_id', agentConfig.elevenlabs_agent_id);
    } else {
      // Fallback to default agent ID if not specified in agent config
      urlParams.append('agent_id', '6Optf6WRTzp3rEyj2aiL');
    }
    
    if (finalVoiceId) {
      urlParams.append('voice_id', finalVoiceId);
    }
    
    if (finalDebugMode) {
      urlParams.append('debug', 'true');
    }
    
    // Add call log ID for tracking
    if (callLog && callLog[0] && callLog[0].id) {
      urlParams.append('call_log_id', callLog[0].id);
    }
    
    // Add user ID for authentication
    urlParams.append('user_id', finalUserId);
    
    // Append parameters to URL
    const paramString = urlParams.toString();
    if (paramString) {
      twimlUrl += `?${paramString}`;
    }
    
    // Log the TwiML URL we're using
    console.log(`Using TwiML URL: ${twimlUrl}`);
    
    // Make the call using Twilio
    console.log(`Initiating Twilio call to ${prospect.phone_number} from ${profile.twilio_phone_number}`);
    
    try {
      const call = await twilioClient.calls.create({
        url: twimlUrl,
        to: prospect.phone_number,
        from: profile.twilio_phone_number,
      });
      
      console.log(`Call initiated successfully with SID: ${call.sid}`);
      
      // Update the call log with call SID
      if (callLog && callLog[0]) {
        const { error: updateError } = await supabaseAdmin
          .from('call_logs')
          .update({
            twilio_call_sid: call.sid,
            status: 'Initiated',
          })
          .eq('id', callLog[0].id);
          
        if (updateError) {
          console.error("Error updating call log with SID:", updateError);
        }
      }
      
      // Update prospect status to 'In Progress'
      const { error: prospectUpdateError } = await supabaseAdmin
        .from('prospects')
        .update({
          status: 'In Progress',
          last_call_attempted: new Date().toISOString(),
        })
        .eq('id', finalProspectId);
        
      if (prospectUpdateError) {
        console.error("Error updating prospect status:", prospectUpdateError);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Call initiated successfully",
        callSid: call.sid,
        callLogId: callLog ? callLog[0].id : null
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (twilioError) {
      console.error("Twilio call creation error:", twilioError);
      
      // Update the call log with error
      if (callLog && callLog[0]) {
        await supabaseAdmin
          .from('call_logs')
          .update({
            status: 'Failed',
            notes: `Error: ${twilioError.message || 'Unknown Twilio error'}`,
          })
          .eq('id', callLog[0].id);
      }
      
      // Determine error code for frontend handling
      let errorCode = "CALL_ERROR";
      let errorMessage = twilioError.message || "Failed to initiate call";
      
      if (twilioError.message?.includes('trial account') || 
          twilioError.code === 21215) {
        errorCode = "TWILIO_TRIAL_ACCOUNT";
        errorMessage = "Your Twilio trial account can only make calls to verified numbers. Try using Development Mode.";
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        message: errorMessage,
        error: twilioError.message,
        code: errorCode
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error("Unexpected error in twilio-make-call:", error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || "An unexpected error occurred",
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
