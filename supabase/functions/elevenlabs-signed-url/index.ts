
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
    const supabaseClient = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") 
      ? Deno.createClient(
          Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        )
      : null;
    
    let apiKey;
    
    if (supabaseClient) {
      // Extract JWT token without the "Bearer " prefix
      const token = auth.replace("Bearer ", "");
      
      // Verify the token and get the user
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (userError || !userData.user) {
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
      const { data: profileData, error: profileError } = await supabaseClient
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
    } else {
      // Use the fallback API key from environment variables if Supabase client couldn't be created
      apiKey = Deno.env.get("ELEVENLABS_API_KEY");
      
      if (!apiKey) {
        console.error("[elevenlabs-signed-url] ElevenLabs API key not configured in environment");
        return new Response(
          JSON.stringify({ error: "ElevenLabs API key not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Call the ElevenLabs API to get a signed URL
    console.log("[elevenlabs-signed-url] Requesting signed URL for agent:", agent_id);
    const elevenlabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agent_id}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!elevenlabsResponse.ok) {
      console.error("[elevenlabs-signed-url] ElevenLabs API error:", 
        elevenlabsResponse.status, 
        elevenlabsResponse.statusText);
      
      try {
        const errorText = await elevenlabsResponse.text();
        console.error("[elevenlabs-signed-url] Error response body:", errorText);
      } catch (e) {
        console.error("[elevenlabs-signed-url] Could not read error response body");
      }
      
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

// Helper to create Supabase client (this is a mock implementation as Deno.createClient doesn't exist)
// In the actual implementation, you'd use the Supabase JS client
declare global {
  interface Deno {
    createClient(url: string, key: string): any;
    env: {
      get(key: string): string | undefined;
    };
  }
}
