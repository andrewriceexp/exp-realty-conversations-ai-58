
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Use the environment variable directly instead of individual user keys
const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, model, settings } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    if (!elevenlabsApiKey) {
      throw new Error('ElevenLabs API key is not configured on the server');
    }

    const defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice
    const defaultModel = 'eleven_multilingual_v2';
    const finalVoiceId = voiceId || defaultVoiceId;
    const finalModel = model || defaultModel;

    console.log(`Generating speech for text (truncated): "${text.substring(0, 50)}..."`);
    console.log(`Using voice ID: ${finalVoiceId}`);
    console.log(`Using model: ${finalModel}`);

    // Default voice settings if not provided
    const voiceSettings = settings || {
      stability: 0.5,
      similarity_boost: 0.75,
    };

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: finalModel,
          voice_settings: voiceSettings
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('ElevenLabs API error:', errorData);
      throw new Error(errorData.detail?.message || `Failed to generate speech: ${response.status}`);
    }

    // Get audio as arrayBuffer and convert to base64
    const audioArrayBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(
      String.fromCharCode(...new Uint8Array(audioArrayBuffer))
    );

    console.log(`Speech generated successfully, returned ${audioBase64.length} characters of base64 audio`);

    return new Response(
      JSON.stringify({ audioContent: audioBase64 }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-speech function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
