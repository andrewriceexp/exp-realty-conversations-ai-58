
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId } = await req.json();
    
    if (!conversationId) {
      throw new Error("Conversation ID is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseAdminKey) {
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseAdminKey);

    // Fetch conversation logs
    const { data: logs, error } = await supabase
      .from('call_logs')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        logs
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
