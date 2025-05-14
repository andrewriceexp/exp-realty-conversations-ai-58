
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.1';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
    // Extract the auth token from the request
    const authHeader = req.headers.get('Authorization');
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    // Create a Supabase client with the user's JWT to verify their identity
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify the user's JWT by getting the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error("User authentication error:", userError);
      throw new Error(`Unauthorized: ${userError.message}`);
    }
    
    if (!user) {
      console.error("No user found in authentication");
      throw new Error('Unauthorized: No user found');
    }
    
    console.log("User authenticated:", user.id);

    // Create a service role client to bypass RLS
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch the user's profile to get their ElevenLabs API key
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('elevenlabs_api_key')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error("Profile fetch error:", profileError);
      throw new Error(`Failed to retrieve user profile: ${profileError.message}`);
    }

    if (!profile?.elevenlabs_api_key) {
      throw new Error('ElevenLabs API key not configured for this user');
    }

    // Extract the agent ID from the request body
    const requestData = await req.json();
    const { agentId } = requestData;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    // Use the user's ElevenLabs API key
    const apiKey = profile.elevenlabs_api_key;
    
    console.log(`Making request to ElevenLabs API for agent ${agentId}`);
    
    // Make request to ElevenLabs API to get signed URL for conversation
    const response = await fetch(`https://api.elevenlabs.io/v1/conversations/${agentId}/start`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('ElevenLabs API error:', errorData);
      throw new Error(`ElevenLabs API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Successfully obtained conversation URL from ElevenLabs');
    
    return new Response(JSON.stringify({ signed_url: data.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in elevenlabs-signed-url function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        details: error.stack || 'No stack trace available'
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
});
