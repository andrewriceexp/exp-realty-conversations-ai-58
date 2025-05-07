
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
      
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setConfigs(data || []);
      
      // Set current config to the first one if available
      if (data && data.length > 0 && !currentConfig) {
        setCurrentConfig(data[0]);
      }
    } catch (error: any) {
      console.error('Error fetching agent configs:', error);
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
      
      // Remove created_at, updated_at, and id (if it's an empty string) from the payload
      const { created_at, updated_at, ...configWithPossibleEmptyId } = currentConfig;
      
      // For new configs, remove the empty id
      const configToSave = isNew 
        ? { ...configWithPossibleEmptyId, id: undefined }  // Remove id completely for new configs
        : configWithPossibleEmptyId;
      
      const { data, error } = isNew
        ? await supabase
            .from('agent_configs')
            .insert([{ 
              ...configToSave,
              user_id: user?.id,
            }])
            .select()
        : await supabase
            .from('agent_configs')
            .update({ 
              config_name: currentConfig.config_name,
              system_prompt: currentConfig.system_prompt,
              goal_extraction_prompt: currentConfig.goal_extraction_prompt,
              voice_provider: currentConfig.voice_provider,
              voice_id: currentConfig.voice_id,
              llm_provider: currentConfig.llm_provider,
              llm_model: currentConfig.llm_model,
              temperature: currentConfig.temperature,
            })
            .eq('id', currentConfig.id)
            .select();
            
      if (error) throw error;
      
      toast({
        title: isNew ? 'Config Created' : 'Config Updated',
        description: `Successfully ${isNew ? 'created' : 'updated'} "${currentConfig.config_name}"`,
      });
      
      if (data) {
        if (isNew) {
          setConfigs([...(data as AgentConfig[]), ...configs]);
          setCurrentConfig(data[0]);
        } else {
          setConfigs(configs.map(c => c.id === currentConfig.id ? { ...currentConfig } : c));
        }
      }
      
      fetchConfigs();
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
    fetchConfigs();
  }, [user?.id]);

  return {
    configs,
    currentConfig,
    setCurrentConfig,
    isLoading,
    isSaving,
    createNewConfig,
    handleSave,
    handleDelete,
    selectConfig,
  };
};
