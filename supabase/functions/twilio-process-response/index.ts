
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
      pause: function(options = {}) {
        const length = options.length || 1;
        content += `<Pause length="${length}"/>`;
        return this;
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
    
    // Parse the form data from Twilio
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult')?.toString();
    const confidence = formData.get('Confidence')?.toString();
    
    console.log(`Speech received: "${speechResult}" (confidence: ${confidence})`);
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    if (callLogId && speechResult) {
      // Update the call log with the transcript
      await supabaseClient
        .from('call_logs')
        .update({
          transcript: speechResult
        })
        .eq('id', callLogId);
      
      // In a more advanced implementation, this would be where the AI processes the response
      // and continues the conversation with the prospect
      
      let aiResponse = '';
      
      // Simple NLP to determine if the response is positive
      const positiveWords = ['yes', 'sure', 'interested', 'tell me more', 'learn more'];
      const negativeWords = ['no', 'not interested', 'busy', 'later'];
      
      const lowerSpeech = speechResult.toLowerCase();
      
      let isPositive = false;
      let isNegative = false;
      
      for (const word of positiveWords) {
        if (lowerSpeech.includes(word)) {
          isPositive = true;
          break;
        }
      }
      
      for (const word of negativeWords) {
        if (lowerSpeech.includes(word)) {
          isNegative = true;
          break;
        }
      }
      
      if (isPositive) {
        aiResponse = "Great! I'll have an agent reach out to you soon to discuss your real estate needs. They'll call you at this number. Thank you for your time today.";
        
        // Update prospect status
        await supabaseClient
          .from('prospects')
          .update({
            status: 'Completed',
            notes: `INTERESTED: ${speechResult}`
          })
          .eq('id', prospectId);
          
        // Extract data for the call log
        const extractedData = {
          interested: true,
          response: speechResult
        };
        
        await supabaseClient
          .from('call_logs')
          .update({
            extracted_data: extractedData,
            summary: "Prospect expressed interest in speaking with an agent."
          })
          .eq('id', callLogId);
      } else if (isNegative) {
        aiResponse = "I understand. Thank you for taking the time to speak with me today. If you change your mind or have any real estate questions in the future, please don't hesitate to reach out to eXp Realty. Have a great day!";
        
        // Update prospect status
        await supabaseClient
          .from('prospects')
          .update({
            status: 'Completed',
            notes: `NOT INTERESTED: ${speechResult}`
          })
          .eq('id', prospectId);
          
        // Extract data for the call log
        const extractedData = {
          interested: false,
          response: speechResult
        };
        
        await supabaseClient
          .from('call_logs')
          .update({
            extracted_data: extractedData,
            summary: "Prospect declined interest in speaking with an agent."
          })
          .eq('id', callLogId);
      } else {
        aiResponse = "Thank you for your response. I'll pass along your feedback to our team. An agent may reach out to follow up with more information. Have a great day!";
        
        // Update prospect status
        await supabaseClient
          .from('prospects')
          .update({
            status: 'Completed',
            notes: `RESPONSE UNCLEAR: ${speechResult}`
          })
          .eq('id', prospectId);
          
        // Extract data for the call log
        const extractedData = {
          interested: null,
          response: speechResult
        };
        
        await supabaseClient
          .from('call_logs')
          .update({
            extracted_data: extractedData,
            summary: "Unclear if prospect is interested; follow-up recommended."
          })
          .eq('id', callLogId);
      }
      
      // Create a TwiML response
      const response = twiml.VoiceResponse()
        .say(aiResponse)
        .pause({ length: 1 })
        .say("Thank you for your time. Goodbye.")
        .hangup();
        
      return new Response(response.toString(), { 
        headers: { 'Content-Type': 'text/xml', ...corsHeaders } 
      });
    } else {
      throw new Error('Missing required parameters');
    }
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
