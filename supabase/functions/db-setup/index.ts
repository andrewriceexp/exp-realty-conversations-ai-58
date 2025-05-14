
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

console.log(`Function "db-setup" up and running!`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseAdminKey) {
      throw new Error("Missing Supabase configuration. Please check your environment variables.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseAdminKey);
    
    // Create the append_to_transcript function if it doesn't exist
    const { error: functionError } = await supabase.rpc('create_append_transcript_function');
    
    if (functionError) {
      console.error("Error creating append_to_transcript function:", functionError);
      
      // Create the function manually
      const { error: sqlError } = await supabase.auth.admin.executeRaw(`
        CREATE OR REPLACE FUNCTION public.append_to_transcript(
          call_log_id UUID,
          speaker TEXT,
          text TEXT
        ) RETURNS TEXT
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          current_transcript TEXT;
          new_transcript TEXT;
        BEGIN
          -- Get the current transcript
          SELECT transcript INTO current_transcript FROM public.call_logs WHERE id = call_log_id;
          
          -- Build new transcript
          IF current_transcript IS NULL OR current_transcript = '' THEN
            new_transcript := speaker || ': ' || text;
          ELSE
            new_transcript := current_transcript || E'\n\n' || speaker || ': ' || text;
          END IF;
          
          -- Update the call log
          UPDATE public.call_logs SET transcript = new_transcript WHERE id = call_log_id;
          
          RETURN new_transcript;
        END;
        $$;
      `);
      
      if (sqlError) {
        throw new Error(`Failed to create SQL function: ${sqlError.message}`);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Database setup completed successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("Error in db-setup:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "An error occurred during database setup"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
