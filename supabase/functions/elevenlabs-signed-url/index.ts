
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logDetailed = (message, data = {}) => {
  console.log(`[elevenlabs-signed-url] ${message}`, typeof data === 'object' ? JSON.stringify(data) : data);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract the auth token from the request
    const authHeader = req.headers.get('Authorization');
    logDetailed(`Auth header present: ${!!authHeader}`);
    
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    // Validate the token format
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header must be in Bearer token format');
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('Empty token provided');
    }
    
    logDetailed(`Token extracted, length: ${token.length}`);

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
      logDetailed("User authentication error:", userError);
      throw new Error(`Unauthorized: ${userError.message}`);
    }
    
    if (!user) {
      logDetailed("No user found in authentication");
      throw new Error('Unauthorized: No user found');
    }
    
    logDetailed("User authenticated:", { userId: user.id, email: user.email });

    // Create a service role client to bypass RLS
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch the user's profile to get their ElevenLabs API key
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('elevenlabs_api_key')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      logDetailed("Profile fetch error:", profileError);
      throw new Error(`Failed to retrieve user profile: ${profileError.message}`);
    }

    if (!profile?.elevenlabs_api_key) {
      logDetailed("No ElevenLabs API key found for user:", { userId: user.id });
      throw new Error('ElevenLabs API key not configured for this user');
    }

    // Extract the agent ID from the request body
    let agentId;
    try {
      const requestData = await req.json();
      agentId = requestData.agentId;
      logDetailed("Received agentId:", agentId);
    } catch (err) {
      logDetailed("Error parsing request body:", err);
      throw new Error('Invalid request body format or missing agentId');
    }
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    // Use the user's ElevenLabs API key
    const apiKey = profile.elevenlabs_api_key;
    
    logDetailed(`Making request to ElevenLabs API for agent ${agentId}`);
    
    // Make request to ElevenLabs API to get signed URL for conversation
    const response = await fetch(`https://api.elevenlabs.io/v1/conversations/${agentId}/start`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { raw: errorText };
      }
      
      logDetailed('ElevenLabs API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      throw new Error(`ElevenLabs API error (${response.status}): ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    logDetailed('Successfully obtained conversation URL from ElevenLabs:', { urlReceived: !!data.url });
    
    return new Response(JSON.stringify({ signed_url: data.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logDetailed('Error in elevenlabs-signed-url function:', error);
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
