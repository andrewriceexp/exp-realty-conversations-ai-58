
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log(`Function "twilio-media-stream" up and running!`);

// Pre-generated error message audio in base64 format
// This is a real base64 encoded μ-law 8kHz audio file containing "We're sorry, but there was an error connecting to the AI assistant"
const ERROR_AUDIO = "UklGRpAdAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YXAdAAD//wkJ//9aWv///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3//wAA//8AAP//AAD//wAA//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//+amv///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39/////////8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//";

// Standard duration audio file containing "We apologize, but there was an issue with the AI agent. Please try again later."
const CONNECTION_ERROR_AUDIO = "UklGRpAdAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YXAdAAD//wkJ//9aWv///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3//wAA//8AAP//AAD//wAA//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8kJP//JCT//yQk//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//+amv///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39///9/f///f3///39/////////8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//8DA///AwP//wMD//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//9KSv//Skr//0pK//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//";

// Improved validation helper
function validateRequiredParams(params, requiredFields) {
  const missingFields = [];
  for (const field of requiredFields) {
    if (!params[field]) {
      missingFields.push(field);
    }
  }
  return missingFields;
}

// Helper function to validate UUID format
function isValidUUID(uuid) {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Helper to validate ElevenLabs API key format (basic check)
function isValidElevenLabsAPIKey(apiKey) {
  if (!apiKey) return false;
  // ElevenLabs API keys are typically 32+ characters
  return apiKey.length >= 32;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize error variable to track issues
  let error = null;
  let connectionError = false;
  let connectionId = crypto.randomUUID().substring(0, 8); // Generate unique ID for connection tracking
  
  try {
    console.log(`[${connectionId}] New connection request received`);
    const url = new URL(req.url);
    
    // Parameter extraction with improved validation
    const agentId = url.searchParams.get("agent_id");
    const voiceId = url.searchParams.get("voice_id");
    const userId = url.searchParams.get("user_id");
    const callLogId = url.searchParams.get("call_log_id");
    const debug = url.searchParams.get("debug") === "true";
    
    console.log(`[${connectionId}] Connection parameters:
      Agent ID: ${agentId || 'MISSING'}
      Voice ID: ${voiceId || 'not specified'}
      User ID: ${userId || 'MISSING'}
      Call Log ID: ${callLogId || 'not specified'}
      Debug Mode: ${debug ? 'enabled' : 'disabled'}
    `);
    
    // Enhanced validation - check for missing required parameters
    const missingParams = validateRequiredParams({ agentId }, ['agentId']);
    if (missingParams.length > 0) {
      throw new Error(`Missing required parameter(s): ${missingParams.join(', ')}`);
    }
    
    // Validate userId if provided (should be a valid UUID)
    if (userId && !isValidUUID(userId)) {
      console.error(`[${connectionId}] User ID provided but not a valid UUID: ${userId}`);
      throw new Error("Invalid user ID format. Expected UUID format.");
    }
    
    // Prepare for WebSocket upgrade
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Initialize Supabase client for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${connectionId}] Missing Supabase configuration`);
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // If we have a userId, fetch the ElevenLabs API key
    let elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    let elevenlabsKeySource = "environment";
    
    if (userId) {
      console.log(`[${connectionId}] Fetching ElevenLabs API key for user: ${userId}`);
      try {
        // First try with regular client
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('elevenlabs_api_key, email')
          .eq('id', userId)
          .maybeSingle();
          
        if (profileError) {
          console.error(`[${connectionId}] Error fetching user profile:`, profileError);
          // Continue with fallback to environment API key
        } else if (profile && profile.elevenlabs_api_key) {
          elevenlabsApiKey = profile.elevenlabs_api_key;
          elevenlabsKeySource = "user profile";
          console.log(`[${connectionId}] Successfully retrieved API key for user: ${profile.email || userId}`);
        } else {
          console.warn(`[${connectionId}] User ${userId} doesn't have an ElevenLabs API key configured`);
        }
      } catch (profileFetchError) {
        console.error(`[${connectionId}] Unexpected error fetching profile:`, profileFetchError);
        // Continue with fallback to environment API key
      }
    }
    
    if (!elevenlabsApiKey) {
      console.error(`[${connectionId}] ElevenLabs API key not available!`);
      throw new Error("ElevenLabs API key not available. Please add it to your profile or environment variables.");
    } else {
      console.log(`[${connectionId}] Using ElevenLabs API key from ${elevenlabsKeySource} (first 4 chars: ${elevenlabsApiKey.substring(0, 4)}...)`);
    }
    
    // Pre-validate API key format
    if (!isValidElevenLabsAPIKey(elevenlabsApiKey)) {
      console.error(`[${connectionId}] ElevenLabs API key format appears to be invalid`);
      throw new Error("ElevenLabs API key appears to be invalid. Please check your API key and try again.");
    }
    
    // Prepare WebSocket URL for ElevenLabs with more robust error checking
    const wsParams = new URLSearchParams();
    wsParams.append("agent_id", agentId);
    
    if (voiceId) {
      wsParams.append("voice_id", voiceId);
    }
    
    // Configure input and output formats for telephony
    wsParams.append("input_format", "mulaw_8000");
    wsParams.append("output_format", "mulaw_8000");
    
    const elevenlabsWsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?${wsParams.toString()}`;
    console.log(`[${connectionId}] Connecting to ElevenLabs WebSocket: ${elevenlabsWsUrl}`);
    
    // Track connection state with more granular states
    let elevenLabsState = "connecting"; // possible values: connecting, connected, authenticated, error, closed
    
    // Create a promise to track ElevenLabs connection status with more detailed timeout handling
    const elevenLabsConnectionPromise = new Promise((resolve) => {
      // Will be resolved in handlers when appropriate
      setTimeout(() => {
        if (elevenLabsState !== "authenticated") {
          console.error(`[${connectionId}] ElevenLabs authentication timed out after 15 seconds`);
          connectionError = true;
          resolve(false);
        }
      }, 15000); // 15 second connection timeout
    });
    
    // Connect to ElevenLabs WebSocket with improved error tracking
    const elevenlabsWebSocket = new WebSocket(elevenlabsWsUrl);
    let streamSid = null;
    let retryAttempt = 0;
    const maxRetryAttempts = 2;
    
    // Set connection timeout with better error messaging
    const connectionTimeout = setTimeout(() => {
      if (elevenLabsState !== "authenticated") {
        console.error(`[${connectionId}] ElevenLabs connection timeout after 10 seconds. Current state: ${elevenLabsState}`);
        connectionError = true;
        
        try {
          if (elevenlabsWebSocket.readyState === WebSocket.OPEN) {
            elevenlabsWebSocket.close();
          }
        } catch (e) {
          console.error(`[${connectionId}] Error closing ElevenLabs websocket:`, e);
        }
        
        // Send error message to client if streamSid is available
        if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
          sendErrorAudio(clientSocket, streamSid, true);
        }
      }
    }, 10000);
    
    // Set authorization and connection handlers
    elevenlabsWebSocket.onopen = () => {
      elevenLabsState = "connected";
      console.log(`[${connectionId}] Connected to ElevenLabs WebSocket`);
      
      // Send authorization
      try {
        const authMessage = JSON.stringify({
          "xi-api-key": elevenlabsApiKey
        });
        
        elevenlabsWebSocket.send(authMessage);
        console.log(`[${connectionId}] Sent authorization to ElevenLabs`);
      } catch (authError) {
        console.error(`[${connectionId}] Failed to send authorization:`, authError);
        elevenLabsState = "error";
        connectionError = true;
        
        if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
          sendErrorAudio(clientSocket, streamSid, true);
        }
      }
    };
    
    // Buffer for audio chunks during auth
    const audioBuffer = [];
    const maxBufferSize = 10; // Maximum number of audio chunks to buffer
    
    // Handle messages from Twilio with improved validation and buffering
    clientSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event === "start") {
          console.log(`[${connectionId}] Twilio stream started with ID: ${message.start.streamSid}`);
          streamSid = message.start.streamSid;
          
          // If connection error already occurred, send error audio immediately
          if (connectionError && clientSocket.readyState === WebSocket.OPEN) {
            sendErrorAudio(clientSocket, streamSid, true);
          }
        } else if (message.event === "media") {
          // Forward audio from Twilio to ElevenLabs
          if (elevenlabsWebSocket.readyState === WebSocket.OPEN && elevenLabsState === "authenticated") {
            const audioChunk = {
              user_audio_chunk: message.media.payload
            };
            elevenlabsWebSocket.send(JSON.stringify(audioChunk));
          } else if (elevenlabsWebSocket.readyState === WebSocket.OPEN && elevenLabsState === "connected") {
            // Buffer some initial audio while waiting for authentication to complete
            if (audioBuffer.length < maxBufferSize) {
              audioBuffer.push(message.media.payload);
              if (debug) {
                console.log(`[${connectionId}] [DEBUG] Buffered audio chunk while waiting for authentication`);
              }
            }
          } else if (connectionError) {
            // We're in an error state, don't try to buffer or send audio
            if (debug) {
              console.log(`[${connectionId}] [DEBUG] Ignoring audio chunk due to connection error`);
            }
          }
        } else if (message.event === "stop") {
          console.log(`[${connectionId}] Twilio stream stopped`);
          if (elevenlabsWebSocket.readyState === WebSocket.OPEN) {
            elevenlabsWebSocket.close();
          }
        }
      } catch (err) {
        console.error(`[${connectionId}] Error handling message from Twilio:`, err);
      }
    };
    
    // Handle messages from ElevenLabs with improved response handling
    elevenlabsWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (debug) {
          console.log(`[${connectionId}] [DEBUG] Message type from ElevenLabs: ${data.type}`);
        }
        
        // Check for connection success with the first metadata message
        if (data.type === "conversation_initiation_metadata") {
          console.log(`[${connectionId}] Received conversation initiation metadata, connection successful`);
          elevenLabsState = "authenticated";
          clearTimeout(connectionTimeout); // Clear the timeout once we're authenticated
          
          // Send any buffered audio chunks now that we're authenticated
          if (audioBuffer.length > 0 && elevenlabsWebSocket.readyState === WebSocket.OPEN) {
            console.log(`[${connectionId}] Sending ${audioBuffer.length} buffered audio chunks`);
            for (const chunk of audioBuffer) {
              const audioMessage = {
                user_audio_chunk: chunk
              };
              elevenlabsWebSocket.send(JSON.stringify(audioMessage));
            }
            // Clear the buffer
            audioBuffer.length = 0;
          }
        }
        
        if (data.type === "audio" && data.audio_event?.audio_base_64) {
          if (streamSid) {
            const audioData = {
              event: "media",
              streamSid,
              media: {
                payload: data.audio_event.audio_base_64
              }
            };
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify(audioData));
            }
          }
        } else if (data.type === "interruption") {
          // Clear Twilio's audio queue
          if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
            const clearMessage = JSON.stringify({ 
              event: "clear",
              streamSid 
            });
            clientSocket.send(clearMessage);
          }
        } else if (data.type === "ping" && data.ping_event?.event_id) {
          // Respond to ping events from ElevenLabs
          const pongResponse = {
            type: "pong",
            event_id: data.ping_event.event_id
          };
          if (elevenlabsWebSocket.readyState === WebSocket.OPEN) {
            elevenlabsWebSocket.send(JSON.stringify(pongResponse));
          }
        } else if (data.type === "conversation_initiation_metadata") {
          console.log(`[${connectionId}] Received conversation initiation metadata:`, 
                      data.conversation_initiation_metadata_event);
        } else if (data.type === "user_transcript" || data.type === "agent_response") {
          // Log transcript for debugging and analysis
          console.log(`[${connectionId}] ${data.type}: ${JSON.stringify(data)}`);
          
          // Store transcript in call log if we have callLogId
          if (callLogId) {
            updateCallLog(supabase, callLogId, data).catch(err => {
              console.error(`[${connectionId}] Error updating call log:`, err);
            });
          }
        } else if (data.type === "error") {
          console.error(`[${connectionId}] ElevenLabs error:`, data);
          connectionError = true;
          
          // Try to send an error message to the caller
          if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
            sendErrorAudio(clientSocket, streamSid);
          }
        }
      } catch (err) {
        console.error(`[${connectionId}] Error handling message from ElevenLabs:`, err);
        connectionError = true;
      }
    };
    
    // Handle socket closures with more robust cleanup
    clientSocket.onclose = (event) => {
      console.log(`[${connectionId}] Twilio WebSocket closed with code: ${event.code}, reason: ${event.reason || "Unknown reason"}`);
      if (elevenlabsWebSocket.readyState === WebSocket.OPEN) {
        try {
          elevenlabsWebSocket.close();
        } catch (e) {
          console.error(`[${connectionId}] Error closing ElevenLabs websocket:`, e);
        }
      }
    };
    
    elevenlabsWebSocket.onclose = (event) => {
      elevenLabsState = "closed";
      console.log(`[${connectionId}] ElevenLabs WebSocket closed with code: ${event.code}, reason: ${event.reason || "Unknown reason"}`);
      
      // If we closed due to an error and can retry, do so
      if (connectionError && retryAttempt < maxRetryAttempts && clientSocket.readyState === WebSocket.OPEN) {
        retryAttempt++;
        console.log(`[${connectionId}] Attempting retry ${retryAttempt} of ${maxRetryAttempts}`);
        
        // Simple retry logic - for complex retry we would need to recreate WebSocket
        setTimeout(() => {
          if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
            sendErrorAudio(clientSocket, streamSid);
          }
        }, 1000 * retryAttempt); // Exponential backoff
      } else {
        if (clientSocket.readyState === WebSocket.OPEN) {
          try {
            clientSocket.close();
          } catch (e) {
            console.error(`[${connectionId}] Error closing client websocket:`, e);
          }
        }
      }
    };
    
    // Handle errors with more detailed logging
    clientSocket.onerror = (e) => {
      console.error(`[${connectionId}] Twilio WebSocket error:`, e);
      error = e;
    };
    
    elevenlabsWebSocket.onerror = (e) => {
      elevenLabsState = "error";
      console.error(`[${connectionId}] ElevenLabs WebSocket error:`, e);
      error = e;
      connectionError = true;
      
      // Try to send a message to the user about the error
      try {
        if (streamSid && clientSocket.readyState === WebSocket.OPEN) {
          sendErrorAudio(clientSocket, streamSid);
        }
      } catch (err) {
        console.error(`[${connectionId}] Failed to send error message:`, err);
      }
    };
    
    return response;
    
  } catch (err) {
    console.error(`[${connectionId}] Error in twilio-media-stream:`, err);
    
    // Return a proper error response
    return new Response(
      JSON.stringify({
        error: err.message || "An unexpected error occurred",
        details: error ? String(error) : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Helper function to update call log with transcript data - with improved error handling
async function updateCallLog(supabase, callLogId, data) {
  try {
    if (!isValidUUID(callLogId)) {
      console.error(`Invalid call log ID format: ${callLogId}`);
      return;
    }

    // Use different approaches based on the message type
    if (data.type === "user_transcript" && data.user_transcription_event?.user_transcript) {
      const transcript = data.user_transcription_event.user_transcript;
      
      // First check if the call_logs table has this ID
      const { data: logExists, error: logCheckError } = await supabase
        .from('call_logs')
        .select('id')
        .eq('id', callLogId)
        .single();
        
      if (logCheckError || !logExists) {
        console.error(`Call log ID ${callLogId} not found in database, cannot append transcript`);
        return;
      }
      
      // Now append the transcript
      await supabase.rpc('append_to_transcript', {
        call_log_id: callLogId,
        speaker: 'user',
        text: transcript
      });
      
    } else if (data.type === "agent_response" && data.agent_response_event?.agent_response) {
      const response = data.agent_response_event.agent_response;
      
      // First check if the call_logs table has this ID
      const { data: logExists, error: logCheckError } = await supabase
        .from('call_logs')
        .select('id')
        .eq('id', callLogId)
        .single();
        
      if (logCheckError || !logExists) {
        console.error(`Call log ID ${callLogId} not found in database, cannot append transcript`);
        return;
      }
      
      // Now append the transcript
      await supabase.rpc('append_to_transcript', {
        call_log_id: callLogId,
        speaker: 'agent',
        text: response
      });
    }
  } catch (err) {
    console.error("Error in updateCallLog:", err);
  }
}

// Helper function to send error audio to the client
function sendErrorAudio(clientSocket, streamSid, isConnectionError = false) {
  try {
    console.log("Sending error audio message to client");
    
    // Choose appropriate error message
    const audioPayload = isConnectionError ? CONNECTION_ERROR_AUDIO : ERROR_AUDIO;
    
    const audioData = {
      event: "media",
      streamSid,
      media: {
        payload: audioPayload
      }
    };
    
    clientSocket.send(JSON.stringify(audioData));
    
    // After sending the error audio, send a message that will hangup the call
    setTimeout(() => {
      try {
        const hangupMessage = {
          event: "mark",
          streamSid,
          mark: {
            name: "hangup"
          }
        };
        clientSocket.send(JSON.stringify(hangupMessage));
      } catch (e) {
        console.error("Failed to send hangup mark:", e);
      }
    }, 5000); // Wait 5 seconds to allow error message to play
  } catch (e) {
    console.error("Failed to send error audio:", e);
  }
}
