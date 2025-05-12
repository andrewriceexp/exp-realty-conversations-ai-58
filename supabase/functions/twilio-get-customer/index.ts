
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Twilio } from "https://esm.sh/twilio@4.20.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { twilio_customer_id, userId } = await req.json();
    
    // Validate inputs
    if (!twilio_customer_id || !userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Fetch user's Twilio credentials from the database
    const supabaseClient = Deno.env.get('SUPABASE_URL') 
      ? (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_ANON_KEY') || '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
      : null;
    
    if (!supabaseClient) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Supabase client initialization failed' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('twilio_account_sid, twilio_auth_token')
      .eq('id', userId)
      .single();
      
    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to retrieve Twilio credentials' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { twilio_account_sid, twilio_auth_token } = profileData;
    
    if (!twilio_account_sid || !twilio_auth_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twilio credentials not configured' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Initialize Twilio client
    const twilio = new Twilio(twilio_account_sid, twilio_auth_token);
    
    // Get service SID - we need to find which service to use
    const services = await twilio.sync.v1.services.list({ limit: 20 });
    const service = services.find(s => s.friendlyName === 'CustomerDataService');
    
    if (!service) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twilio Sync service not found' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Retrieve the customer document
    try {
      const document = await twilio.sync.v1
        .services(service.sid)
        .documents(`customer_${twilio_customer_id}`)
        .fetch();
      
      // Parse the document data (customer information)
      const customerData = document.data;
      
      return new Response(
        JSON.stringify(customerData),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (error) {
      console.error('Error retrieving customer document:', error);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Customer data not found' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error retrieving customer from Twilio:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
