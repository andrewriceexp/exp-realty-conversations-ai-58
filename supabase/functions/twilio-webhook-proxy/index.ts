
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
    
    // Determine target endpoint - usually twilio-call-webhook unless it's the media stream
    const pathSegments = url.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    let targetEndpoint = "twilio-call-webhook";
    if (lastSegment === "media-stream" || lastSegment === "twilio-media-stream") {
      targetEndpoint = "twilio-media-stream";
      console.log("WebSocket request detected, forwarding to twilio-media-stream");
    }
    
    // Construct the target URL
    const targetUrl = `${url.protocol}//${url.hostname}/functions/v1/${targetEndpoint}?${queryParams}`;
    console.log("Proxying request to:", targetUrl);

    // Create new headers for the request to the target endpoint
    const headers = new Headers();
    
    // Forward content type
    if (req.headers.has("content-type")) {
      headers.set("content-type", req.headers.get("content-type")!);
    }
    
    // Forward all WebSocket-related headers - this is critical for the handshake
    const headersToForward = [
      "upgrade", 
      "connection", 
      "sec-websocket-key", 
      "sec-websocket-version", 
      "sec-websocket-extensions", 
      "sec-websocket-protocol",
      "twilio-signature",
      "x-twilio-signature"
    ];
    
    for (const header of headersToForward) {
      const value = req.headers.get(header);
      if (value) {
        console.log(`Forwarding header: ${header}=${value}`);
        headers.set(header, value);
      }
    }

    // If we have Supabase anon key, set it to authenticate with the target endpoint
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (supabaseAnonKey) {
      headers.set("Authorization", `Bearer ${supabaseAnonKey}`);
    }
    
    // Make the request to the target endpoint
    console.log("Making request to target with WebSocket headers:", targetUrl);
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body
    });

    console.log("Received response with status:", response.status);
    
    // For WebSocket upgrade, we need to return the response directly
    if (response.status === 101 || req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      console.log("WebSocket upgrade detected, forwarding response directly");
      return response;
    } 
    
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
  } catch (error) {
    console.error("Error proxying request:", error);
    return new Response(`Error proxying request: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
