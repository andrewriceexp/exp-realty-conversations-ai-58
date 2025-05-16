
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ElevenLabsDirectConnectProps {
  useElevenLabsAgent: boolean;
  setUseElevenLabsAgent: (value: boolean) => void;
}

const ElevenLabsDirectConnect = ({
  useElevenLabsAgent,
  setUseElevenLabsAgent,
}: ElevenLabsDirectConnectProps) => {
  return (
    <div className="space-y-4">
      {/* Toggle for using ElevenLabs direct connect */}
      <div className="flex items-center space-x-2">
        <Switch 
          id="use-elevenlabs-agent" 
          checked={useElevenLabsAgent}
          onCheckedChange={setUseElevenLabsAgent}
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
      
      {useElevenLabsAgent && (
        <Alert variant="info" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Direct connection to ElevenLabs will bypass Twilio and use your ElevenLabs API key directly.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ElevenLabsDirectConnect;
