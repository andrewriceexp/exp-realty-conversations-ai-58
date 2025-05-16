
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getStatusDescription } from './utils';

interface CallStatusIndicatorProps {
  callStatus: string | null;
  callSid: string | null;
  isVerifyingCall: boolean;
  bypassValidation: boolean;
  useEchoMode: boolean;
}

const CallStatusIndicator = ({ 
  callStatus, 
  callSid, 
  isVerifyingCall, 
  bypassValidation, 
  useEchoMode 
}: CallStatusIndicatorProps) => {
  if (!callStatus) return null;
  
  return (
    <>
      <Alert variant={callStatus.toLowerCase() === 'completed' ? 'default' : 'default'} className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Call status: {callStatus}
          {isVerifyingCall && <Loader2 className="ml-2 h-4 w-4 inline animate-spin" />}
        </AlertDescription>
      </Alert>
      
      {/* Show additional info for development mode */}
      {bypassValidation && callSid && (
        <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded">
          <p>Call SID: {callSid}</p>
          {useEchoMode && <p className="font-semibold mt-1">Echo Mode: WebSocket test only (no ElevenLabs)</p>}
        </div>
      )}
    </>
  );
};

export default CallStatusIndicator;
