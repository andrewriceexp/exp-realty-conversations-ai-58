
import { AlertCircle, Bug } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface DevelopmentModeOptionsProps {
  bypassValidation: boolean;
  setBypassValidation: (bypass: boolean) => void;
  debugMode: boolean;
  setDebugMode: (debug: boolean) => void;
  useEchoMode: boolean;
  setUseEchoMode: (echo: boolean) => void;
}

const DevelopmentModeOptions = ({
  bypassValidation,
  setBypassValidation,
  debugMode,
  setDebugMode,
  useEchoMode,
  setUseEchoMode
}: DevelopmentModeOptionsProps) => {
  // Use bypassValidation directly since it's provided in props
  const isDevelopmentMode = bypassValidation;
  
  return (
    <>
      {/* Developer toggle for bypassing validation */}
      <div className="flex items-center space-x-2 pt-4 border-t">
        <Switch 
          id="bypass-validation" 
          checked={isDevelopmentMode}
          onCheckedChange={setBypassValidation}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="bypass-validation" className="text-sm flex items-center">
            <Bug className="h-3 w-3 mr-1" /> Development Mode
          </Label>
          <p className="text-xs text-muted-foreground">
            Bypass Twilio signature validation (testing only)
          </p>
        </div>
      </div>
      
      {/* Debug mode switch - only visible when dev mode is on */}
      {isDevelopmentMode && (
        <>
          <div className="flex items-center space-x-2">
            <Switch 
              id="debug-mode" 
              checked={debugMode}
              onCheckedChange={setDebugMode}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="debug-mode" className="text-sm flex items-center">
                <Bug className="h-3 w-3 mr-1" /> Debug TwiML
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable verbose TwiML debug output on call
              </p>
            </div>
          </div>

          {/* Echo mode switch for testing WebSocket handshake */}
          <div className="flex items-center space-x-2">
            <Switch 
              id="echo-mode" 
              checked={useEchoMode}
              onCheckedChange={setUseEchoMode}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="echo-mode" className="text-sm flex items-center">
                <Bug className="h-3 w-3 mr-1" /> Echo Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Test WebSocket handshake using simple echo server (no ElevenLabs)
              </p>
            </div>
          </div>
          
          <Alert variant="warning" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Development mode is active. If you're using a Twilio trial account, this simplified mode may help overcome trial account limitations.
              {useEchoMode && <p className="mt-1 font-semibold">Echo mode enabled: This will only test the WebSocket connection without connecting to ElevenLabs.</p>}
            </AlertDescription>
          </Alert>
        </>
      )}
    </>
  );
};

export default DevelopmentModeOptions;
