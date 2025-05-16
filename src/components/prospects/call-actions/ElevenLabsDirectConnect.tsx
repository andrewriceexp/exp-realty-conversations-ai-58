
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, ExternalLink, HelpCircle } from 'lucide-react';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ElevenLabsAgentSelector from './ElevenLabsAgentSelector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

interface ElevenLabsDirectConnectProps {
  useElevenLabsAgent: boolean;
  setUseElevenLabsAgent: (value: boolean) => void;
  elevenLabsAgentId: string;
  setElevenLabsAgentId: (id: string) => void;
  elevenLabsPhoneNumberId?: string;
  setElevenLabsPhoneNumberId?: (id: string) => void;
}

const ElevenLabsDirectConnect = ({
  useElevenLabsAgent,
  setUseElevenLabsAgent,
  elevenLabsAgentId,
  setElevenLabsAgentId,
  elevenLabsPhoneNumberId,
  setElevenLabsPhoneNumberId,
}: ElevenLabsDirectConnectProps) => {
  const { apiKeyStatus } = useElevenLabsAuth();
  const { profile } = useAuth();
  const isApiKeyValid = apiKeyStatus === 'valid';
  const navigate = useNavigate();
  
  const [phoneNumberId, setPhoneNumberId] = useState(elevenLabsPhoneNumberId || profile?.elevenlabs_phone_number_id || '');
  
  // If API key becomes invalid, disable ElevenLabs direct connect
  useEffect(() => {
    if (!isApiKeyValid && useElevenLabsAgent) {
      setUseElevenLabsAgent(false);
    }
  }, [isApiKeyValid, useElevenLabsAgent, setUseElevenLabsAgent]);

  // Update state when profile changes
  useEffect(() => {
    if (profile?.elevenlabs_phone_number_id) {
      setPhoneNumberId(profile.elevenlabs_phone_number_id);
      if (setElevenLabsPhoneNumberId) {
        setElevenLabsPhoneNumberId(profile.elevenlabs_phone_number_id);
      }
    }
  }, [profile, setElevenLabsPhoneNumberId]);

  const handleNavigateToProfile = () => {
    navigate('/profile-setup');
  };

  // Update the phone number ID in the parent component
  const handlePhoneNumberIdChange = (value: string) => {
    setPhoneNumberId(value);
    if (setElevenLabsPhoneNumberId) {
      setElevenLabsPhoneNumberId(value);
    }
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
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="elevenlabs-phone-number-id" className="text-sm">
                ElevenLabs Phone Number ID
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>You need to register a phone number in your ElevenLabs account and enter the ID here. This ID is different for each user.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="elevenlabs-phone-number-id"
              placeholder="Enter your ElevenLabs phone number ID"
              value={phoneNumberId}
              onChange={(e) => handlePhoneNumberIdChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              You must register a phone number in your ElevenLabs account and provide the ID here.
            </p>
          </div>
          
          <ElevenLabsAgentSelector
            selectedAgentId={elevenLabsAgentId}
            setSelectedAgentId={setElevenLabsAgentId}
          />
          
          <div className="flex flex-col space-y-2">
            <a 
              href="https://elevenlabs.io/app/conversational-ai"
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage your agents in ElevenLabs Dashboard
            </a>
            <a 
              href="https://elevenlabs.io/app/voice-settings/phone-numbers"
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Register & manage phone numbers in ElevenLabs Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElevenLabsDirectConnect;
