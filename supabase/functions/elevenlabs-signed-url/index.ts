
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
    
    // Call the ElevenLabs API to get a signed URL with improved retry logic
    console.log("[elevenlabs-signed-url] Requesting signed URL for agent:", agent_id);
    
    const maxRetries = 3;
    let currentRetry = 0;
    let elevenlabsResponse;
    let responseOk = false;
    let lastStatusCode = 0;
    let lastErrorDetails = "";
    
    while (currentRetry < maxRetries && !responseOk) {
      try {
        // Use simple URL without adding any query parameters that might interfere
        const url = new URL(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url`);
        url.searchParams.append('agent_id', agent_id);
        
        // Add a random delay to avoid rate limiting with exponential backoff
        const waitTime = currentRetry > 0 ? Math.pow(2, currentRetry - 1) * 500 + Math.random() * 500 : 0;
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        console.log(`[elevenlabs-signed-url] Attempt ${currentRetry + 1}/${maxRetries} - requesting signed URL`);
        
        // Make the request with detailed headers
        elevenlabsResponse = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            "User-Agent": "eXp-RealtorAssistant/1.0",
            "X-Request-ID": `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          },
        });
        
        lastStatusCode = elevenlabsResponse.status;
        responseOk = elevenlabsResponse.ok;
        
        if (!responseOk) {
          // Get more details about the error
          try {
            const errorText = await elevenlabsResponse.text();
            lastErrorDetails = errorText;
            console.warn(`[elevenlabs-signed-url] Attempt ${currentRetry + 1}/${maxRetries} failed with status ${lastStatusCode}: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`);
          } catch (textError) {
            console.warn(`[elevenlabs-signed-url] Attempt ${currentRetry + 1}/${maxRetries} failed with status ${lastStatusCode}, couldn't read error details`);
          }
          
          // Special handling for common error codes
          if (lastStatusCode === 429) {  // Too Many Requests
            console.warn("[elevenlabs-signed-url] Rate limit hit, applying longer backoff");
            await new Promise(resolve => setTimeout(resolve, (currentRetry + 1) * 2000)); // Longer backoff for rate limits
          } else if (lastStatusCode >= 500) {  // Server errors
            currentRetry++;
            if (currentRetry < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
            }
          } else {  // Client errors (4xx)
            // For client errors other than 429, break immediately as retrying won't help
            if (lastStatusCode !== 429) break;
            currentRetry++;
          }
        }
      } catch (fetchError) {
        console.error("[elevenlabs-signed-url] Network error:", fetchError);
        currentRetry++;
        if (currentRetry < maxRetries) {
          // Network errors deserve retries too
          await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
        }
      }
    }
    
    if (!elevenlabsResponse || !responseOk) {
      console.error("[elevenlabs-signed-url] All attempts failed");
      
      // Provide detailed error information based on the status code
      let errorMessage = "Failed to get signed URL from ElevenLabs API";
      
      if (lastStatusCode === 401) {
        errorMessage = "Invalid ElevenLabs API key. Please check your API key in profile settings.";
      } else if (lastStatusCode === 403) {
        errorMessage = "Your ElevenLabs API key doesn't have permission to use Conversational AI.";
      } else if (lastStatusCode === 404) {
        errorMessage = `Agent with ID '${agent_id}' not found. Please check the agent ID.`;
      } else if (lastStatusCode === 429) {
        errorMessage = "ElevenLabs API rate limit exceeded. Please try again in a few minutes.";
      } else if (lastStatusCode >= 500) {
        errorMessage = "ElevenLabs API server error. Please try again later.";
      }
      
      // Include useful error information
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: lastErrorDetails ? lastErrorDetails.substring(0, 500) : 'No additional details available',
          status: lastStatusCode
        }),
        {
          status: lastStatusCode || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Successfully got a response, parse it
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
