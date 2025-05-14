
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('elevenlabs-signed-url function called');

  try {
    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the JWT token from the request to verify authentication
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.error('No authorization token provided');
      return new Response(
        JSON.stringify({ error: 'No authorization token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Unauthorized: Invalid user token', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body
    let agentId;
    try {
      const body = await req.json();
      agentId = body.agentId;
      console.log(`Request body parsed, agentId: ${agentId}`);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Failed to parse request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default agent ID if none provided (using the one specified by the user)
    if (!agentId) {
      agentId = '6Optf6WRTzp3rEyj2aiL';
      console.log(`No agent ID provided, using default: ${agentId}`);
    }

    // Get the ElevenLabs API key from environment variables
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    console.log(`Checking for ELEVENLABS_API_KEY: ${elevenlabsApiKey ? 'Found key' : 'No key found'}`);
    
    if (!elevenlabsApiKey) {
      console.error('ElevenLabs API key not configured on the server');
      return new Response(
        JSON.stringify({ 
          error: 'ElevenLabs API key not configured on the server.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Making request to ElevenLabs API for agent ID: ${agentId}`);
    
    // Use the ElevenLabs API to get a signed URL
    try {
      console.log('Sending request to ElevenLabs API...');
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': elevenlabsApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`ElevenLabs API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs API error: Status ${response.status}, Body: ${errorText}`);
        return new Response(
          JSON.stringify({ 
            error: `ElevenLabs API error: ${response.status} ${errorText}`, 
            details: 'Check the agent ID and API key configuration'
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const elevenlabsData = await response.json();
      
      if (!elevenlabsData.signed_url) {
        console.error('ElevenLabs API returned response without signed_url', elevenlabsData);
        return new Response(
          JSON.stringify({ error: 'ElevenLabs API returned invalid response' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Successfully got signed URL from ElevenLabs');
      
      return new Response(
        JSON.stringify({ signed_url: elevenlabsData.signed_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      console.error('Error fetching from ElevenLabs API:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Error connecting to ElevenLabs API',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in elevenlabs-signed-url function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
