
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract the auth token from the request header
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader) {
      console.error('Unauthorized: No Authorization header provided')
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: No Authorization header provided' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    console.log('Auth header present:', authHeader.startsWith('Bearer'))
    
    // Create authenticated Supabase client using the request headers
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Unauthorized: Invalid user token', userError)
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Invalid user token', 
          details: userError ?? 'No user found' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Authentication successful for user:', user.id)
    console.log('elevenlabs-signed-url function called')
    
    // Parse the request body
    const requestData = await req.json()
    const { agentId } = requestData || {}
    
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user's ElevenLabs API key from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('elevenlabs_api_key')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.elevenlabs_api_key) {
      console.error('ElevenLabs API key not found for user', profileError)
      return new Response(
        JSON.stringify({ 
          error: 'ElevenLabs API key not configured', 
          details: profileError ?? 'No API key found in user profile' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Found ElevenLabs API key for user')
    
    // Make request to ElevenLabs API to get a signed URL
    const elevenlabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': profile.elevenlabs_api_key,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!elevenlabsResponse.ok) {
      const errorText = await elevenlabsResponse.text()
      console.error('ElevenLabs API error:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Error from ElevenLabs API', 
          status: elevenlabsResponse.status, 
          details: errorText 
        }),
        { 
          status: elevenlabsResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const elevenlabsData = await elevenlabsResponse.json()
    console.log('Successfully obtained signed URL from ElevenLabs')

    return new Response(
      JSON.stringify({ signed_url: elevenlabsData.signed_url }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in elevenlabs-signed-url function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        details: error.message || String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
