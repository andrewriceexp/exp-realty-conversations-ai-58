
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Settings } from 'lucide-react';
import { ConfigurationStatus } from './types';

interface ConfigurationWarningsProps {
  configurationStatus: ConfigurationStatus;
  bypassValidation: boolean;
  useElevenLabsVoice: boolean;
  useEchoMode: boolean;
}

const ConfigurationWarnings = ({ 
  configurationStatus, 
  bypassValidation, 
  useElevenLabsVoice, 
  useEchoMode 
}: ConfigurationWarningsProps) => {
  const warnings = [];
  
  // Add Twilio configuration warning
  if (!configurationStatus.twilioSetup && !bypassValidation) {
    warnings.push(
      <Alert key="twilio" variant="warning" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Twilio credentials are not configured. Calls may fail.
          <div className="mt-2">
            <Link to="/profile-setup" className="flex items-center text-sm font-medium underline">
              <Settings className="mr-1 h-4 w-4" /> Go to Profile Setup
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Add ElevenLabs API key warning
  if (useElevenLabsVoice && !configurationStatus.elevenLabsSetup && !bypassValidation) {
    warnings.push(
      <Alert key="eleven" variant="warning" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          ElevenLabs API key is not configured or invalid. Custom voices may not work.
          <div className="mt-2">
            <Link to="/profile-setup" className="flex items-center text-sm font-medium underline">
              <Settings className="mr-1 h-4 w-4" /> Go to Profile Setup
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Add echo mode description when enabled
  if (useEchoMode && bypassValidation) {
    warnings.push(
      <Alert key="echo-mode-info" variant="info" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Echo Mode Active:</strong> This mode will only test the WebSocket connection without using ElevenLabs AI.
          Any audio sent will be echoed back to your phone to verify the connection is working properly.
        </AlertDescription>
      </Alert>
    );
  }
  
  return warnings.length > 0 ? <>{warnings}</> : null;
};

export default ConfigurationWarnings;
