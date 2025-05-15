
// Import required packages
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function \"twilio-webhook-proxy\" up and running!");

serve(async (req) => {
  try {
    // Handle OPTIONS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Get query parameters from the request URL
    const url = new URL(req.url);
    const queryParams = url.searchParams.toString();
    
    // Get the request body
    let body: string;
    try {
      body = await req.text();
    } catch (error) {
      console.error("Error reading request body:", error);
      body = "";
    }
    
    // Parse Twilio parameters for logging
    try {
      const formData = new URLSearchParams(body);
      const twilioParams = Object.fromEntries(formData.entries());
      console.log("Received Twilio parameters:", JSON.stringify(twilioParams).substring(0, 200) + "...");
    } catch (error) {
      console.error("Error parsing Twilio parameters:", error);
    }

    // Determine target endpoint - usually twilio-call-webhook unless it's the media stream
    const pathSegments = url.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    let targetEndpoint = "twilio-call-webhook";
    if (lastSegment === "media-stream" || lastSegment === "twilio-media-stream") {
      targetEndpoint = "twilio-media-stream";
      console.log("Detected media stream request, forwarding to twilio-media-stream");
    }
    
    // Construct the target URL
    const targetUrl = `${url.protocol}//${url.hostname}/functions/v1/${targetEndpoint}?${queryParams}`;
    console.log("Proxying request to:", targetUrl);

    // Check for Twilio signature headers and forward them
    const twilioSignatureHeadersToForward = [];
    for (const [key, value] of req.headers.entries()) {
      if (key.toLowerCase().includes("twilio-signature")) {
        twilioSignatureHeadersToForward.push([key, value]);
      }
    }
    
    if (twilioSignatureHeadersToForward.length > 0) {
      console.log(`Found ${twilioSignatureHeadersToForward.length} Twilio signature header(s), forwarding them`);
    }

    // Create new headers for the request to the target endpoint
    const headers = new Headers();
    
    // Forward content type
    if (req.headers.has("content-type")) {
      headers.set("content-type", req.headers.get("content-type")!);
    }
    
    // Forward Twilio signature headers
    for (const [key, value] of twilioSignatureHeadersToForward) {
      headers.set(key, value);
    }

    // If we have Supabase anon key, set it to authenticate with the target endpoint
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (supabaseAnonKey) {
      console.log("Found SUPABASE_ANON_KEY, setting Authorization header");
      headers.set("Authorization", `Bearer ${supabaseAnonKey}`);
    }

    // Forward WebSocket-related headers for media stream
    if (targetEndpoint === "twilio-media-stream") {
      for (const header of ["upgrade", "connection", "sec-websocket-key", "sec-websocket-version", "sec-websocket-extensions"]) {
        const value = req.headers.get(header);
        if (value) {
          console.log(`Forwarding WebSocket header: ${header}`);
          headers.set(header, value);
        }
      }
    }

    // Log what headers we're forwarding
    const headersLog = Array.from(headers.entries()).map(([key, value]) => 
      `${key}=${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`
    ).join(', ');
    console.log("Headers:", headersLog);

    // Make the request to the target endpoint
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body
    });

    console.log("Proxy received response with status:", response.status);

    // Return the response from the target endpoint
    if (response.status === 101) {
      // Handle WebSocket upgrade specially
      console.log("Successfully received WebSocket upgrade response (101), forwarding as-is");
      return response;
    } else {
      // For regular responses
      const responseHeaders = new Headers(response.headers);
      
      // Ensure CORS headers are set in the response
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }
      
      const responseBody = await response.text();
      console.log("Successfully forwarded request and received", response.status, "response");
      
      return new Response(responseBody, {
        status: response.status,
        headers: responseHeaders
      });
    }
  } catch (error) {
    console.error("Error proxying request:", error);
    return new Response(`Error proxying request: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
