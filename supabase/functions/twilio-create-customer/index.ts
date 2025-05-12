
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
    const { customerData, userId } = await req.json();
    
    // Validate inputs
    if (!customerData || !userId) {
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
    
    // Create a 'customer' in Twilio
    // Note: Twilio doesn't have a built-in 'customer' concept, so we'll use custom user attributes
    // This uses Twilio Sync, which allows storing custom data
    // Alternatively, you could use another Twilio product or even a third-party service
    const serviceSid = await createOrGetSyncService(twilio);
    
    // Generate a unique ID for this customer
    const customerId = crypto.randomUUID();
    
    // Create a document in Sync with customer data
    const document = await twilio.sync.v1
      .services(serviceSid)
      .documents
      .create({
        uniqueName: `customer_${customerId}`,
        data: customerData,
      });
    
    console.log(`Created Twilio customer with ID: ${customerId}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        twilio_customer_id: customerId,
        sync_document_sid: document.sid
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error creating customer in Twilio:', error);
    
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

// Helper function to create or get a Sync Service
async function createOrGetSyncService(twilio: any) {
  try {
    // Try to fetch an existing service named 'CustomerDataService'
    const services = await twilio.sync.v1.services.list({ 
      limit: 20 
    });
    
    const existingService = services.find(s => s.friendlyName === 'CustomerDataService');
    
    if (existingService) {
      return existingService.sid;
    }
    
    // If no service exists, create a new one
    const newService = await twilio.sync.v1.services.create({
      friendlyName: 'CustomerDataService'
    });
    
    return newService.sid;
  } catch (error) {
    console.error('Error creating or getting Sync service:', error);
    throw error;
  }
}
