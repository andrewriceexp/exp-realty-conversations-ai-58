
// Supabase Edge Function to check the status of a Twilio call
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { callSid } = await req.json();
    
    if (!callSid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Missing call SID" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Initialize Supabase clients
    console.log("Initializing Supabase clients");
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Look up the call log using the Twilio call SID
    console.log(`Looking up call log for SID: ${callSid}`);
    
    const { data: callLogData, error: callLogError } = await supabaseAdmin
      .from("call_logs")
      .select("*")
      .eq("twilio_call_sid", callSid)
      .single();
      
    if (callLogError) {
      console.error("Error fetching call log:", callLogError);
      throw callLogError;
    }
    
    if (!callLogData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Call log not found" 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    return new Response(
      JSON.stringify(callLogData),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in twilio-call-status:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "An error occurred while checking call status" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
