
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';
import ElevenLabsAgentSelector from './ElevenLabsAgentSelector';

interface ElevenLabsDirectConnectProps {
  useElevenLabsAgent: boolean;
  setUseElevenLabsAgent: (value: boolean) => void;
  elevenLabsAgentId: string;
  setElevenLabsAgentId: (id: string) => void;
}

const ElevenLabsDirectConnect = ({
  useElevenLabsAgent,
  setUseElevenLabsAgent,
  elevenLabsAgentId,
  setElevenLabsAgentId,
}: ElevenLabsDirectConnectProps) => {
  const { apiKeyStatus } = useElevenLabsAuth();
  const isApiKeyValid = apiKeyStatus === 'valid';
  
  // If API key becomes invalid, disable ElevenLabs direct connect
  useEffect(() => {
    if (!isApiKeyValid && useElevenLabsAgent) {
      setUseElevenLabsAgent(false);
    }
  }, [isApiKeyValid, useElevenLabsAgent, setUseElevenLabsAgent]);

  return (
    <div className="space-y-4">
      {/* Toggle for using ElevenLabs direct connect */}
      <div className="flex items-center space-x-2">
        <Switch 
          id="use-elevenlabs-agent" 
          checked={useElevenLabsAgent}
          onCheckedChange={setUseElevenLabsAgent}
          disabled={!isApiKeyValid}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="use-elevenlabs-agent" className="text-sm">
            Use ElevenLabs Direct Connect
          </Label>
          <p className="text-xs text-muted-foreground">
            Connect directly to ElevenLabs Conversational AI API
          </p>
        </div>
      </div>
      
      {!isApiKeyValid && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ElevenLabs API key is missing or invalid. Add your API key in profile settings to use direct connect.
          </AlertDescription>
        </Alert>
      )}
      
      {isApiKeyValid && useElevenLabsAgent && (
        <div className="space-y-4">
          <Alert className="mt-2 border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Direct connection will bypass Twilio and use your ElevenLabs API key directly. This is recommended for more reliable voice interactions.
            </AlertDescription>
          </Alert>
          
          <ElevenLabsAgentSelector
            selectedAgentId={elevenLabsAgentId}
            setSelectedAgentId={setElevenLabsAgentId}
          />
        </div>
      )}
    </div>
  );
};

export default ElevenLabsDirectConnect;
