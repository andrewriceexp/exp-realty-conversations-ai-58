import { Loader2 } from 'lucide-react';

export interface CallStatusIndicatorProps {
  status: string;
  callSid: string | null;
  isVerifyingCall: boolean;
  bypassValidation?: boolean;
  useEchoMode?: boolean;
}

const CallStatusIndicator = ({
  status,
  callSid,
  isVerifyingCall,
  bypassValidation,
  useEchoMode
}: CallStatusIndicatorProps) => {
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        {isVerifyingCall ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : null}
        <span className="text-sm text-muted-foreground">{status}</span>
      </div>
      
      {bypassValidation && (
        <span className="text-xs text-blue-500">Bypass Validation</span>
      )}
      
      {useEchoMode && (
        <span className="text-xs text-green-500">Echo Mode</span>
      )}
    </div>
  );
};

export default CallStatusIndicator;
