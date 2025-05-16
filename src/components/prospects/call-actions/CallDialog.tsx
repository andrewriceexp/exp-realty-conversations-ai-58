
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Phone, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { isProfileError, getStatusDescription } from './utils';
import { CallOptions, ConfigurationStatus } from './types';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';

// Import components
import CallAgentSelector from './CallAgentSelector';
import CallStatusIndicator from './CallStatusIndicator';
import ConfigurationWarnings from './ConfigurationWarnings';
import DevelopmentModeOptions from './DevelopmentModeOptions';
import ElevenLabsVoiceSelector from './ElevenLabsVoiceSelector';
import ElevenLabsDirectConnect from './ElevenLabsDirectConnect';

interface CallDialogProps {
  prospectId: string;
  prospectName: string;
  isOpen: boolean;
  onClose: () => void;
}

const CallDialog = ({ prospectId, prospectName, isOpen, onClose }: CallDialogProps) => {
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [callError, setCallError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [bypassValidation, setBypassValidation] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [useElevenLabsVoice, setUseElevenLabsVoice] = useState(false);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [isVerifyingCall, setIsVerifyingCall] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [useEchoMode, setUseEchoMode] = useState(false);
  const [useElevenLabsAgent, setUseElevenLabsAgent] = useState(false);
  const [elevenLabsAgentId, setElevenLabsAgentId] = useState<string>('');

  const { makeCall, makeDevelopmentCall, verifyCallStatus, isLoading: isCallingLoading } = useTwilioCall();
  const { apiKeyStatus } = useElevenLabsAuth();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Check for necessary configurations before allowing calls
  const [configurationStatus, setConfigurationStatus] = useState<ConfigurationStatus>({
    twilioSetup: false,
    elevenLabsSetup: false,
    message: null
  });

  // Verify configuration on component mount
  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        // Check if user has Twilio credentials
        const hasTwilioSetup = !!(profile?.twilio_account_sid && 
                              profile?.twilio_auth_token && 
                              profile?.twilio_phone_number);
        
        // Check if ElevenLabs API key is valid
        const hasElevenLabsSetup = apiKeyStatus === 'valid';

        setConfigurationStatus({
          twilioSetup: hasTwilioSetup,
          elevenLabsSetup: hasElevenLabsSetup,
          message: !hasTwilioSetup && !useElevenLabsAgent
            ? "Twilio credentials are not configured"
            : !hasElevenLabsSetup && (useElevenLabsVoice || useElevenLabsAgent)
            ? "ElevenLabs API key is not configured or invalid"
            : null
        });
      } catch (error) {
        console.error("Error checking configuration:", error);
      }
    };

    checkConfiguration();
  }, [profile, apiKeyStatus, useElevenLabsVoice, useElevenLabsAgent]);

  // Add effect to periodically check call status
  useEffect(() => {
    let statusCheckInterval: number | null = null;
    
    if (callSid) {
      // Check immediately
      checkCallStatus();
      
      // Then check every 5 seconds
      statusCheckInterval = window.setInterval(checkCallStatus, 5000);
    }
    
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [callSid]);
  
  const checkCallStatus = async () => {
    if (!callSid) return;
    
    setIsVerifyingCall(true);
    try {
      const result = await verifyCallStatus(callSid);
      if (result.success && result.data) {
        const newStatus = result.data.call_status;
        setCallStatus(newStatus);
        
        // Show toast for status updates
        if (newStatus !== callStatus) {
          toast({
            title: `Call status: ${newStatus}`,
            description: getStatusDescription(newStatus),
            variant: "default",
          });
        }
        
        // Clear interval once call is completed
        if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(newStatus?.toLowerCase() || '')) {
          setCallSid(null);
        }
      }
    } catch (error) {
      console.error("Error checking call status:", error);
    } finally {
      setIsVerifyingCall(false);
    }
  };

  const handleMakeCall = async () => {
    setCallError(null);
    setErrorCode(null);
    setCallSid(null);
    setCallStatus(null);
    
    if (!selectedConfigId || !user?.id) {
      toast({
        title: 'Missing information',
        description: 'Please select an agent configuration',
        variant: 'destructive',
      });
      return;
    }

    // Check configuration status before proceeding
    if (!useElevenLabsAgent && !configurationStatus.twilioSetup && !bypassValidation) {
      setCallError("Twilio credentials are not configured. Please update your profile settings.");
      setErrorCode("TWILIO_CONFIG_INCOMPLETE");
      return;
    }

    if ((useElevenLabsVoice || useElevenLabsAgent) && !configurationStatus.elevenLabsSetup && !bypassValidation) {
      setCallError("ElevenLabs API key is not configured or invalid. Please update your profile settings.");
      setErrorCode("ELEVENLABS_API_KEY_MISSING");
      return;
    }
    
    if (useElevenLabsAgent && !elevenLabsAgentId) {
      setCallError("Please select an ElevenLabs agent.");
      setErrorCode("ELEVENLABS_AGENT_MISSING");
      return;
    }
    
    try {
      console.log('Making call with:', {
        prospectId,
        agentConfigId: selectedConfigId,
        userId: user.id,
        bypassValidation,
        debugMode,
        echoMode: useEchoMode,
        voiceId: useElevenLabsVoice ? selectedVoiceId : undefined,
        useElevenLabsAgent,
        elevenLabsAgentId: useElevenLabsAgent ? elevenLabsAgentId : undefined
      });
      
      // Get prospect phone number for additional logging
      const { data: prospectData } = await supabase
        .from('prospects')
        .select('phone_number')
        .eq('id', prospectId)
        .single();
      
      if (prospectData?.phone_number) {
        console.log(`Attempting to call prospect with phone: ${isAnonymizationEnabled() ? '[REDACTED]' : prospectData.phone_number}`);
      }
      
      // Create options object for the call
      const callOptions: CallOptions = {
        prospectId,
        agentConfigId: selectedConfigId,
        userId: user.id,
        bypassValidation,
        debugMode,
        echoMode: useEchoMode,
        voiceId: useElevenLabsVoice ? selectedVoiceId : undefined,
        useElevenLabsAgent,
        elevenLabsAgentId: useElevenLabsAgent ? elevenLabsAgentId : undefined
      };
      
      // Use either regular or development call method based on bypass setting
      const callMethod = bypassValidation ? makeDevelopmentCall : makeCall;
      const response = await callMethod(callOptions);
      
      console.log('Call response:', response);
      
      if (response.success) {
        onClose();
        
        // Store the call SID for status checking
        if (response.callSid) {
          setCallSid(response.callSid);
          setCallStatus('initiated');
          
          // Show a special toast message when in echo mode
          if (useEchoMode) {
            toast({
              title: 'Echo Mode Active',
              description: 'Call initiated in echo mode. This will only test the WebSocket connection.',
              variant: 'default',
            });
          } else if (useElevenLabsAgent) {
            toast({
              title: 'ElevenLabs Direct Connection Active',
              description: `Direct connection to ElevenLabs agent initiated. ${bypassValidation ? '(Development Mode)' : ''}`,
              variant: 'default',
            });
          } else {
            toast({
              title: 'Call initiated',
              description: `Call to ${prospectName} initiated successfully. ${bypassValidation ? '(Development Mode)' : ''}`,
            });
          }
        }
      } else {
        // Store the error code if available
        setErrorCode(response.code || null);
        throw new Error(response.message || 'Unknown error initiating call');
      }
    } catch (error: any) {
      console.error("Error making call:", error);
      setCallError(error.message || 'An error occurred while trying to make the call');
      
      // Handle specific error cases
      if (error.message?.includes('Profile setup') || 
          error.message?.includes('Twilio configuration') ||
          error.code === 'PROFILE_NOT_FOUND' ||
          error.code === 'TWILIO_CONFIG_INCOMPLETE') {
        toast({
          title: "Profile setup required",
          description: "Please complete your profile setup with Twilio credentials before making calls.",
          variant: "destructive",
          action: (
            <Link to="/profile-setup" className="underline bg-background text-foreground px-2 py-1 rounded hover:bg-muted">
              Update Profile
            </Link>
          )
        });
      }
      
      // If this is a trial account error, show a special message
      if (error.message?.includes('trial account') || 
          error.message?.includes('Trial account') ||
          error.code === 'TWILIO_TRIAL_ACCOUNT') {
        toast({
          title: "Twilio Trial Account",
          description: "Your Twilio trial account has limitations. For full functionality, please upgrade to a paid account.",
          variant: "warning"
        });
      }
      
      // If this is an ElevenLabs API key error, show a special message
      if (error.message?.includes('ElevenLabs API key') || 
          error.code === 'ELEVENLABS_API_KEY_MISSING') {
        toast({
          title: "ElevenLabs API Key Required",
          description: "To use custom voices or direct connection, please add your ElevenLabs API key in your profile settings.",
          variant: "warning",
          action: (
            <Link to="/profile-setup" className="underline bg-background text-foreground px-2 py-1 rounded hover:bg-muted">
              Update Profile
            </Link>
          )
        });
      }
      
      // If this is a WebSocket error, provide more specific guidance
      if (error.message?.includes('WebSocket') || 
          error.message?.includes('socket') ||
          error.code === 'WEBSOCKET_ERROR') {
        toast({
          title: "WebSocket Connection Error",
          description: "Unable to establish the audio connection. Try using ElevenLabs Direct Connect instead.",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Call {prospectName || 'Prospect'}</DialogTitle>
          <DialogDescription>
            Select an agent configuration to use for this call
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {callError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {callError}
                {isProfileError(errorCode, callError) && (
                  <div className="mt-2">
                    <Link to="/profile-setup" className="flex items-center text-sm font-medium underline">
                      <Settings className="mr-1 h-4 w-4" /> Go to Profile Setup
                    </Link>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <ConfigurationWarnings 
            configurationStatus={configurationStatus}
            bypassValidation={bypassValidation}
            useElevenLabsVoice={useElevenLabsVoice}
            useEchoMode={useEchoMode}
          />
          
          <CallStatusIndicator 
            callStatus={callStatus}
            callSid={callSid}
            isVerifyingCall={isVerifyingCall}
            bypassValidation={bypassValidation}
            useEchoMode={useEchoMode}
          />
          
          <CallAgentSelector 
            selectedConfigId={selectedConfigId}
            setSelectedConfigId={setSelectedConfigId}
          />

          <ElevenLabsDirectConnect 
            useElevenLabsAgent={useElevenLabsAgent}
            setUseElevenLabsAgent={setUseElevenLabsAgent}
            elevenLabsAgentId={elevenLabsAgentId}
            setElevenLabsAgentId={setElevenLabsAgentId}
          />

          {!useElevenLabsAgent && (
            <ElevenLabsVoiceSelector 
              useElevenLabsVoice={useElevenLabsVoice}
              setUseElevenLabsVoice={setUseElevenLabsVoice}
              selectedVoiceId={selectedVoiceId}
              setSelectedVoiceId={setSelectedVoiceId}
            />
          )}

          <DevelopmentModeOptions 
            bypassValidation={bypassValidation}
            setBypassValidation={setBypassValidation}
            debugMode={debugMode}
            setDebugMode={setDebugMode}
            useEchoMode={useEchoMode}
            setUseEchoMode={setUseEchoMode}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleMakeCall} 
            disabled={isCallingLoading || !selectedConfigId || (useElevenLabsAgent && !elevenLabsAgentId)}
          >
            {isCallingLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calling...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" /> Make Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallDialog;
