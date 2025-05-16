
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { AgentOption } from './types';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const { apiKeyStatus } = useElevenLabsAuth();
  const { toast } = useToast();
  const { user } = useAuth();

  // Load ElevenLabs agents from database
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
        name: agent.name || agent.agent_id
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

  // Sync agents from ElevenLabs API
  const syncAgents = async () => {
    if (!user?.id || apiKeyStatus !== 'valid') return;
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-list', {
        body: { user_id: user.id }
      });

      if (error) {
        throw error;
      }
      
      if (data.success) {
        toast({
          title: 'Agents synchronized',
          description: data.message || 'Successfully synchronized ElevenLabs agents',
        });
        await loadAgents();
      } else {
        throw new Error(data.message || 'Failed to synchronize agents');
      }
    } catch (error: any) {
      console.error('Error syncing ElevenLabs agents:', error);
      toast({
        title: 'Error syncing agents',
        description: error.message || 'Failed to synchronize ElevenLabs agents',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Load agents on component mount and when API key status changes
  useEffect(() => {
    loadAgents();
  }, [apiKeyStatus]);
  
  const showEmptyState = !isLoading && agents.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label htmlFor="elevenlabs-agent">ElevenLabs Agent</Label>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={syncAgents} 
          disabled={isSyncing || apiKeyStatus !== 'valid'}
          className="h-8 px-2"
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          Sync Agents
        </Button>
      </div>
      
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {showEmptyState && (
        <Alert variant="warning" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {apiKeyStatus !== 'valid' 
              ? "Add your ElevenLabs API key in profile settings to view agents" 
              : "No ElevenLabs agents found. Click 'Sync Agents' to fetch your agents from ElevenLabs."}
          </AlertDescription>
        </Alert>
      )}
      
      {!isLoading && agents.length > 0 && (
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
      )}
      
      {agents.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Using the selected agent with direct connection for more reliable voice interactions.
        </p>
      )}
    </div>
  );
};

export default ElevenLabsAgentSelector;
