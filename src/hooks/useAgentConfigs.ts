
import { useState, useEffect } from 'react';
import { AgentConfig } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useAgentConfigs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<AgentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default new config template
  const defaultConfig = {
    id: '',
    user_id: user?.id || '',
    config_name: 'New Agent Configuration',
    system_prompt: 'You are an AI assistant for an eXp Realty agent making calls to potential clients. Your goal is to schedule a meeting with the agent. Be conversational, respectful, and aim to understand the prospect\'s needs.',
    goal_extraction_prompt: 'Extract any key information about the prospect\'s real estate needs, timeline, and contact preferences.',
    voice_provider: 'elevenlabs',
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah voice as default
    llm_provider: 'openai',
    llm_model: 'gpt-4o-mini',
    temperature: 0.7,
    created_at: '',
    updated_at: '',
  };

  const fetchConfigs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (fetchError) {
        throw fetchError;
      }
      
      setConfigs(data || []);
      
      // Set current config to the first one if available
      if (data && data.length > 0 && !currentConfig) {
        setCurrentConfig(data[0]);
      }
    } catch (error: any) {
      console.error('Error fetching agent configs:', error);
      setError(error.message || 'Failed to load agent configurations.');
      toast({
        title: 'Error',
        description: 'Failed to load agent configurations.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewConfig = () => {
    setCurrentConfig({ 
      ...defaultConfig,
      user_id: user?.id || '',
    });
  };

  const handleSave = async () => {
    if (!currentConfig) return;
    
    try {
      setIsSaving(true);
      
      const isNew = !currentConfig.id;
      
      // For new configs, we need to exclude the empty id field completely
      // so that the database will generate a UUID automatically
      if (isNew) {
        // Destructure all fields except id for a new config
        const { id, created_at, updated_at, ...configWithoutId } = currentConfig;
        
        const { data, error } = await supabase
          .from('agent_configs')
          .insert([{ 
            ...configWithoutId,
            user_id: user?.id,
          }])
          .select();
          
        if (error) throw error;
        
        toast({
          title: 'Config Created',
          description: `Successfully created "${currentConfig.config_name}"`,
        });
        
        if (data) {
          setConfigs([...(data as AgentConfig[]), ...configs]);
          setCurrentConfig(data[0]);
        }
      } else {
        // For existing configs, we keep the id but remove timestamps
        const { created_at, updated_at, ...configToUpdate } = currentConfig;
        
        const { data, error } = await supabase
          .from('agent_configs')
          .update(configToUpdate)
          .eq('id', currentConfig.id)
          .select();
            
        if (error) throw error;
        
        toast({
          title: 'Config Updated',
          description: `Successfully updated "${currentConfig.config_name}"`,
        });
        
        if (data) {
          setConfigs(configs.map(c => c.id === currentConfig.id ? { ...currentConfig } : c));
        }
      }
      
      fetchConfigs(); // Refresh the list after save
    } catch (error: any) {
      console.error('Error saving agent config:', error);
      toast({
        title: 'Error',
        description: `Failed to save configuration: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the configuration "${name}"?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('agent_configs')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      toast({
        title: 'Config Deleted',
        description: `Successfully deleted "${name}"`,
      });
      
      setConfigs(configs.filter(c => c.id !== id));
      
      if (currentConfig?.id === id) {
        setCurrentConfig(configs.length > 1 
          ? configs.find(c => c.id !== id) || null 
          : null);
      }
    } catch (error: any) {
      console.error('Error deleting agent config:', error);
      toast({
        title: 'Error',
        description: `Failed to delete configuration: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const selectConfig = (config: AgentConfig) => {
    setCurrentConfig(config);
  };

  useEffect(() => {
    if (user?.id) {
      fetchConfigs();
    }
  }, [user?.id]);

  return {
    configs,
    currentConfig,
    setCurrentConfig,
    isLoading,
    isSaving,
    error,
    createNewConfig,
    handleSave,
    handleDelete,
    selectConfig,
  };
};
