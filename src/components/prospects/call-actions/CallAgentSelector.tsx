import { useState, useEffect } from 'react';
import { AgentConfig } from '@/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface CallAgentSelectorProps {
  selectedConfigId: string;
  setSelectedConfigId: (id: string) => void;
  className?: string;
}

const CallAgentSelector = ({ selectedConfigId, setSelectedConfigId, className }: CallAgentSelectorProps) => {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const { user } = useAuth();

  // Load agent configurations
  useEffect(() => {
    const loadConfigs = async () => {
      if (!user?.id) return;
      
      setIsLoadingConfigs(true);
      try {
        console.log('Fetching agent configurations');
        const { data, error } = await supabase
          .from('agent_configs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error loading agent configurations:', error);
          throw error;
        }
        
        console.log(`Fetched ${data?.length || 0} agent configurations`);
        setConfigs(data || []);
        if (data && data.length > 0) {
          setSelectedConfigId(data[0].id);
        }
      } catch (error: any) {
        console.error('Error loading agent configurations:', error);
        toast({
          title: 'Error loading configurations',
          description: error.message || 'Failed to load agent configurations',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingConfigs(false);
      }
    };

    loadConfigs();
  }, [user?.id]);

  if (isLoadingConfigs) {
    return (
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (configs.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">No agent configurations available.</p>
        <p className="text-sm mt-2">
          <Button 
            variant="link" 
            onClick={() => window.location.href = '/agent-config'}
          >
            Create one now
          </Button>
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <Label htmlFor="config">Agent Configuration</Label>
      <Select
        value={selectedConfigId}
        onValueChange={setSelectedConfigId}
        disabled={configs.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a configuration" />
        </SelectTrigger>
        <SelectContent>
          {configs.map(config => (
            <SelectItem key={config.id} value={config.id}>
              {config.config_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CallAgentSelector;
