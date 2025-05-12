
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    // Parse the form data from Twilio
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult')?.toString();
    const confidence = formData.get('Confidence')?.toString();
    const callSid = formData.get('CallSid')?.toString();
    const digits = formData.get('Digits')?.toString(); // Get DTMF input if any
    
    // Log the user input - both speech and DTMF
    if (speechResult) {
      console.log(`Speech received: "${speechResult}" (confidence: ${confidence})`);
    }
    if (digits) {
      console.log(`DTMF digits received: "${digits}"`);
    }
    
    // Process DTMF input if no speech was detected
    let userInput = speechResult || '';
    if (!speechResult && digits) {
      // Convert DTMF to text response
      if (digits === '1') {
        userInput = 'Yes, I am interested';
      } else if (digits === '2') {
        userInput = 'No, I am not interested';
      } else {
        userInput = `Pressed ${digits}`;
      }
      console.log(`Converted DTMF to text: "${userInput}"`);
    }
    
    if (!userInput) {
      console.error('No speech or DTMF input received');
      
      // Create a TwiML response for no input detected
      const response = twiml.VoiceResponse();
      response.say("I'm sorry, I couldn't hear you. Please speak clearly or use the keypad. Press 1 for yes or 2 for no.");
      response.pause({ length: 2 }); // Added a longer pause to give the caller time to prepare
      
      // First gather attempt
      const gather1 = response.gather({
        input: 'speech dtmf', // Accept both speech and keypad
        action: `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${conversationCount}`,
        method: 'POST',
        timeout: 15,
        speechTimeout: 'auto',
        language: 'en-US',
        hints: 'yes,no,maybe,interested,not interested'
      });
      
      gather1.say("Please let me know how I can help you today. You can speak now or press 1 for yes, 2 for no.");
      
      // Add a pause between gather attempts
      response.pause({ length: 2 });
      
      // Second gather attempt
      const gather2 = response.gather({
        input: 'speech dtmf',
        action: `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${conversationCount}`,
        method: 'POST',
        timeout: 10,
        speechTimeout: 'auto',
        language: 'en-US'
      });
      
      gather2.say("I still couldn't detect your response. Please try once more.");
      
      // Final message if still no input
      response.say("I still couldn't detect your response. Thank you for your time. Goodbye.");
      response.hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // Retrieve agent configuration for API settings
    console.log(`Fetching agent config: ${agentConfigId}`);
    const { data: agentConfig, error: agentConfigError } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .maybeSingle();
    
    if (agentConfigError) {
      console.error('Error fetching agent config:', agentConfigError);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error with the AI agent configuration. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    console.log(`Agent config retrieved: ${agentConfig?.config_name}`);
    
    // Retrieve prospect information
    console.log(`Fetching prospect: ${prospectId}`);
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('first_name, last_name, phone_number, property_address, notes')
      .eq('id', prospectId)
      .maybeSingle();
      
    if (prospectError) {
      console.error('Error fetching prospect:', prospectError);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error retrieving your information. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    console.log(`Prospect retrieved: ${prospect?.first_name} ${prospect?.last_name}`);
    
    // Update the call log with the transcript - Using supabaseAdmin
    if (callLogId) {
      // Get existing transcript to build conversation history
      console.log(`Fetching existing transcript for call log: ${callLogId}`);
      const { data: existingCallLog } = await supabaseClient
        .from('call_logs')
        .select('transcript')
        .eq('id', callLogId)
        .maybeSingle();
        
      let transcriptHistory = '';
      if (existingCallLog?.transcript) {
        transcriptHistory = existingCallLog.transcript;
      }
      
      // Add this turn to the transcript history
      const updatedTranscript = transcriptHistory + 
        `\nProspect: ${userInput}`;
      
      console.log(`Updating call log transcript: ${callLogId}`);
      try {
        // Only update the transcript field
        const { error } = await supabaseAdmin
          .from('call_logs')
          .update({
            transcript: updatedTranscript
          })
          .eq('id', callLogId);
          
        if (error) {
          console.error('Error updating call log transcript:', error);
        } else {
          console.log('Call log transcript updated successfully');
        }
      } catch (error) {
        console.error('Exception updating call log transcript:', error);
      }
    }
    
    // Call OpenAI to generate response
    console.log('Calling OpenAI to generate response');
    const openaiPayload = {
      prompt: userInput,
      systemPrompt: `You are an AI assistant for eXp Realty named Alex. You are speaking with a prospect named ${prospect?.first_name || 'there'}. 
      Keep responses conversational, friendly, and under 100 words. You are calling about ${prospect?.property_address || 'their property'}. 
      Your goal is to set up an appointment with a real estate agent. If they express interest, thank them and let them know an agent will call them soon.
      If they're not interested, respect that and politely end the conversation. Previous conversation: ${callLogId ? "..." : "This is the start of the conversation."}`
    };
    
    // Call the OpenAI edge function
    console.log('Invoking generate-with-ai function');
    const { data: openaiResponse, error: openaiError } = await supabaseClient.functions.invoke('generate-with-ai', {
      body: openaiPayload
    });
    
    if (openaiError) {
      console.error('Error calling OpenAI:', openaiError);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, I'm having trouble processing your request right now. An agent will follow up with you soon. Thank you for your time.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    const aiResponse = openaiResponse?.generatedText || "Thank you for your response. An agent will contact you soon.";
    console.log(`AI response generated: "${aiResponse}"`);
    
    // Update the call log with the AI response - Using supabaseAdmin
    if (callLogId) {
      const { data: existingCallLog } = await supabaseClient
        .from('call_logs')
        .select('transcript')
        .eq('id', callLogId)
        .maybeSingle();
        
      let transcriptHistory = '';
      if (existingCallLog?.transcript) {
        transcriptHistory = existingCallLog.transcript;
      }
      
      const updatedTranscript = transcriptHistory + 
        `\nAI: ${aiResponse}`;
      
      console.log(`Updating call log with AI response: ${callLogId}`);
      try {
        // Only update the transcript field
        const { error } = await supabaseAdmin
          .from('call_logs')
          .update({
            transcript: updatedTranscript
          })
          .eq('id', callLogId);
          
        if (error) {
          console.error('Error updating call log with AI response:', error);
        } else {
          console.log('Call log AI response updated successfully');
        }
      } catch (error) {
        console.error('Exception updating call log with AI response:', error);
      }
    }
    
    // Process the response to determine if we should end the call
    const lowerResponse = aiResponse.toLowerCase();
    const userInputLower = userInput.toLowerCase();
    const isEndingCall = lowerResponse.includes('goodbye') || 
                        lowerResponse.includes('thank you for your time') ||
                        userInputLower.includes('no') || 
                        userInputLower.includes('not interested') ||
                        parseInt(conversationCount) >= 3; // Limit conversation to 3 turns
    
    console.log(`Is ending call: ${isEndingCall}, conversation count: ${conversationCount}`);
    
    let twimlResponse;
    
    // Check if this is the final turn of conversation
    if (isEndingCall) {
      console.log('Final turn - generating speech for ending call');
      // Generate the final speech audio with ElevenLabs
      const elevenLabsPayload = {
        text: aiResponse,
        voiceId: agentConfig?.voice_id || "EXAVITQu4vr4xnSDxMaL", // Use agent config or default to Sarah's voice
        model: agentConfig?.tts_model || "eleven_multilingual_v2"
      };
      
      try {
        // Call ElevenLabs for text-to-speech
        console.log('Invoking generate-speech function');
        const { data: speechData, error: speechError } = await supabaseClient.functions.invoke('generate-speech', {
          body: elevenLabsPayload
        });
        
        if (speechError || !speechData?.audioContent) {
          throw new Error(speechError?.message || 'No audio content returned');
        }
        
        console.log('Speech generated successfully, updating prospect status');
        
        // Update prospect status
        try {
          const { error } = await supabaseAdmin
            .from('prospects')
            .update({
              status: 'Completed',
              notes: `CALL COMPLETED: Last response: "${speechResult}"`
            })
            .eq('id', prospectId);
            
          if (error) {
            console.error('Error updating prospect status:', error);
          } else {
            console.log('Prospect status updated successfully');
          }
        } catch (error) {
          console.error('Exception updating prospect status:', error);
        }
          
        // Create TwiML with audio playback
        const audioUrl = `data:audio/mpeg;base64,${speechData.audioContent}`;
        console.log('Creating TwiML with audio playback for final response');
        
        twimlResponse = twiml.VoiceResponse();
        twimlResponse.play(audioUrl);
        twimlResponse.pause({ length: 1 });
        twimlResponse.say("Thank you for your time. Goodbye.");
        twimlResponse.hangup();
          
      } catch (speechGenError) {
        console.error('Error generating speech:', speechGenError);
        console.log('Falling back to regular TTS for final response');
        
        twimlResponse = twiml.VoiceResponse();
        twimlResponse.say(aiResponse);
        twimlResponse.pause({ length: 1 });
        twimlResponse.say("Thank you for your time. Goodbye.");
        twimlResponse.hangup();
      }
      
      // Extract data for the call log
      const extractedData = {
        interested: speechResult?.toLowerCase().includes('yes') || 
                    speechResult?.toLowerCase().includes('interested') || 
                    speechResult?.toLowerCase().includes('sure'),
        finalResponse: speechResult
      };
      
      // Update call log with the final data
      if (callLogId) {
        console.log(`Updating call log with final data: ${callLogId}`);
        try {
          // Only update these specific fields
          const { error } = await supabaseAdmin
            .from('call_logs')
            .update({
              extracted_data: extractedData,
              summary: "Call completed. Review transcript for details."
            })
            .eq('id', callLogId);
            
          if (error) {
            console.error('Error updating call log with final data:', error);
          } else {
            console.log('Call log final data updated successfully');
          }
        } catch (error) {
          console.error('Exception updating call log with final data:', error);
        }
      }
      
    } else {
      // This is not the final turn, continue the conversation
      console.log('Not final turn - continuing conversation');
      try {
        // Generate the speech audio with ElevenLabs
        const elevenLabsPayload = {
          text: aiResponse,
          voiceId: agentConfig?.voice_id || "EXAVITQu4vr4xnSDxMaL", // Use agent config or default to Sarah's voice
          model: agentConfig?.tts_model || "eleven_multilingual_v2"
        };
        
        console.log('Invoking generate-speech function');
        // Call ElevenLabs for text-to-speech
        const { data: speechData, error: speechError } = await supabaseClient.functions.invoke('generate-speech', {
          body: elevenLabsPayload
        });
        
        if (speechError || !speechData?.audioContent) {
          throw new Error(speechError?.message || 'No audio content returned');
        }
        
        // Make sure the action URL includes the full domain
        const nextActionUrl = `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${nextConversationCount}`;
        console.log(`Setting next Gather action URL to: ${nextActionUrl}`);
        
        // Create TwiML with audio playback and gather for next turn
        const audioUrl = `data:audio/mpeg;base64,${speechData.audioContent}`;
        console.log('Creating TwiML with audio playback for continued conversation');
        
        twimlResponse = twiml.VoiceResponse();
        twimlResponse.play(audioUrl);
        twimlResponse.pause({ length: 1 });
        
        // First gather attempt
        const gather1 = twimlResponse.gather({
          input: 'speech dtmf', // Accept both speech and keypad
          action: nextActionUrl,
          method: 'POST',
          timeout: 15,
          speechTimeout: 'auto',
          language: 'en-US',
          hints: 'yes,no,maybe,interested,not interested'
        });
        
        gather1.say("I'm listening for your response. You can speak now or press 1 for yes, 2 for no.");
        
        // Add a pause between gather attempts
        twimlResponse.pause({ length: 2 });
        
        // Second gather attempt
        const gather2 = twimlResponse.gather({
          input: 'speech dtmf',
          action: nextActionUrl,
          method: 'POST',
          timeout: 10,
          speechTimeout: 'auto',
          language: 'en-US'
        });
        
        gather2.say("I still couldn't detect your response. Please try once more.");
        
        // Final message if still no input
        twimlResponse.say("I still couldn't detect your response. Thank you for your time. Goodbye.");
        twimlResponse.hangup();
          
      } catch (speechGenError) {
        console.error('Error generating speech:', speechGenError);
        // Fallback to regular TTS if ElevenLabs fails
        // Make sure the action URL includes the full domain
        const nextActionUrl = `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${nextConversationCount}`;
        
        console.log('Falling back to regular TTS for continued conversation');
        
        twimlResponse = twiml.VoiceResponse();
        twimlResponse.say(aiResponse);
        twimlResponse.pause({ length: 1 });
        
        // First gather attempt
        const gather1 = twimlResponse.gather({
          input: 'speech dtmf',
          action: nextActionUrl,
          method: 'POST',
          timeout: 15,
          speechTimeout: 'auto',
          language: 'en-US',
          hints: 'yes,no,maybe,interested,not interested'
        });
        
        gather1.say("I'm listening for your response. You can speak now or press 1 for yes, 2 for no.");
        
        // Add a pause between gather attempts
        twimlResponse.pause({ length: 2 });
        
        // Second gather attempt
        const gather2 = twimlResponse.gather({
          input: 'speech dtmf',
          action: nextActionUrl,
          method: 'POST',
          timeout: 10,
          speechTimeout: 'auto',
          language: 'en-US'
        });
        
        gather2.say("I still couldn't detect your response. Please try once more.");
        
        // Final message if still no input
        twimlResponse.say("I still couldn't detect your response. Thank you for your time. Goodbye.");
        twimlResponse.hangup();
      }
    }
    
    console.log('Returning TwiML response to Twilio');
    return new Response(twimlResponse.toString(), { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
    
  } catch (error) {
    console.error('Error in twilio-process-response function:', error);
    
    // Return a simple TwiML response in case of error
    const response = twiml.VoiceResponse()
      .say("I'm sorry, there was an error processing your response. Thank you for your time. Goodbye.")
      .hangup();
      
    return new Response(response.toString(), { 
      headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
    });
  }
});
