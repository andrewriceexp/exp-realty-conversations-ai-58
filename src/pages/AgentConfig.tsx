
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentConfig } from '@/types';
import { PlusCircle, Trash2 } from 'lucide-react';

const AgentConfigPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getVoices, isLoading: voicesLoading } = useElevenLabs();
  
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<AgentConfig | null>(null);

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

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const voiceData = await getVoices();
        setVoices(voiceData);
      } catch (error) {
        console.error('Error fetching voices:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch voice options.',
          variant: 'destructive',
        });
      }
    };
    
    fetchVoices();
    fetchConfigs();
  }, []);

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

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Agent Configurations</h1>
          <Button onClick={createNewConfig}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Configuration
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar with config list */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Your Configurations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {configs.length === 0 && !currentConfig && (
                      <div className="text-center py-4 text-muted-foreground">
                        No configurations yet. Create your first one!
                      </div>
                    )}
                    
                    {configs.map(config => (
                      <div 
                        key={config.id}
                        className={`p-3 rounded-md cursor-pointer flex justify-between items-center ${
                          currentConfig?.id === config.id ? 'bg-secondary' : 'hover:bg-secondary/50'
                        }`}
                        onClick={() => selectConfig(config)}
                      >
                        <span className="font-medium">{config.config_name}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(config.id, config.config_name);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Main config editor */}
            <div className="lg:col-span-3">
              {currentConfig ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <Input
                        value={currentConfig.config_name}
                        onChange={(e) => setCurrentConfig({...currentConfig, config_name: e.target.value})}
                        className="text-2xl font-bold"
                        placeholder="Configuration Name"
                      />
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* System Prompt */}
                    <div className="space-y-2">
                      <Label htmlFor="system_prompt">System Prompt</Label>
                      <Textarea
                        id="system_prompt"
                        placeholder="Instruction for your AI agent"
                        rows={5}
                        value={currentConfig.system_prompt}
                        onChange={(e) => setCurrentConfig({...currentConfig, system_prompt: e.target.value})}
                      />
                      <p className="text-sm text-muted-foreground">
                        This defines your agent's persona and instructions.
                      </p>
                    </div>
                    
                    <Separator />
                    
                    {/* Goal Extraction Prompt */}
                    <div className="space-y-2">
                      <Label htmlFor="goal_extraction_prompt">Goal Extraction Prompt</Label>
                      <Textarea
                        id="goal_extraction_prompt"
                        placeholder="Instructions for extracting information from conversations"
                        rows={3}
                        value={currentConfig.goal_extraction_prompt}
                        onChange={(e) => setCurrentConfig({...currentConfig, goal_extraction_prompt: e.target.value})}
                      />
                      <p className="text-sm text-muted-foreground">
                        This guides how the system extracts information from calls.
                      </p>
                    </div>
                    
                    <Separator />
                    
                    {/* AI Model Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">AI Model Settings</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="llm_provider">LLM Provider</Label>
                          <Select
                            value={currentConfig.llm_provider}
                            onValueChange={(value) => setCurrentConfig({...currentConfig, llm_provider: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openai">OpenAI</SelectItem>
                              <SelectItem value="anthropic">Anthropic</SelectItem>
                              <SelectItem value="gemini">Google Gemini</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="llm_model">LLM Model</Label>
                          <Select
                            value={currentConfig.llm_model}
                            onValueChange={(value) => setCurrentConfig({...currentConfig, llm_model: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Model" />
                            </SelectTrigger>
                            <SelectContent>
                              {currentConfig.llm_provider === 'openai' && (
                                <>
                                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                </>
                              )}
                              {currentConfig.llm_provider === 'anthropic' && (
                                <>
                                  <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                                </>
                              )}
                              {currentConfig.llm_provider === 'gemini' && (
                                <>
                                  <SelectItem value="gemini-1.0-pro">Gemini 1.0 Pro</SelectItem>
                                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="temperature">Temperature: {currentConfig.temperature.toFixed(1)}</Label>
                        </div>
                        <Slider
                          id="temperature"
                          min={0}
                          max={1}
                          step={0.1}
                          value={[currentConfig.temperature]}
                          onValueChange={(value) => setCurrentConfig({...currentConfig, temperature: value[0]})}
                        />
                        <p className="text-sm text-muted-foreground">
                          Lower values make responses more deterministic, higher values more creative.
                        </p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Voice Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Voice Settings</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="voice_provider">Voice Provider</Label>
                        <Select
                          value={currentConfig.voice_provider}
                          onValueChange={(value) => setCurrentConfig({...currentConfig, voice_provider: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                            <SelectItem value="playht">Play.ht</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="voice_id">Voice</Label>
                        <Select
                          value={currentConfig.voice_id}
                          onValueChange={(value) => setCurrentConfig({...currentConfig, voice_id: value})}
                          disabled={voicesLoading}
                        >
                          <SelectTrigger>
                            {voicesLoading ? (
                              <Skeleton className="h-4 w-full" />
                            ) : (
                              <SelectValue placeholder="Select Voice" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {currentConfig.voice_provider === 'elevenlabs' && voices.map((voice) => (
                              <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                {voice.name}
                              </SelectItem>
                            ))}
                            {currentConfig.voice_provider === 'elevenlabs' && voices.length === 0 && (
                              <SelectItem value="EXAVITQu4vr4xnSDxMaL">Sarah</SelectItem>
                            )}
                            {currentConfig.voice_provider === 'playht' && (
                              <SelectItem value="en-US-JennyNeural">Jenny</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="flex justify-end">
                    <Button 
                      type="submit" 
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <p className="text-muted-foreground mb-4">No configuration selected or created yet.</p>
                    <Button onClick={createNewConfig}>Create New Configuration</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AgentConfigPage;
