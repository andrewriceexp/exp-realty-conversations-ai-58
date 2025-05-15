
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log("[elevenlabs-voices] Function initialized");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[elevenlabs-voices] Starting function");
    
    // Get the authenticated user
    const auth = req.headers.get('Authorization');
    if (!auth) {
      console.error("[elevenlabs-voices] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.info("[elevenlabs-voices] No request body or invalid JSON");
      body = {}; // Set to empty object if parsing fails
    }
    
    const validateOnly = body?.validate_only === true;
    
    // Get the user's ElevenLabs API key
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
    
    let apiKey;
    
    // Extract JWT token without the "Bearer " prefix
    const token = auth.replace("Bearer ", "");
    
    // Verify the token and get the user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error("[elevenlabs-voices] Authentication error:", userError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get the user's profile with the API key
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("elevenlabs_api_key")
      .eq("id", userData.user.id)
      .single();
    
    if (profileError || !profileData) {
      console.error("[elevenlabs-voices] Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve user profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    apiKey = profileData.elevenlabs_api_key;
    
    if (!apiKey) {
      console.error("[elevenlabs-voices] No API key found in profile");
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not found in user profile" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // For validation-only requests, we'll make a simple API call to test the key
    if (validateOnly) {
      console.log("[elevenlabs-voices] Validation-only request");
      const testUrl = "https://api.elevenlabs.io/v1/user/subscription";
      const validationResponse = await fetch(testUrl, {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        }
      });
      
      if (!validationResponse.ok) {
        console.error("[elevenlabs-voices] API key validation failed:", validationResponse.status, validationResponse.statusText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `API key validation failed: ${validationResponse.status} ${validationResponse.statusText}` 
          }),
          {
            status: validationResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log("[elevenlabs-voices] API key validated successfully");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "API key validated successfully" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // For regular requests, fetch the voices list
    console.log("[elevenlabs-voices] Fetching voices from ElevenLabs API");
    const elevenlabsResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
    
    if (!elevenlabsResponse.ok) {
      console.error("[elevenlabs-voices] ElevenLabs API error:", elevenlabsResponse.status, elevenlabsResponse.statusText);
      return new Response(
        JSON.stringify({ 
          error: `ElevenLabs API error: ${elevenlabsResponse.status} ${elevenlabsResponse.statusText}` 
        }),
        {
          status: elevenlabsResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const data = await elevenlabsResponse.json();
    console.log("[elevenlabs-voices] Successfully fetched", data.voices?.length || 0, "voices");
    
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[elevenlabs-voices] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
