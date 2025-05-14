
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, userId } = await req.json();
    
    if (!conversationId) {
      throw new Error("Conversation ID is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseAdminKey) {
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseAdminKey);

    // Construct the query based on available parameters
    let query = supabase
      .from('call_logs')
      .select('*')
      .eq('conversation_id', conversationId);
      
    // If userId provided, add it to the query for security
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    // Execute the query with proper ordering
    const { data: logs, error } = await query.order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Fetch transcript data from ElevenLabs API if available
    // This would require additional implementation and API key access
    
    return new Response(
      JSON.stringify({
        success: true,
        logs,
        message: logs?.length ? `Found ${logs.length} log entries` : "No logs found"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error fetching conversation logs:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "Failed to fetch conversation logs"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
