
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TwiML helper functions
const twiml = {
  VoiceResponse: function() {
    let content = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    return {
      say: function(text, options = {}) {
        const voice = options.voice || 'alice';
        content += `<Say voice="${voice}">${text}</Say>`;
        return this;
      },
      play: function(url) {
        content += `<Play>${url}</Play>`;
        return this;
      },
      pause: function(options = {}) {
        const length = options.length || 1;
        content += `<Pause length="${length}"/>`;
        return this;
      },
      gather: function(options = {}) {
        content += '<Gather';
        for (const [key, value] of Object.entries(options)) {
          content += ` ${key}="${value}"`;
        }
        content += '>';
        return {
          say: function(text, sayOptions = {}) {
            const voice = sayOptions.voice || 'alice';
            content += `<Say voice="${voice}">${text}</Say>`;
            return this;
          },
          play: function(url) {
            content += `<Play>${url}</Play>`;
            return this;
          },
          endGather: function() {
            content += '</Gather>';
            return twiml.VoiceResponse();
          }
        };
      },
      hangup: function() {
        content += '<Hangup/>';
        return this;
      },
      toString: function() {
        return content + '</Response>';
      }
    };
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse URL and get query parameters
    const url = new URL(req.url);
    const callLogId = url.searchParams.get('call_log_id');
    const prospectId = url.searchParams.get('prospect_id');
    const agentConfigId = url.searchParams.get('agent_config_id');
    const userId = url.searchParams.get('user_id');
    const conversationCount = url.searchParams.get('conversation_count') || '0';
    const nextConversationCount = (parseInt(conversationCount) + 1).toString();
    
    // Parse the form data from Twilio
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult')?.toString();
    const confidence = formData.get('Confidence')?.toString();
    const callSid = formData.get('CallSid')?.toString();
    
    console.log(`Speech received: "${speechResult}" (confidence: ${confidence})`);
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    if (!speechResult) {
      console.error('No speech result received');
      const response = twiml.VoiceResponse()
        .say("I'm sorry, I couldn't hear you. Let me try again.")
        .gather({
          input: 'speech',
          action: `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&conversation_count=${conversationCount}`,
          method: 'POST',
          timeout: 5,
          speechTimeout: 'auto'
        })
        .say("Please let me know how I can help you today.")
        .endGather()
        .say("I didn't catch that. Thank you for your time. Goodbye.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // Retrieve agent configuration for API settings
    const { data: agentConfig, error: agentConfigError } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .single();
    
    if (agentConfigError) {
      console.error('Error fetching agent config:', agentConfigError);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error with the AI agent configuration. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // Retrieve prospect information
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('first_name, last_name, phone_number, property_address, notes')
      .eq('id', prospectId)
      .single();
      
    if (prospectError) {
      console.error('Error fetching prospect:', prospectError);
      const response = twiml.VoiceResponse()
        .say("I'm sorry, there was an error retrieving your information. Please try again later.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    }
    
    // Update the call log with the transcript
    if (callLogId) {
      // Get existing transcript to build conversation history
      const { data: existingCallLog } = await supabaseClient
        .from('call_logs')
        .select('transcript')
        .eq('id', callLogId)
        .single();
        
      let transcriptHistory = '';
      if (existingCallLog?.transcript) {
        transcriptHistory = existingCallLog.transcript;
      }
      
      // Add this turn to the transcript history
      const updatedTranscript = transcriptHistory + 
        `\nProspect: ${speechResult}`;
      
      await supabaseClient
        .from('call_logs')
        .update({
          transcript: updatedTranscript
        })
        .eq('id', callLogId);
    }
    
    // Call OpenAI to generate response
    // In a real implementation, you would use fetch() to call your OpenAI edge function
    const openaiPayload = {
      prompt: speechResult,
      systemPrompt: `You are an AI assistant for eXp Realty named Alex. You are speaking with a prospect named ${prospect.first_name || 'there'}. 
      Keep responses conversational, friendly, and under 100 words. You are calling about ${prospect.property_address || 'their property'}. 
      Your goal is to set up an appointment with a real estate agent. If they express interest, thank them and let them know an agent will call them soon.
      If they're not interested, respect that and politely end the conversation. Previous conversation: ${callLogId ? "..." : "This is the start of the conversation."}`
    };
    
    // Call the OpenAI edge function
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
    
    // Update the call log with the AI response
    if (callLogId) {
      const { data: existingCallLog } = await supabaseClient
        .from('call_logs')
        .select('transcript')
        .eq('id', callLogId)
        .single();
        
      let transcriptHistory = '';
      if (existingCallLog?.transcript) {
        transcriptHistory = existingCallLog.transcript;
      }
      
      const updatedTranscript = transcriptHistory + 
        `\nAI: ${aiResponse}`;
      
      await supabaseClient
        .from('call_logs')
        .update({
          transcript: updatedTranscript
        })
        .eq('id', callLogId);
    }
    
    // Process the response to determine if we should end the call
    const lowerResponse = aiResponse.toLowerCase();
    const isEndingCall = lowerResponse.includes('goodbye') || 
                        lowerResponse.includes('thank you for your time') ||
                        parseInt(conversationCount) >= 3; // Limit conversation to 3 turns
    
    let twimlResponse;
    
    // Check if this is the final turn of conversation
    if (isEndingCall) {
      // Generate the final speech audio with ElevenLabs
      const elevenLabsPayload = {
        text: aiResponse,
        voiceId: agentConfig?.voice_id || "EXAVITQu4vr4xnSDxMaL", // Use agent config or default to Sarah's voice
        model: agentConfig?.tts_model || "eleven_multilingual_v2"
      };
      
      try {
        // Call ElevenLabs for text-to-speech
        const { data: speechData, error: speechError } = await supabaseClient.functions.invoke('generate-speech', {
          body: elevenLabsPayload
        });
        
        if (speechError || !speechData?.audioContent) {
          throw new Error(speechError?.message || 'No audio content returned');
        }
        
        // Update prospect status
        await supabaseClient
          .from('prospects')
          .update({
            status: 'Completed',
            notes: `CALL COMPLETED: Last response: "${speechResult}"`
          })
          .eq('id', prospectId);
          
        // Create TwiML with audio playback
        const audioUrl = `data:audio/mpeg;base64,${speechData.audioContent}`;
        twimlResponse = twiml.VoiceResponse()
          .play(audioUrl)
          .pause({ length: 1 })
          .say("Thank you for your time. Goodbye.")
          .hangup();
          
      } catch (speechGenError) {
        console.error('Error generating speech:', speechGenError);
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
        await supabaseClient
          .from('call_logs')
          .update({
            extracted_data: extractedData,
            summary: "Call completed. Review transcript for details."
          })
          .eq('id', callLogId);
      }
      
    } else {
      // This is not the final turn, continue the conversation
      try {
        // Generate the speech audio with ElevenLabs
        const elevenLabsPayload = {
          text: aiResponse,
          voiceId: agentConfig?.voice_id || "EXAVITQu4vr4xnSDxMaL", // Use agent config or default to Sarah's voice
          model: agentConfig?.tts_model || "eleven_multilingual_v2"
        };
        
        // Call ElevenLabs for text-to-speech
        const { data: speechData, error: speechError } = await supabaseClient.functions.invoke('generate-speech', {
          body: elevenLabsPayload
        });
        
        if (speechError || !speechData?.audioContent) {
          throw new Error(speechError?.message || 'No audio content returned');
        }
        
        // Create TwiML with audio playback and gather for next turn
        const audioUrl = `data:audio/mpeg;base64,${speechData.audioContent}`;
        twimlResponse = twiml.VoiceResponse()
          .play(audioUrl)
          .gather({
            input: 'speech',
            action: `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${nextConversationCount}`,
            method: 'POST',
            timeout: 5,
            speechTimeout: 'auto'
          })
          .say("I'm listening for your response.")
          .endGather()
          .say("I didn't catch that. Thank you for your time. Goodbye.")
          .hangup();
          
      } catch (speechGenError) {
        console.error('Error generating speech:', speechGenError);
        // Fallback to regular TTS if ElevenLabs fails
        twimlResponse = twiml.VoiceResponse()
          .gather({
            input: 'speech',
            action: `${url.origin}/twilio-process-response?prospect_id=${prospectId}&agent_config_id=${agentConfigId}&user_id=${userId}&call_log_id=${callLogId}&conversation_count=${nextConversationCount}`,
            method: 'POST',
            timeout: 5,
            speechTimeout: 'auto'
          })
          .say(aiResponse)
          .say("I'm listening for your response.")
          .endGather()
          .say("I didn't catch that. Thank you for your time. Goodbye.")
          .hangup();
      }
    }
    
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
