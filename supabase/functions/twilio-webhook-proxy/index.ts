
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log(`Function "twilio-webhook-proxy" up and running!`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get URL parameters from the incoming request
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");
    const voiceId = url.searchParams.get("voice_id");
    const userId = url.searchParams.get("user_id");
    const debug = url.searchParams.get("debug");
    const callLogId = url.searchParams.get("call_log_id");
    
    // Get the Supabase project reference from environment variables
    const supabaseProjectRef = Deno.env.get("SUPABASE_PROJECT_REF") || "uttebgyhijrdcjiczxrg";
    
    // Construct the proper URL for the Supabase edge function
    const targetUrl = `https://${supabaseProjectRef}.supabase.co/functions/v1/twilio-call-webhook`;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (agentId) params.append("agent_id", agentId);
    if (voiceId) params.append("voice_id", voiceId);
    if (userId) params.append("user_id", userId);
    if (callLogId) params.append("call_log_id", callLogId);
    if (debug) params.append("debug", debug);
    
    const fullUrl = `${targetUrl}?${params.toString()}`;
    console.log(`Proxying request to: ${fullUrl}`);
    
    // Parse form data from Twilio's request (if present)
    let formData = null;
    let twilioParams = {};
    
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        formData = await req.formData();
        for (const [key, value] of formData.entries()) {
          twilioParams[key] = value;
        }
        console.log("Received Twilio parameters:", JSON.stringify(twilioParams).substring(0, 100) + "...");
      } else if (contentType.includes("application/json")) {
        twilioParams = await req.json();
        console.log("Received JSON parameters:", JSON.stringify(twilioParams).substring(0, 100) + "...");
      }
    } catch (error) {
      console.warn("Error parsing request data:", error.message);
    }
    
    // Create a new request to forward to the actual function
    const headers = new Headers();
    headers.set("Content-Type", req.headers.get("content-type") || "application/x-www-form-urlencoded");
    
    // CRITICAL FIX: Set the required x-deno-subhost header
    headers.set("x-deno-subhost", supabaseProjectRef);
    
    // CRITICAL FIX: Add explicit authorization header 
    headers.set("Authorization", "Bearer " + Deno.env.get("SUPABASE_ANON_KEY"));
    
    // Copy any Twilio signature headers if present (could be under different case variations)
    const twilioSignature = req.headers.get("twilio-signature") || 
                           req.headers.get("X-Twilio-Signature") || 
                           req.headers.get("x-twilio-signature");
    
    if (twilioSignature) {
      console.log("Found Twilio signature, forwarding it");
      headers.set("twilio-signature", twilioSignature);
      headers.set("X-Twilio-Signature", twilioSignature);
    }
    
    // Copy any other authorization headers if present
    const authHeader = req.headers.get("authorization");
    if (authHeader) headers.set("authorization", authHeader);
    
    // Forward the request with the appropriate method, headers, and body
    let forwardBody;
    
    if (formData) {
      // Recreate form data to forward
      const newFormData = new FormData();
      for (const [key, value] of Object.entries(twilioParams)) {
        newFormData.append(key, value);
      }
      forwardBody = newFormData;
    } else if (Object.keys(twilioParams).length > 0) {
      // Forward JSON or other body types
      forwardBody = JSON.stringify(twilioParams);
    } else {
      // Try to handle any other possible content
      try {
        forwardBody = await req.text();
      } catch (error) {
        console.warn("Error reading request body:", error.message);
        forwardBody = null;
      }
    }
    
    console.log(`Forwarding ${req.method} request to ${fullUrl}`);
    console.log(`Headers: ${[...headers.entries()].map(([k, v]) => `${k}=${v.substring(0, 20)}...`).join(', ')}`);
    
    const response = await fetch(fullUrl, {
      method: req.method,
      headers: headers,
      body: forwardBody
    });
    
    // Get the response data and headers
    const responseData = await response.text();
    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", response.headers.get("Content-Type") || "application/xml");
    
    console.log(`Proxy received response with status: ${response.status}`);
    if (response.status !== 200) {
      console.error(`Error from target function: ${responseData}`);
    }
    
    // Return the response from the target function
    return new Response(responseData, {
      status: response.status,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error("Error in twilio-webhook-proxy:", error);
    
    // Return a basic TwiML response in case of error
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>We're sorry, but an error occurred with the proxy. Please check the function logs.</Say>
        <Hangup/>
      </Response>`;
      
    return new Response(errorTwiML, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml"
      }
    });
  }
});
