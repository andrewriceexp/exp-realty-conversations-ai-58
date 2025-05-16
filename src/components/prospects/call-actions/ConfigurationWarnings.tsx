import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ConfigurationWarningsProps {
  agentConfigId: string;
  developmentMode: boolean;
  useElevenLabsAgent: boolean;
}

const ConfigurationWarnings = ({
  agentConfigId,
  developmentMode,
  useElevenLabsAgent
}: ConfigurationWarningsProps) => {
  if (developmentMode) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Development mode is enabled. Validation checks are bypassed.
        </AlertDescription>
      </Alert>
    );
  }

  if (useElevenLabsAgent) {
    return (
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Using ElevenLabs Direct Connect. Ensure your ElevenLabs API key and phone number ID are configured in your profile.
        </AlertDescription>
      </Alert>
    );
  }

  if (!agentConfigId) {
    return (
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No agent selected. Please select an agent to start the call.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export default ConfigurationWarnings;
