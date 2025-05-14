import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, Loader2, Bug, Headphones, AlertCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Prospect, ProspectStatus } from '@/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';

interface CampaignCallerProps {
  campaignId: string;
  prospectListId: string;
  agentConfigId: string;
}

interface VoiceOption {
  id: string;
  name: string;
}

const CampaignCaller = ({ campaignId, prospectListId, agentConfigId }: CampaignCallerProps) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [currentProspectIndex, setCurrentProspectIndex] = useState(0);
  const [bypassValidation, setBypassValidation] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [useElevenLabsVoice, setUseElevenLabsVoice] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [lastCallSid, setLastCallSid] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [isVerifyingCall, setIsVerifyingCall] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  
  const { makeCall, makeDevelopmentCall, verifyCallStatus } = useTwilioCall();
  const { getVoices } = useElevenLabs();
  const { user } = useAuth();
  const { toast } = useToast();

  // Default ElevenLabs voices
  const defaultVoices: VoiceOption[] = [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
    { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" }, 
    { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" }
  ];

  // Periodically check call status if we have a call SID
  useEffect(() => {
    let statusCheckInterval: number | null = null;
    let timeoutCounter = 0;
    const MAX_TIMEOUTS = 12; // 1 minute total (12 * 5 seconds)
    
    if (lastCallSid) {
      // Check immediately
      checkCallStatus();
      
      // Then check every 5 seconds
      statusCheckInterval = window.setInterval(() => {
        checkCallStatus();
        
        // If status stays as "queued" for too long, show an error
        if (callStatus === "queued") {
          timeoutCounter++;
          
          if (timeoutCounter >= MAX_TIMEOUTS) {
            setCallError("Call appears to be stuck in queue. You may need to try again.");
            setLastCallSid(null);
            clearInterval(statusCheckInterval!);
          }
        } else {
          // Reset counter if status changes
          timeoutCounter = 0;
        }
      }, 5000);
    }
    
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [lastCallSid, callStatus]);
  
  const checkCallStatus = async () => {
    if (!lastCallSid) return;
    
    setIsVerifyingCall(true);
    try {
      const result = await verifyCallStatus(lastCallSid);
      if (result.success && result.data) {
        const newStatus = result.data.call_status;
        setCallStatus(newStatus);
        
        // Show toast for significant status updates
        if (newStatus !== callStatus) {
          if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(newStatus?.toLowerCase() || '')) {
            toast({
              title: `Call ${newStatus}`,
              description: getStatusDescription(newStatus),
              variant: newStatus.toLowerCase() === 'completed' ? 'default' : 'destructive',
            });
          }
        }
        
        // Clear tracking once call is completed
        if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(newStatus?.toLowerCase() || '')) {
          setLastCallSid(null);
          // Don't clear status so the user can see the final status
        }
      } else if (!result.success) {
        // Handle error from status check
        console.error("Error checking call status:", result.message);
        setCallError(result.message || "Failed to check call status");
      }
    } catch (error) {
      console.error("Error checking call status:", error);
      setCallError("An unexpected error occurred when checking call status");
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
    if (prospectListId) {
      fetchProspects();
    }
  }, [prospectListId]);

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

  const fetchProspects = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('list_id', prospectListId)
        .eq('status', 'Pending') // Only get prospects that haven't been called yet
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Type casting to ensure data conforms to Prospect type with correct status enum
      const typedProspects: Prospect[] = data?.map(prospect => ({
        ...prospect,
        status: prospect.status as ProspectStatus
      })) || [];

      setProspects(typedProspects);
    } catch (error: any) {
      toast({
        title: 'Failed to load prospects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallNext = async () => {
    if (!prospects.length || currentProspectIndex >= prospects.length || !user) {
      toast({
        title: 'No more prospects to call',
        description: 'All prospects have been contacted.',
      });
      return;
    }

    const prospect = prospects[currentProspectIndex];
    
    // Clear any previous errors
    setCallError(null);
    
    try {
      setIsCalling(true);
      setLastCallSid(null);
      setCallStatus(null);
      
      // Log the phone number for debugging (with privacy option)
      console.log(`Attempting to call prospect: ${prospect.first_name} ${prospect.last_name}`);
      console.log(`Phone number: ${isAnonymizationEnabled() ? '[REDACTED]' : prospect.phone_number}`);
      
      // Use appropriate call method based on bypass setting
      const callMethod = bypassValidation ? makeDevelopmentCall : makeCall;
      const response = await callMethod({
        prospectId: prospect.id,
        agentConfigId,
        userId: user.id,
        bypassValidation, // Explicitly pass the bypass flag
        debugMode, // Pass the debug mode flag
        voiceId: useElevenLabsVoice ? selectedVoiceId : undefined
      });
      
      if (response.success) {
        // Store callSid for status tracking
        if (response.callSid) {
          setLastCallSid(response.callSid);
          setCallStatus('initiated');
          
          console.log(`Call initiated with SID: ${response.callSid}`);
          if (response.callLogId) {
            console.log(`Call log ID: ${response.callLogId}`);
          }
        }
        
        // Update campaign call count
        await supabase
          .from('campaigns')
          .update({ 
            calls_made: currentProspectIndex + 1 
          })
          .eq('id', campaignId);
          
        // Move to next prospect
        setCurrentProspectIndex(prev => prev + 1);
        
        const phoneDisplay = isAnonymizationEnabled() 
          ? '(number hidden)' 
          : prospect.phone_number;
          
        toast({
          title: 'Call initiated',
          description: `Calling ${prospect.first_name || ''} ${prospect.last_name || ''} at ${phoneDisplay}`,
          duration: 8000, // Show for longer
        });
      } else {
        // Handle call error
        setCallError(response.message || "Failed to initiate call");
        
        // Show specific error messages based on error code
        if (response.code === 'TWILIO_TRIAL_ACCOUNT') {
          toast({
            title: "Twilio Trial Account",
            description: "Your Twilio trial account has limitations. Try enabling Development Mode for basic functionality.",
            variant: "warning"
          });
        } else if (response.code === 'ELEVENLABS_API_KEY_MISSING') {
          toast({
            title: "ElevenLabs API Key Missing",
            description: "Please add your ElevenLabs API key in your profile settings to use custom voices.",
            variant: "warning"
          });
          
          // Automatically disable ElevenLabs voice if the API key is missing
          setUseElevenLabsVoice(false);
        } else if (response.code === 'REQUEST_TIMEOUT') {
          toast({
            title: "Request Timeout",
            description: "The call request timed out. Please try again later.",
            variant: "destructive"
          });
        } else {
          toast({
            title: 'Call failed',
            description: response.message || 'An error occurred while making the call',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      setCallError(error.message || "An unexpected error occurred");
      
      toast({
        title: 'Call failed',
        description: error.message || 'An error occurred while making the call',
        variant: 'destructive',
      });
      
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="border rounded-md p-4 space-y-4">
      <h3 className="text-md font-medium">Campaign Caller</h3>
      
      {bypassValidation && (
        <Alert variant="warning">
          <Bug className="h-4 w-4" />
          <AlertTitle>Development Mode Active</AlertTitle>
          <AlertDescription>
            Twilio webhook validation is bypassed. Use only for testing.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Display error message if present */}
      {callError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <div>
            <AlertTitle>Call Error</AlertTitle>
            <AlertDescription>{callError}</AlertDescription>
          </div>
        </Alert>
      )}
      
      {/* Display current call status if available */}
      {callStatus && (
        <Alert variant={callStatus.toLowerCase() === 'completed' ? 'default' : 'default'} className="mb-4">
          <AlertCircle className="h-4 w-4 mr-2" />
          <div>
            <AlertTitle>Call Status: {callStatus}</AlertTitle>
            <AlertDescription>
              {getStatusDescription(callStatus)}
              {isVerifyingCall && <Loader2 className="ml-2 h-4 w-4 inline animate-spin" />}
            </AlertDescription>
          </div>
        </Alert>
      )}
      
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-muted-foreground">No prospects available to call.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm">
            <div className="flex justify-between mb-2">
              <span>Prospects to call:</span>
              <span className="font-medium">{prospects.length - currentProspectIndex} remaining</span>
            </div>
            {currentProspectIndex < prospects.length && (
              <div className="border-l-2 border-green-500 pl-2 py-1">
                <p className="font-medium">Next: {prospects[currentProspectIndex].first_name} {prospects[currentProspectIndex].last_name}</p>
                <p className="text-muted-foreground text-xs">{isAnonymizationEnabled() ? '(number hidden)' : prospects[currentProspectIndex].phone_number}</p>
              </div>
            )}
          </div>
          
          {/* ElevenLabs Voice Section */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Switch 
              id="use-elevenlabs-campaign" 
              checked={useElevenLabsVoice}
              onCheckedChange={setUseElevenLabsVoice}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="use-elevenlabs-campaign" className="text-sm flex items-center">
                <Headphones className="h-3 w-3 mr-1" /> Use ElevenLabs Voice
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable natural-sounding AI voices
              </p>
            </div>
          </div>
          
          {/* Voice selection - only show when ElevenLabs is enabled */}
          {useElevenLabsVoice && (
            <div className="space-y-2">
              <Label htmlFor="voice-campaign" className="text-sm">Voice Selection</Label>
              {isLoadingVoices ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading voices...</span>
                </div>
              ) : (
                <Select
                  value={selectedVoiceId}
                  onValueChange={setSelectedVoiceId}
                  disabled={isLoadingVoices || voices.length === 0}
                >
                  <SelectTrigger id="voice-campaign" className="w-full">
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
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Switch 
              id="bypass-validation-campaign" 
              checked={bypassValidation}
              onCheckedChange={setBypassValidation}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="bypass-validation-campaign" className="text-sm flex items-center">
                <Bug className="h-3 w-3 mr-1" /> Development Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Bypass Twilio webhook validation (testing only)
              </p>
            </div>
          </div>
          
          {/* Debug mode switch - only visible when dev mode is on */}
          {bypassValidation && (
            <div className="flex items-center space-x-2">
              <Switch 
                id="debug-mode-campaign" 
                checked={debugMode}
                onCheckedChange={setDebugMode}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="debug-mode-campaign" className="text-sm flex items-center">
                  <Bug className="h-3 w-3 mr-1" /> Debug TwiML
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable verbose TwiML debug output on call
                </p>
              </div>
            </div>
          )}
          
          {/* Call troubleshooting hints */}
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2">
            <p className="font-medium mb-1">Troubleshooting tips:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Make sure your phone isn't blocking unknown numbers</li>
              <li>Twilio trial accounts have limitations on outbound calls</li>
              <li>Check the Edge Function logs for detailed error messages</li>
              <li>Try enabling Development Mode if calls fail</li>
            </ul>
          </div>
          
          <Button 
            className="w-full"
            disabled={isCalling || currentProspectIndex >= prospects.length}
            onClick={handleCallNext}
            variant={bypassValidation ? "outline" : "default"}
          >
            {isCalling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                {bypassValidation ? 'Call Next Prospect (Dev Mode)' : 'Call Next Prospect'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CampaignCaller;
