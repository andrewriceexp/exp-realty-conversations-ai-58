
import { AgentConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface ConfigEditorProps {
  currentConfig: AgentConfig;
  isSaving: boolean;
  onConfigChange: (config: AgentConfig) => void;
  onSave: () => void;
  voices: any[];
  voicesLoading: boolean;
}

export const ConfigEditor = ({
  currentConfig,
  isSaving,
  onConfigChange,
  onSave,
  voices,
  voicesLoading
}: ConfigEditorProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Input
            value={currentConfig.config_name}
            onChange={(e) => onConfigChange({...currentConfig, config_name: e.target.value})}
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
            onChange={(e) => onConfigChange({...currentConfig, system_prompt: e.target.value})}
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
            onChange={(e) => onConfigChange({...currentConfig, goal_extraction_prompt: e.target.value})}
          />
          <p className="text-sm text-muted-foreground">
            This guides how the system extracts information from calls.
          </p>
        </div>
        
        <Separator />
        
        <AIModelSettings currentConfig={currentConfig} onConfigChange={onConfigChange} />
        
        <Separator />
        
        <VoiceSettings 
          currentConfig={currentConfig} 
          onConfigChange={onConfigChange}
          voices={voices}
          voicesLoading={voicesLoading}
        />
      </CardContent>
      
      <CardFooter className="flex justify-end">
        <Button 
          type="submit" 
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardFooter>
    </Card>
  );
};

interface AIModelSettingsProps {
  currentConfig: AgentConfig;
  onConfigChange: (config: AgentConfig) => void;
}

const AIModelSettings = ({ currentConfig, onConfigChange }: AIModelSettingsProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">AI Model Settings</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="llm_provider">LLM Provider</Label>
          <Select
            value={currentConfig.llm_provider}
            onValueChange={(value) => onConfigChange({...currentConfig, llm_provider: value})}
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
            onValueChange={(value) => onConfigChange({...currentConfig, llm_model: value})}
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
          onValueChange={(value) => onConfigChange({...currentConfig, temperature: value[0]})}
        />
        <p className="text-sm text-muted-foreground">
          Lower values make responses more deterministic, higher values more creative.
        </p>
      </div>
    </div>
  );
};

interface VoiceSettingsProps {
  currentConfig: AgentConfig;
  onConfigChange: (config: AgentConfig) => void;
  voices: any[];
  voicesLoading: boolean;
}

const VoiceSettings = ({ currentConfig, onConfigChange, voices, voicesLoading }: VoiceSettingsProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Voice Settings</h3>
      
      <div className="space-y-2">
        <Label htmlFor="voice_provider">Voice Provider</Label>
        <Select
          value={currentConfig.voice_provider}
          onValueChange={(value) => onConfigChange({...currentConfig, voice_provider: value})}
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
          onValueChange={(value) => onConfigChange({...currentConfig, voice_id: value})}
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
  );
};
