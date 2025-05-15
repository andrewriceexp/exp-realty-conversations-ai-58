import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Phone, Loader2, AlertCircle, Settings, Bug, Headphones } from 'lucide-react';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { AgentConfig } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';

interface VoiceOption {
  id: string;
  name: string;
}

interface ProspectActionsProps {
  prospectId: string;
  prospectName: string;
}

const ProspectActions = ({ prospectId, prospectName }: ProspectActionsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [bypassValidation, setBypassValidation] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [useElevenLabsVoice, setUseElevenLabsVoice] = useState(false);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [isVerifyingCall, setIsVerifyingCall] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  
  const { makeCall, makeDevelopmentCall, verifyCallStatus, isLoading: isCallingLoading } = useTwilioCall();
  const { getVoices } = useElevenLabs();
  const { user } = useAuth();
  const { toast } = useToast();

  // Default ElevenLabs voices
  const defaultVoices: VoiceOption[] = [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
    { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" }, 
    { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" }
  ];

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
  
  const getStatusDescription = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'queued': return 'Call has been queued and will be initiated shortly';
      case 'initiated': return 'Call has been initiated and is connecting';
      case 'ringing': return 'Phone is ringing';
      case 'in-progress': return 'Call is in progress';
      case 'completed': return 'Call has completed successfully';
      case 'busy': return 'Recipient was busy';
      case 'failed': return 'Call failed to complete';
      case 'no-answer': return 'Recipient did not answer';
      case 'canceled': return 'Call was canceled';
      default: return `Current status: ${status}`;
    }
  };

  useEffect(() => {
    if (useElevenLabsVoice) {
      fetchElevenLabsVoices();
    } else {
      // Use the default voices anyway
      setVoices(defaultVoices);
      if (defaultVoices.length > 0) {
        setSelectedVoiceId(defaultVoices[0].id);
      }
    }
  }, [useElevenLabsVoice]);

  const fetchElevenLabsVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const fetchedVoices = await getVoices();
      if (fetchedVoices && Array.isArray(fetchedVoices) && fetchedVoices.length > 0) {
        const formattedVoices = fetchedVoices.map(voice => ({
          id: voice.voice_id,
          name: voice.name
        }));
        setVoices(formattedVoices);
        
        // Set default voice if one exists
        if (formattedVoices.length > 0) {
          setSelectedVoiceId(formattedVoices[0].id);
        }
      } else {
        // Fall back to default voices
        setVoices(defaultVoices);
        if (defaultVoices.length > 0) {
          setSelectedVoiceId(defaultVoices[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch ElevenLabs voices", error);
      toast({
        title: "Error fetching voices",
        description: "Failed to load ElevenLabs voices. Using default voices instead.",
        variant: "destructive"
      });
      
      // Fall back to default voices
      setVoices(defaultVoices);
      if (defaultVoices.length > 0) {
        setSelectedVoiceId(defaultVoices[0].id);
      }
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const openCallDialog = async () => {
    setCallError(null);
    setErrorCode(null);
    setIsLoadingConfigs(true);
    try {
      console.log('Fetching agent configurations');
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading agent configurations:', error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} agent configurations`);
      setConfigs(data || []);
      if (data && data.length > 0) {
        setSelectedConfigId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading agent configurations:', error);
      toast({
        title: 'Error loading configurations',
        description: error.message || 'Failed to load agent configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingConfigs(false);
      setIsDialogOpen(true);
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
    
    try {
      console.log('Making call with:', {
        prospectId,
        agentConfigId: selectedConfigId,
        userId: user.id,
        bypassValidation,
        debugMode,
        voiceId: useElevenLabsVoice ? selectedVoiceId : undefined
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
      
      // Use either regular or development call method based on bypass setting
      const callMethod = bypassValidation ? makeDevelopmentCall : makeCall;
      const response = await callMethod({
        prospectId,
        agentConfigId: selectedConfigId,
        userId: user.id,
        bypassValidation,
        debugMode,
        voiceId: useElevenLabsVoice ? selectedVoiceId : undefined,
        // Make sure we explicitly set useElevenLabsAgent to false if not specified
        useElevenLabsAgent: false
      });
      
      console.log('Call response:', response);
      
      if (response.success) {
        setIsDialogOpen(false);
        
        // Store the call SID for status checking
        if (response.callSid) {
          setCallSid(response.callSid);
          setCallStatus('initiated');
        }
        
        toast({
          title: 'Call initiated',
          description: `Call to ${prospectName} initiated successfully. ${bypassValidation ? '(Development Mode)' : ''}`,
        });
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
          description: "To use custom voices, please add your ElevenLabs API key in your profile settings.",
          variant: "warning",
          action: (
            <Link to="/profile-setup" className="underline bg-background text-foreground px-2 py-1 rounded hover:bg-muted">
              Update Profile
            </Link>
          )
        });
      }
    }
  };

  const isProfileError = () => {
    return errorCode === 'PROFILE_NOT_FOUND' || 
           errorCode === 'TWILIO_CONFIG_INCOMPLETE' || 
           (callError && (
             callError.includes('Profile') || 
             callError.includes('Twilio configuration')
           ));
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openCallDialog}>
        <Phone className="mr-2 h-4 w-4" /> Call
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  {isProfileError() && (
                    <div className="mt-2">
                      <Link to="/profile" className="flex items-center text-sm font-medium underline">
                        <Settings className="mr-1 h-4 w-4" /> Go to Profile Setup
                      </Link>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            {callStatus && (
              <Alert variant={callStatus.toLowerCase() === 'completed' ? 'default' : 'default'} className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Call status: {callStatus}
                  {isVerifyingCall && <Loader2 className="ml-2 h-4 w-4 inline animate-spin" />}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Show additional info for development mode */}
            {bypassValidation && callSid && (
              <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded">
                <p>Call SID: {callSid}</p>
              </div>
            )}
            
            {isLoadingConfigs ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No agent configurations available.</p>
                <p className="text-sm mt-2">
                  <Button 
                    variant="link" 
                    onClick={() => window.location.href = '/agent-config'}
                  >
                    Create one now
                  </Button>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="config">Agent Configuration</Label>
                <Select
                  value={selectedConfigId}
                  onValueChange={setSelectedConfigId}
                  disabled={configs.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map(config => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.config_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ElevenLabs Voice Selection */}
            <div className="flex items-center space-x-2 pt-4 border-t">
              <Switch 
                id="use-elevenlabs" 
                checked={useElevenLabsVoice}
                onCheckedChange={setUseElevenLabsVoice}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="use-elevenlabs" className="text-sm flex items-center">
                  <Headphones className="h-3 w-3 mr-1" /> Use ElevenLabs Voice
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable natural-sounding AI voices powered by ElevenLabs
                </p>
              </div>
            </div>

            {/* Voice selection dropdown - only show when ElevenLabs is enabled */}
            {useElevenLabsVoice && (
              <div className="space-y-2">
                <Label htmlFor="voice">Voice Selection</Label>
                {isLoadingVoices ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm">Loading voices...</span>
                  </div>
                ) : (
                  <Select
                    value={selectedVoiceId}
                    onValueChange={setSelectedVoiceId}
                    disabled={isLoadingVoices || voices.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map(voice => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Developer toggle for bypassing validation */}
            <div className="flex items-center space-x-2 pt-4 border-t">
              <Switch 
                id="bypass-validation" 
                checked={bypassValidation}
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
            {bypassValidation && (
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
            )}
            
            {bypassValidation && (
              <Alert variant="warning" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Development mode is active. If you're using a Twilio trial account, this simplified mode may help overcome trial account limitations.
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMakeCall} 
              disabled={isCallingLoading || !selectedConfigId}
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
    </>
  );
};

export default ProspectActions;
