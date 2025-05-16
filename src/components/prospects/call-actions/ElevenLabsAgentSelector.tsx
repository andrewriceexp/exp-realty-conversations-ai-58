
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, PlusCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { AgentOption } from './types';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const { apiKeyStatus } = useElevenLabsAuth();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load ElevenLabs agents from database
  const loadAgents = async () => {
    if (apiKeyStatus !== 'valid') return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('elevenlabs_agents')
        .select('*')
        .eq('user_id', user?.id)
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

  // Add agent manually
  const addAgent = async () => {
    if (!user?.id || !newAgentId || !newAgentName) return;
    
    try {
      const { error } = await supabase
        .from('elevenlabs_agents')
        .insert({
          agent_id: newAgentId,
          name: newAgentName,
          user_id: user.id
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('An agent with this ID already exists in your account');
        }
        throw error;
      }
      
      toast({
        title: 'Agent added',
        description: `Successfully added agent: ${newAgentName}`,
      });
      
      setNewAgentId('');
      setNewAgentName('');
      setIsAddDialogOpen(false);
      
      // Reload the agents list
      await loadAgents();
    } catch (error: any) {
      console.error('Error adding agent:', error);
      toast({
        title: 'Error adding agent',
        description: error.message || 'Failed to add agent',
        variant: 'destructive',
      });
    }
  };

  // Navigate to agents management page
  const handleManageAgents = () => {
    navigate('/prospect-management?tab=elevenlabs');
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
        <div className="flex space-x-2">
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
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={apiKeyStatus !== 'valid'}
            className="h-8 px-2"
          >
            <PlusCircle className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManageAgents}
            className="h-8 px-2"
          >
            Manage
          </Button>
        </div>
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
              : "No ElevenLabs agents found. Use 'Sync' to fetch your agents or 'Add' to manually add an agent."}
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

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ElevenLabs Agent</DialogTitle>
            <DialogDescription>
              Manually add an ElevenLabs agent to your account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                placeholder="My Sales Agent"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="agent-id">Agent ID</Label>
              <Input
                id="agent-id"
                placeholder="6Optf6WRTzp3rEyj2aiL"
                value={newAgentId}
                onChange={(e) => setNewAgentId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You can find your agent ID in the ElevenLabs dashboard.
              </p>
            </div>
            
            <a 
              href="https://elevenlabs.io/app/conversational-ai"
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center mt-2"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open ElevenLabs Dashboard
            </a>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={addAgent}
              disabled={!newAgentId || !newAgentName}
            >
              Add Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ElevenLabsAgentSelector;
