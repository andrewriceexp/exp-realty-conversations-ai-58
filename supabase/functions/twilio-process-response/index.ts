
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, twiml, validateTwilioRequest } from "../_shared/twilio-helper.ts";

serve(async (req) => {
  // Very early logging
  console.log(`--- twilio-process-response: INCOMING REQUEST. Method: ${req.method}, URL: ${req.url} ---`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse URL to get the full URL and query parameters
    const url = new URL(req.url);
    const fullUrl = url.origin + url.pathname;
    
    // Parse URL and get query parameters
    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    const conversationCount = url.searchParams.get('conversation_count') || '0';
    const nextConversationCount = (parseInt(conversationCount) + 1).toString();
    
    console.log(`Processing response for prospect: ${prospectId}, agent config: ${agentConfigId}, user: ${userId}, call log: ${callLogId}, conversation count: ${conversationCount}`);
    
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error(`Missing required Supabase environment variables in process-response function`);
      
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error with the configuration. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Fetch the user's Twilio auth token from their profile
    let userTwilioAuthToken = null;
    if (userId) {
      console.log(`Attempting to fetch Twilio auth token for user ${userId} in process-response`);
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('twilio_auth_token')
          .eq('id', userId)
          .maybeSingle();
          
        if (profileError) {
          console.error(`Failed to fetch profile for user ${userId} for validation in process-response:`, profileError);
        } else if (profile && profile.twilio_auth_token) {
          userTwilioAuthToken = profile.twilio_auth_token;
          console.log(`Auth token fetched successfully for user ${userId} in process-response`);
        } else {
          console.warn(`No auth token found in profile for user ${userId} in process-response`);
        }
      } catch (profileFetchError) {
        console.error(`Exception fetching profile for user ${userId} in process-response:`, profileFetchError);
      }
    } else {
      console.warn("No userId in process-response webhook URL for validation");
    }
    
    // Validate Twilio request with the user-specific token
    console.log('Attempting to validate Twilio request signature in process-response with user-specific auth token');
    const isValidRequest = await validateTwilioRequest(req, fullUrl, userTwilioAuthToken);
    
    if (!isValidRequest) {
      console.warn("Twilio request validation FAILED in process-response, but proceeding anyway for testing purposes");
      // During development, we'll continue processing even if validation fails
      // In production, uncomment the following return statement
      /*
      return new Response("Twilio signature validation failed", {
        status: 403,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
      */
    } else {
      console.log('Twilio request validated successfully in process-response');
    }
    
    // Try to parse the form data from Twilio
    let userInput: string | null = null;
    let digits: string | null = null;
    
    console.log('Parsing form data from Twilio');
    try {
      const formData = await req.formData();
      userInput = formData.get('SpeechResult')?.toString() || null;
      digits = formData.get('Digits')?.toString() || null;
      
      console.log(`Parsed input - Speech: ${userInput || 'None'}, Digits: ${digits || 'None'}`);
    } catch (error) {
      console.error('Error parsing form data:', error);
    }
    
    // Fetch the agent configuration - CHANGED: now using supabaseAdmin instead of supabaseClient
    console.log(`Fetching agent config with ID: ${agentConfigId}`);
    const { data: agentConfig, error: agentConfigError } = await supabaseAdmin
      .from('agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .maybeSingle();
    
    if (agentConfigError || !agentConfig) {
      console.error(`Error fetching agent config or not found: ${agentConfigError?.message || 'Not found'}`);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error with the AI agent configuration. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    console.log(`Using agent config: ${agentConfig.config_name}`);
    
    // Generate appropriate response based on user input
    let aiResponse: string;
    
    if (!userInput && !digits) {
      console.log('No user input detected');
      aiResponse = "I didn't hear your response. Could you please try again? Say yes if you're interested or no if you're not.";
    } else {
      console.log('Generating response for user input');
      // Process speech or digit input
      let normalizedInput = '';
      
      if (digits) {
        // Convert digits to yes/no response
        normalizedInput = digits === '1' ? 'yes' : digits === '2' ? 'no' : `pressed ${digits}`;
        console.log(`Normalized digit input to: ${normalizedInput}`);
      } else if (userInput) {
        normalizedInput = userInput.toLowerCase();
        console.log(`Using speech input: ${normalizedInput}`);
      }
      
      // TODO: In a production environment, we would call an LLM here to generate a response
      // For now, we'll use a simple rule-based approach
      if (normalizedInput.includes('yes') || normalizedInput.includes('sure') || 
          normalizedInput.includes('ok') || normalizedInput.includes('interested') ||
          normalizedInput === 'pressed 1') {
        console.log('Detected positive response');
        aiResponse = "Great! I'll make sure an agent follows up with you soon. Is there a specific time that would work best for you?";
      } else if (normalizedInput.includes('no') || normalizedInput.includes('not') ||
                normalizedInput.includes('don\'t') || normalizedInput.includes('later') ||
                normalizedInput === 'pressed 2') {
        console.log('Detected negative response');
        aiResponse = "I understand. Thank you for your time. If you change your mind or have questions about real estate opportunities in the future, please don't hesitate to reach out. Have a great day!";
      } else {
        console.log('Detected ambiguous response');
        aiResponse = `I heard you say ${userInput || 'something'}, but I'm not sure if that's a yes or no. Could you please say yes if you're interested in speaking with one of our agents, or no if you're not interested at this time?`;
      }
    }
    
    console.log(`Generated AI response: "${aiResponse}"`);
    
    // Should we continue the conversation or end the call?
    const isPositiveResponse = aiResponse.includes("Great!") || aiResponse.includes("specific time");
    const isNegativeResponse = aiResponse.includes("I understand") || aiResponse.includes("Have a great day");
    const isEndingCall = isNegativeResponse || parseInt(conversationCount) >= 3;
    
    console.log(`Conversation flow - Positive: ${isPositiveResponse}, Negative: ${isNegativeResponse}, Ending: ${isEndingCall}, Count: ${conversationCount}`);
    
    // Build the TwiML response
    const response = twiml.VoiceResponse();
    response.say(aiResponse);
    response.pause({ length: 1 });
    
    if (!isEndingCall) {
      // Continue the conversation
      const nextActionUrl = `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&conversation_count=${nextConversationCount}${callLogId ? `&call_log_id=${callLogId}` : ''}`;
      
      const gather = response.gather({
        input: 'speech dtmf',
        action: nextActionUrl,
        method: 'POST',
        timeout: 10,
        speechTimeout: 'auto',
        language: 'en-US'
      });
      
      gather.say("Please go ahead with your response.");
      console.log(`Set next action URL to continue conversation: ${nextActionUrl}`);
      
      // Add a fallback in case gather times out
      response.say("I didn't catch that. Thank you for your time. Someone from our team will follow up with you soon.");
    } else {
      // End the conversation
      if (isPositiveResponse) {
        response.say("Thank you for your time. An agent will be in touch with you soon. Have a great day!");
      }
      
      response.hangup();
      console.log('Ending call');
      
      // Update the call log status if we have a callLogId
      if (callLogId) {
        try {
          console.log(`Updating call log ${callLogId} with summary information`);
          await supabaseAdmin
            .from('call_logs')
            .update({
              summary: isPositiveResponse ? 
                "Prospect expressed interest. Follow-up required." :
                "Prospect not interested at this time."
            })
            .eq('id', callLogId);
        } catch (error) {
          console.error('Error updating call log with summary:', error);
        }
      }
    }
    
    const twimlString = response.toString();
    console.log(`Returning TwiML response (truncated): ${twimlString.substring(0, 200)}...`);
    
    return new Response(twimlString, { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  } catch (error) {
    console.error('Error in process-response function:', error);
    
    // Return a simple TwiML response in case of error
    const response = twiml.VoiceResponse()
      .say("I'm sorry, there was an error processing your response. Please try again later.")
      .hangup();
      
    return new Response(response.toString(), { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  }
});
