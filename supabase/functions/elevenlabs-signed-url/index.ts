
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[elevenlabs-signed-url] Starting function");
  
  try {
    // Parse request body and extract agent ID
    const { agentId } = await req.json();
    
    if (!agentId) {
      console.log("[elevenlabs-signed-url] Missing agentId in request");
      return new Response(
        JSON.stringify({ error: "Agent ID is required" }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    console.log(`[elevenlabs-signed-url] Processing request for agent ID: ${agentId}`);
    
    // Authenticate user from the request
    const authHeader = req.headers.get('Authorization');
    console.log("[elevenlabs-signed-url] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    // Extract the token from the Bearer token
    const token = authHeader.replace('Bearer ', '');
    console.log("[elevenlabs-signed-url] Token extracted, length:", token.length);
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log("[elevenlabs-signed-url] User authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    console.log("[elevenlabs-signed-url] User authenticated:", user.id);
    
    // Get the user's ElevenLabs API key from their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('elevenlabs_api_key')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      console.log("[elevenlabs-signed-url] Error fetching user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve user profile" }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    if (!profile.elevenlabs_api_key) {
      console.log("[elevenlabs-signed-url] User does not have an ElevenLabs API key");
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not found in user profile. Please add your API key in your profile settings." }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    console.log("[elevenlabs-signed-url] Retrieved user's ElevenLabs API key");
    
    // Get a signed URL from ElevenLabs
    const elevenlabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": profile.elevenlabs_api_key,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!elevenlabsResponse.ok) {
      const errorData = await elevenlabsResponse.json().catch(() => ({}));
      console.log("[elevenlabs-signed-url] ElevenLabs API error:", 
        elevenlabsResponse.status, 
        elevenlabsResponse.statusText, 
        JSON.stringify(errorData)
      );
      
      let errorMessage = "Failed to get signed URL from ElevenLabs";
      
      // Handle specific error cases
      if (elevenlabsResponse.status === 401) {
        errorMessage = "Invalid ElevenLabs API key. Please update your API key in your profile settings.";
      } else if (elevenlabsResponse.status === 404) {
        errorMessage = `Agent with ID ${agentId} not found. Please verify the agent ID.`;
      } else if (elevenlabsResponse.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (errorData.detail) {
        errorMessage = `ElevenLabs API error: ${errorData.detail}`;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: elevenlabsResponse.status, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    // Process the response
    const data = await elevenlabsResponse.json();
    console.log("[elevenlabs-signed-url] Successfully obtained signed URL");
    
    // Return the signed URL
    return new Response(
      JSON.stringify({ signed_url: data.signed_url }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
    
  } catch (error) {
    console.log("[elevenlabs-signed-url] Error in elevenlabs-signed-url function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
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
