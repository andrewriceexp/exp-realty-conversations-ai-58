
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { AgentOption } from './types';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';

interface ElevenLabsAgentSelectorProps {
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  disabled?: boolean;
}

const ElevenLabsAgentSelector = ({ 
  selectedAgentId, 
  setSelectedAgentId,
  disabled = false
}: ElevenLabsAgentSelectorProps) => {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { apiKeyStatus } = useElevenLabsAuth();
  const { toast } = useToast();

  // Load ElevenLabs agents from database
  useEffect(() => {
    const loadAgents = async () => {
      if (apiKeyStatus !== 'valid') return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('elevenlabs_agents')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error loading ElevenLabs agents:', error);
          throw error;
        }
        
        const formattedAgents = data?.map(agent => ({
          id: agent.agent_id,
          name: agent.agent_name || agent.agent_id
        })) || [];
        
        console.log(`Fetched ${formattedAgents.length} ElevenLabs agents`);
        setAgents(formattedAgents);
        
        // Select the first agent if none is selected and there are agents available
        if (formattedAgents.length > 0 && !selectedAgentId) {
          setSelectedAgentId(formattedAgents[0].id);
        }
      } catch (error: any) {
        console.error('Error loading ElevenLabs agents:', error);
        toast({
          title: 'Error loading agents',
          description: error.message || 'Failed to load ElevenLabs agents',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [apiKeyStatus]);

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (agents.length === 0) {
    return (
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground">
          {apiKeyStatus !== 'valid' 
            ? "Add your ElevenLabs API key in profile settings to view agents" 
            : "No ElevenLabs agents found. Create agents in the ElevenLabs portal."}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <Label htmlFor="elevenlabs-agent">ElevenLabs Agent</Label>
      <Select
        value={selectedAgentId}
        onValueChange={setSelectedAgentId}
        disabled={disabled || agents.length === 0}
      >
        <SelectTrigger id="elevenlabs-agent">
          <SelectValue placeholder="Select an ElevenLabs agent" />
        </SelectTrigger>
        <SelectContent>
          {agents.map(agent => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ElevenLabsAgentSelector;
