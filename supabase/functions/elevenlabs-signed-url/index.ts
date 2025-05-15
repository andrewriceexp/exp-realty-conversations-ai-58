
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log("[elevenlabs-signed-url] Function initialized");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[elevenlabs-signed-url] Starting function");
    
    // Get the authenticated user
    const auth = req.headers.get('Authorization');
    if (!auth) {
      console.error("[elevenlabs-signed-url] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get request parameters
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("[elevenlabs-signed-url] Error parsing request body", error);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { agent_id } = body;
    
    if (!agent_id) {
      console.error("[elevenlabs-signed-url] Missing agentId in request");
      return new Response(
        JSON.stringify({ error: "Missing agent_id parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get the user's ElevenLabs API key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[elevenlabs-signed-url] Missing Supabase configuration");
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
      console.error("[elevenlabs-signed-url] Authentication error:", userError);
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
      console.error("[elevenlabs-signed-url] Profile fetch error:", profileError);
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
      console.error("[elevenlabs-signed-url] ElevenLabs API key not found in user profile");
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not found in user profile" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Call the ElevenLabs API to get a signed URL with retry logic
    console.log("[elevenlabs-signed-url] Requesting signed URL for agent:", agent_id);
    
    const maxRetries = 3;
    let currentRetry = 0;
    let elevenlabsResponse;
    let responseOk = false;
    
    while (currentRetry < maxRetries && !responseOk) {
      try {
        // Add input_format and output_format to the query parameters
        const url = new URL(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url`);
        url.searchParams.append('agent_id', agent_id);
        
        elevenlabsResponse = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });
        
        responseOk = elevenlabsResponse.ok;
        if (!responseOk) {
          console.warn(`[elevenlabs-signed-url] Attempt ${currentRetry + 1}/${maxRetries} failed with status ${elevenlabsResponse.status}`);
          // Only retry on server errors (5xx), not client errors (4xx)
          if (elevenlabsResponse.status >= 500) {
            currentRetry++;
            if (currentRetry < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry)); // Exponential backoff
            }
          } else {
            // For 4xx errors, break immediately
            break;
          }
        }
      } catch (fetchError) {
        console.error("[elevenlabs-signed-url] Fetch error:", fetchError);
        currentRetry++;
        if (currentRetry < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
        }
      }
    }
    
    if (!elevenlabsResponse || !responseOk) {
      console.error("[elevenlabs-signed-url] All attempts failed");
      
      // Provide detailed error information
      let errorDetails = "Unknown error";
      if (elevenlabsResponse) {
        try {
          const errorBody = await elevenlabsResponse.text();
          console.error("[elevenlabs-signed-url] Error response body:", errorBody);
          errorDetails = errorBody;
        } catch (e) {
          console.error("[elevenlabs-signed-url] Could not read error response body");
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: `ElevenLabs API error: ${elevenlabsResponse?.status} ${elevenlabsResponse?.statusText}`,
          details: errorDetails
        }),
        {
          status: elevenlabsResponse?.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const data = await elevenlabsResponse.json();
    if (!data.signed_url) {
      console.error("[elevenlabs-signed-url] No signed URL in response:", data);
      return new Response(
        JSON.stringify({ error: "Invalid response from ElevenLabs API" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("[elevenlabs-signed-url] Successfully obtained signed URL");
    
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[elevenlabs-signed-url] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
