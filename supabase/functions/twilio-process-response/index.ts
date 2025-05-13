
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, twiml, validateTwilioRequest } from "../_shared/twilio-helper.ts";
import { encodeXmlUrl, createGatherWithSay, createErrorResponse } from "../_shared/twiml-helpers.ts";

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
    const voiceId = url.searchParams.get('voice_id');
    const conversationCount = url.searchParams.get('conversation_count') || '0';
    const nextConversationCount = (parseInt(conversationCount) + 1).toString();
    const bypassValidation = url.searchParams.get('bypass_validation') === 'true';
    const debugMode = url.searchParams.get('debug_mode') === 'true';
    
    console.log(`Processing response for prospect: ${prospectId}, agent config: ${agentConfigId}, user: ${userId}, call log: ${callLogId}, conversation count: ${conversationCount}`);
    console.log(`Voice ID: ${voiceId ? voiceId.substring(0, 8) + '...' : 'undefined'}, Bypass validation: ${bypassValidation}, Debug mode: ${debugMode}`);
    
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !openAIApiKey) {
      console.error(`Missing required environment variables in process-response function:
        SUPABASE_URL: ${supabaseUrl ? 'set' : 'missing'},
        SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'set' : 'missing'},
        SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? 'set' : 'missing'},
        OPENAI_API_KEY: ${openAIApiKey ? 'set' : 'missing'},
        ELEVENLABS_API_KEY: ${elevenLabsApiKey ? 'set' : 'missing'}`
      );
      
      return new Response(createErrorResponse("I'm sorry, there was an error with the configuration. Please try again later."), { 
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
    
    // Validate Twilio request with the user-specific token (skip if bypass_validation is true)
    console.log('Checking if we should validate Twilio request signature...');
    let isValidRequest = false;
    
    if (bypassValidation) {
      console.log('⚠️ Bypassing Twilio signature validation (development mode)');
      isValidRequest = true;
    } else {
      console.log('Attempting to validate Twilio request signature in process-response with user-specific auth token');
      isValidRequest = await validateTwilioRequest(req, fullUrl, userTwilioAuthToken);
      
      if (!isValidRequest) {
        console.error("Twilio request validation FAILED - Returning 403 Forbidden");
        // Strict validation mode - return 403 if validation fails
        return new Response("Twilio signature validation failed", {
          status: 403,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        });
      } else {
        console.log('Twilio request validated successfully in process-response');
      }
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
    
    // Fetch the agent configuration - using supabaseAdmin
    console.log(`Fetching agent config with ID: ${agentConfigId}`);
    const { data: agentConfig, error: agentConfigError } = await supabaseAdmin
      .from('agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .maybeSingle();
    
    if (agentConfigError || !agentConfig) {
      console.error(`Error fetching agent config or not found: ${agentConfigError?.message || 'Not found'}`);
      return new Response(createErrorResponse("I'm sorry, there was an error with the AI agent configuration. Please try again later."), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    console.log(`Using agent config: ${agentConfig.config_name}`);
    console.log(`Voice provider: ${agentConfig.voice_provider}, Voice ID: ${agentConfig.voice_id}`);
    
    // Fetch prospect details if we have a prospect ID
    let prospectDetails = null;
    if (prospectId) {
      try {
        console.log(`Fetching prospect details for ID: ${prospectId}`);
        const { data: prospect, error: prospectError } = await supabaseAdmin
          .from('prospects')
          .select('*')
          .eq('id', prospectId)
          .maybeSingle();
          
        if (!prospectError && prospect) {
          prospectDetails = prospect;
          console.log(`Found prospect: ${prospect.first_name} ${prospect.last_name}`);
        } else {
          console.error(`Error fetching prospect or not found: ${prospectError?.message || 'Not found'}`);
        }
      } catch (error) {
        console.error('Error fetching prospect details:', error);
      }
    }
    
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
      
      // Call OpenAI to generate a response
      try {
        console.log('Calling OpenAI to generate a response');
        
        const systemPrompt = agentConfig.system_prompt || 
          'You are an AI assistant for an eXp Realty agent making calls to potential clients. Your goal is to schedule a meeting with the agent. Be conversational, respectful, and aim to understand the prospect\'s needs.';
        
        // Add prospect context if available
        let contextualPrompt = systemPrompt;
        if (prospectDetails) {
          contextualPrompt += `\nYou are speaking with ${prospectDetails.first_name} ${prospectDetails.last_name}`;
          if (prospectDetails.email) {
            contextualPrompt += `, their email is ${prospectDetails.email}`;
          }
          if (prospectDetails.notes) {
            contextualPrompt += `. Notes about them: ${prospectDetails.notes}`;
          }
        }
        
        // Include conversation history if this isn't the first exchange
        const conversationCountNum = parseInt(conversationCount);
        if (conversationCountNum > 0) {
          contextualPrompt += `\nThis is turn ${conversationCountNum + 1} in the conversation.`;
        }
        
        // Construct user message with the normalized input
        const userMessage = `The prospect said: "${normalizedInput}". Generate a conversational, helpful response as a real estate assistant. Keep your response concise (maximum 3-4 sentences) and end with a question if appropriate.`;
        
        // Make the OpenAI API call
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: agentConfig.llm_model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: contextualPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature: agentConfig.temperature || 0.7,
            max_tokens: 150, // Keep responses reasonably short for voice
          }),
        });
        
        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        aiResponse = data.choices[0].message.content.trim();
        console.log(`Generated AI response: "${aiResponse}"`);
        
      } catch (error) {
        console.error('Error generating AI response:', error);
        
        // Fallback to rule-based responses if AI fails
        if (normalizedInput.includes('yes') || normalizedInput.includes('sure') || 
            normalizedInput.includes('ok') || normalizedInput.includes('interested') ||
            normalizedInput === 'pressed 1') {
          console.log('Using fallback positive response');
          aiResponse = "Great! I'll make sure an agent follows up with you soon. Is there a specific time that would work best for you?";
        } else if (normalizedInput.includes('no') || normalizedInput.includes('not') ||
                  normalizedInput.includes('don\'t') || normalizedInput.includes('later') ||
                  normalizedInput === 'pressed 2') {
          console.log('Using fallback negative response');
          aiResponse = "I understand. Thank you for your time. If you change your mind or have questions about real estate opportunities in the future, please don't hesitate to reach out. Have a great day!";
        } else {
          console.log('Using fallback ambiguous response');
          aiResponse = `I heard you say ${userInput || 'something'}, but I'm not sure if that's a yes or no. Could you please say yes if you're interested in speaking with one of our agents, or no if you're not interested at this time?`;
        }
      }
    }
    
    // Should we continue the conversation or end the call?
    const isPositiveResponse = aiResponse.includes("Great!") || aiResponse.includes("specific time");
    const isNegativeResponse = aiResponse.includes("I understand") || aiResponse.includes("Have a great day");
    const isEndingCall = isNegativeResponse || parseInt(conversationCount) >= 3;
    
    console.log(`Conversation flow - Positive: ${isPositiveResponse}, Negative: ${isNegativeResponse}, Ending: ${isEndingCall}, Count: ${conversationCount}`);
    
    // Build the TwiML response
    const response = twiml.VoiceResponse();
    
    // Debug mode response if enabled
    if (debugMode) {
      console.log('Debug mode enabled - Adding extra diagnostics to TwiML');
      response.say(`Debug info: Agent config ID ${agentConfigId}, Voice provider ${agentConfig.voice_provider}, Voice ID ${voiceId || agentConfig.voice_id || 'none'}`);
      response.pause({ length: 1 });
      
      if (elevenLabsApiKey) {
        response.say("ElevenLabs API key is configured.");
      } else {
        response.say("Warning: ElevenLabs API key is not configured.");
      }
      
      response.pause({ length: 1 });
    }
    
    // Determine which voice ID to use - preference order:
    // 1. Explicitly passed voice_id from URL parameters
    // 2. Agent config voice_id
    // 3. Default to null (use Twilio default)
    const selectedVoiceId = voiceId || (agentConfig.voice_provider === 'elevenlabs' ? agentConfig.voice_id : null);
    
    // Check if we should use ElevenLabs for voice
    const useElevenLabs = elevenLabsApiKey && selectedVoiceId && agentConfig.voice_provider === 'elevenlabs';
                       
    console.log(`Using ElevenLabs for voice synthesis: ${useElevenLabs ? 'YES' : 'NO'}, Selected voice ID: ${selectedVoiceId ? selectedVoiceId.substring(0, 8) + '...' : 'none'}`);
    
    // Generate the audio for the response
    if (useElevenLabs) {
      try {
        console.log(`Generating speech using ElevenLabs with voice ID: ${selectedVoiceId}`);
        
        // Call the generate-speech edge function
        const speechResponse = await supabaseAdmin.functions.invoke('generate-speech', {
          body: {
            text: aiResponse,
            voiceId: selectedVoiceId,
            model: 'eleven_multilingual_v2'
          }
        });
        
        if (speechResponse.error) {
          console.error(`ElevenLabs speech generation error: ${speechResponse.error}`);
          throw new Error(`ElevenLabs error: ${speechResponse.error}`);
        }
        
        if (!speechResponse.data || !speechResponse.data.audioContent) {
          console.error('ElevenLabs returned no audio content');
          throw new Error('No audio content returned from ElevenLabs');
        }
        
        console.log('ElevenLabs speech generated successfully');
        
        // Use Twilio's Say with the text as we can't directly play ElevenLabs audio
        // but use a high-quality voice to simulate
        if (debugMode) {
          response.say("Using ElevenLabs voice synthesis.");
          response.pause({ length: 1 });
        }
        
        // Use Polly neural voice for higher quality speech
        response.say({
          voice: 'Polly.Amy-Neural', 
        }, aiResponse);
        
      } catch (error) {
        console.error('Error generating speech with ElevenLabs:', error);
        
        if (debugMode) {
          response.say(`ElevenLabs error occurred: ${error.message}. Falling back to Twilio voice.`);
          response.pause({ length: 1 });
        }
        
        // Fall back to Twilio's default TTS
        response.say(aiResponse);
      }
    } else {
      // Use Twilio's default TTS
      console.log('Using Twilio <Say> for text-to-speech');
      
      if (debugMode && agentConfig.voice_provider === 'elevenlabs') {
        response.say("ElevenLabs selected but not configured properly. Using Twilio voice instead.");
        response.pause({ length: 1 });
      }
      
      response.say(aiResponse);
    }
    
    response.pause({ length: 1 });
    
    if (!isEndingCall) {
      // Continue the conversation
      // Build the next URL with encoded XML parameters
      const processResponseBaseUrl = `${url.origin}/twilio-process-response`;
      const processResponseParams = {
        prospect_id: prospectId,
        agent_config_id: agentConfigId,
        user_id: userId,
        voice_id: selectedVoiceId,
        conversation_count: nextConversationCount,
        bypass_validation: bypassValidation ? 'true' : undefined,
        debug_mode: debugMode ? 'true' : undefined
      };
      
      if (callLogId) {
        processResponseParams.call_log_id = callLogId;
      }
      
      // Create XML-encoded URL
      const nextActionUrl = encodeXmlUrl(processResponseBaseUrl, processResponseParams);
      
      // IMPORTANT: Use the helper function to create a properly structured Gather with Say element
      createGatherWithSay(
        response,
        nextActionUrl,
        "Please go ahead with your response.",
        {
          timeout: 10,
          speechTimeout: 'auto',
          language: 'en-US',
          method: 'POST'
        }
      );
      
      console.log(`Set next action URL to continue conversation: ${nextActionUrl}`);
      
      // Add a fallback in case gather times out (outside the Gather element)
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
    
    // Verify the TwiML structure is correct
    if (!twimlString.includes('</Gather>') && !isEndingCall) {
      console.error('ERROR: Generated TwiML does not contain a closing Gather tag!');
    }
    
    return new Response(twimlString, { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  } catch (error) {
    console.error('Error in process-response function:', error);
    
    // Return a simple TwiML response in case of error
    return new Response(createErrorResponse("I'm sorry, there was an error processing your response. Please try again later."), { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  }
});
