
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[elevenlabs-agents-list] Starting function');
    
    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error('Missing required user_id parameter');
    }
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    // Get the user's ElevenLabs API key from profiles
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('elevenlabs_api_key')
      .eq('id', user_id)
      .single();
      
    if (profileError || !profileData?.elevenlabs_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ElevenLabs API key not found',
          message: 'Please add your ElevenLabs API key in your profile settings'
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
    
    const elevenlabsApiKey = profileData.elevenlabs_api_key;
    
    console.log('[elevenlabs-agents-list] Fetching agents from ElevenLabs API');
    
    // Fetch all agents from ElevenLabs
    const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents`, {
      method: 'GET',
      headers: {
        'xi-api-key': elevenlabsApiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[elevenlabs-agents-list] ElevenLabs API error: ${response.status} - ${errorText}`);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }
    
    const agentsData = await response.json();
    console.log(`[elevenlabs-agents-list] Found ${agentsData.agents?.length || 0} agents`);
    
    if (!agentsData.agents || !Array.isArray(agentsData.agents)) {
      return new Response(
        JSON.stringify({
          success: true,
          agents: [],
          message: 'No agents found in ElevenLabs account'
        }),
        {
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    // Prepare agents for database insertion
    const agents = agentsData.agents.map(agent => ({
      agent_id: agent.id,
      name: agent.name,
      description: agent.description || null,
      user_id
    }));
    
    // First, delete any existing agents for this user
    const { error: deleteError } = await supabaseClient
      .from('elevenlabs_agents')
      .delete()
      .eq('user_id', user_id);
      
    if (deleteError) {
      console.error('[elevenlabs-agents-list] Error deleting existing agents:', deleteError);
      throw new Error(`Error deleting existing agents: ${deleteError.message}`);
    }
    
    // Then insert the current agents
    const { data: insertedAgents, error: insertError } = await supabaseClient
      .from('elevenlabs_agents')
      .insert(agents)
      .select();
      
    if (insertError) {
      console.error('[elevenlabs-agents-list] Error inserting agents:', insertError);
      throw new Error(`Error inserting agents: ${insertError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        agents: insertedAgents,
        message: `Successfully synchronized ${agents.length} agents`
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    );
    
  } catch (error) {
    console.error('[elevenlabs-agents-list] Error:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to synchronize agents'
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
