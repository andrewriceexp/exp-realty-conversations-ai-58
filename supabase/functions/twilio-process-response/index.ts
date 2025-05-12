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
    
    // Validate Twilio request - but don't block requests if validation fails during testing
    const isValidRequest = await validateTwilioRequest(req, fullUrl);
    
    if (!isValidRequest) {
      console.warn("Twilio request validation failed, but proceeding anyway for testing purposes");
      // During development, we'll continue processing even if validation fails
      // In production, uncomment the following return statement
      /*
      return new Response("Twilio signature validation failed", {
        status: 403,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
      */
    }

    // Parse URL and get query parameters
    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    const conversationCount = url.searchParams.get('conversation_count') || '0';
    const nextConversationCount = (parseInt(conversationCount) + 1).toString();
    
    console.log(`Processing response for prospect: ${prospectId}, agent config: ${agentConfigId}, user: ${userId}, call log: ${callLogId}, conversation count: ${conversationCount}`);
    
    // Parse the form data from Twilio
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult')?.toString();
    const confidence = formData.get('Confidence')?.toString();
    const callSid = formData.get('CallSid')?.toString();
    
    console.log(`Speech received: "${speechResult}" (confidence: ${confidence})`);
    
    // Initialize Supabase client with anon key (for read operations)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    // Initialize Supabase admin client with service role key (for write operations)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    if (!speechResult) {
      console.error('No speech result received');
      // Increase timeout and add more detailed prompting to help capture speech
      const response = twiml.VoiceResponse()
        .say("I'm sorry, I couldn't hear you. Let me try again.")
        .pause({ length: 2 }) // Added a longer pause to give the caller time to prepare
        .gather({
          input: 'speech',
          action: `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${conversationCount}`,
          method: 'POST',
          timeout: 15, // Increased timeout from 7 to 15 seconds
          speechTimeout: 'auto',
          language: 'en-US' // Explicitly set language
        })
        .say("Please let me know how I can help you today. I'm listening now.")
        .endGather()
        .say("I didn't catch that. Thank you for your time. Goodbye.")
        .hangup();
        
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
        `\nProspect: ${speechResult}`;
      
      console.log(`Updating call log transcript: ${callLogId}`);
      try {
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
      prompt: speechResult,
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
    const isEndingCall = lowerResponse.includes('goodbye') || 
                        lowerResponse.includes('thank you for your time') ||
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
        twimlResponse = twiml.VoiceResponse()
          .play(audioUrl)
          .pause({ length: 1 })
          .say("Thank you for your time. Goodbye.")
          .hangup();
          
      } catch (speechGenError) {
        console.error('Error generating speech:', speechGenError);
        console.log('Falling back to regular TTS for final response');
        twimlResponse = twiml.VoiceResponse()
          .say(aiResponse)
          .pause({ length: 1 })
          .say("Thank you for your time. Goodbye.")
          .hangup();
      }
      
      // Extract data for the call log
      const extractedData = {
        interested: speechResult.toLowerCase().includes('yes') || 
                    speechResult.toLowerCase().includes('interested') || 
                    speechResult.toLowerCase().includes('sure'),
        finalResponse: speechResult
      };
      
      // Update call log with the final data
      if (callLogId) {
        console.log(`Updating call log with final data: ${callLogId}`);
        try {
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
        twimlResponse = twiml.VoiceResponse()
          .play(audioUrl)
          .pause({ length: 1 })
          .gather({
            input: 'speech',
            action: nextActionUrl,
            method: 'POST',
            timeout: 15, // Increased timeout from 7 to 15 seconds
            speechTimeout: 'auto',
            language: 'en-US' // Explicitly set language
          })
          .say("I'm listening for your response.")
          .endGather()
          .say("I didn't catch that. Thank you for your time. Goodbye.")
          .hangup();
          
      } catch (speechGenError) {
        console.error('Error generating speech:', speechGenError);
        // Fallback to regular TTS if ElevenLabs fails
        // Make sure the action URL includes the full domain
        const nextActionUrl = `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${nextConversationCount}`;
        
        console.log('Falling back to regular TTS for continued conversation');
        twimlResponse = twiml.VoiceResponse()
          .say(aiResponse)
          .pause({ length: 1 })
          .gather({
            input: 'speech',
            action: nextActionUrl,
            method: 'POST',
            timeout: 15, // Increased timeout from 7 to 15 seconds
            speechTimeout: 'auto',
            language: 'en-US' // Explicitly set language
          })
          .say("I'm listening for your response.")
          .endGather()
          .say("I didn't catch that. Thank you for your time. Goodbye.")
          .hangup();
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
