
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

console.log("[elevenlabs-voices] Function initialized");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[elevenlabs-voices] Starting function");
    
    // Get request parameters
    let validate_only = false;
    let voice_id = null;
    
    try {
      const body = await req.json();
      validate_only = !!body.validate_only;
      voice_id = body.voice_id || null;
    } catch (error) {
      // If the request has no body or invalid JSON, continue with defaults
      console.log("[elevenlabs-voices] No request body or invalid JSON");
    }
    
    // Initialize Supabase client with proper environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[elevenlabs-voices] Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authenticated user
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Extract JWT token without the "Bearer " prefix
    const token = auth.replace("Bearer ", "");
    
    // Verify the token and get the user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get the user's profile with the ElevenLabs API key
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("elevenlabs_api_key")
      .eq("id", userData.user.id)
      .single();
    
    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve user profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const apiKey = profileData.elevenlabs_api_key;
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not found in user profile" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Validation-only mode
    if (validate_only) {
      console.log("[elevenlabs-voices] Validation-only request");
      
      // Check if the API key is valid by accessing user subscription
      try {
        const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[elevenlabs-voices] API key validation failed:", errorText);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `API key validation failed: ${response.status} ${response.statusText}` 
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        console.log("[elevenlabs-voices] API key validated successfully");
        return new Response(
          JSON.stringify({ success: true, message: "API key is valid" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("[elevenlabs-voices] API key validation error:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `API key validation error: ${error.message}` 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Get voices from ElevenLabs
    try {
      const url = voice_id 
        ? `https://api.elevenlabs.io/v1/voices/${voice_id}` 
        : "https://api.elevenlabs.io/v1/voices";
      
      const response = await fetch(url, {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[elevenlabs-voices] Failed to fetch voices:", errorText);
        
        return new Response(
          JSON.stringify({ 
            error: `Failed to fetch voices: ${response.status} ${response.statusText}` 
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      const data = await response.json();
      return new Response(
        JSON.stringify(data),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("[elevenlabs-voices] Error fetching voices:", error);
      return new Response(
        JSON.stringify({ error: `Error fetching voices: ${error.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
  } catch (error) {
    console.error("[elevenlabs-voices] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
