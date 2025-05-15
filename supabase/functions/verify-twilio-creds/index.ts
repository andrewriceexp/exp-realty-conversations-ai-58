
// Function to verify Twilio credentials
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get request payload
    const requestData = await req.json();
    const { account_sid, auth_token, user_id } = requestData;
    
    // For user_id based lookup (check if we should get credentials from the database)
    if (user_id && !account_sid && !auth_token) {
      // This would require fetching credentials from the database - not implemented yet
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User ID based validation is not implemented yet',
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    if (!account_sid || !auth_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: account_sid or auth_token',
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    // Make a test request to Twilio using the credentials
    try {
      // Simple validation by fetching account details
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${account_sid}:${auth_token}`)}`
        }
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error("Twilio API Error:", responseData);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid Twilio credentials: ${responseData.message || 'Unable to authenticate'}`,
            details: responseData
          }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Twilio credentials are valid',
          valid: true,
          account_info: {
            friendly_name: responseData.friendly_name,
            status: responseData.status
          }
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    } catch (error) {
      console.error("Error verifying Twilio credentials:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Error verifying Twilio credentials: ${error.message}`
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
  } catch (error) {
    console.error("Request processing error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error processing request: ${error.message}`
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
