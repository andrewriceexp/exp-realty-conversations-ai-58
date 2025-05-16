
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  
  // If API key becomes invalid, disable ElevenLabs direct connect
  useEffect(() => {
    if (!isApiKeyValid && useElevenLabsAgent) {
      setUseElevenLabsAgent(false);
    }
  }, [isApiKeyValid, useElevenLabsAgent, setUseElevenLabsAgent]);

  const handleNavigateToProfile = () => {
    navigate('/profile-setup');
  };

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
          <AlertDescription className="flex flex-col space-y-2">
            <p>ElevenLabs API key is missing or invalid. Add your API key in profile settings to use direct connect.</p>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleNavigateToProfile}
              className="self-start"
            >
              Configure API Key
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {isApiKeyValid && useElevenLabsAgent && (
        <div className="space-y-4">
          <Alert variant="success" className="mt-2">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Direct connection will bypass Twilio and use your ElevenLabs API key directly. This is recommended for more reliable voice interactions.
            </AlertDescription>
          </Alert>
          
          <ElevenLabsAgentSelector
            selectedAgentId={elevenLabsAgentId}
            setSelectedAgentId={setElevenLabsAgentId}
          />
          
          <div className="mt-2 flex items-center">
            <a 
              href="https://elevenlabs.io/app/conversational-ai"
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage your agents in ElevenLabs Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElevenLabsDirectConnect;
