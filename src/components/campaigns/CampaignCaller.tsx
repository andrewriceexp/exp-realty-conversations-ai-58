
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, Loader2, Bug, Headphones } from 'lucide-react';
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
  
  const { makeCall, makeDevelopmentCall } = useTwilioCall();
  const { getVoices } = useElevenLabs();
  const { user } = useAuth();
  const { toast } = useToast();

  // Default ElevenLabs voices
  const defaultVoices: VoiceOption[] = [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
    { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" }, 
    { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" }
  ];

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
    
    try {
      setIsCalling(true);
      
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
        // Update campaign call count
        await supabase
          .from('campaigns')
          .update({ 
            calls_made: currentProspectIndex + 1 
          })
          .eq('id', campaignId);
          
        // Move to next prospect
        setCurrentProspectIndex(prev => prev + 1);
        
        toast({
          title: 'Call initiated',
          description: `Calling ${prospect.first_name || ''} ${prospect.last_name || ''} at ${prospect.phone_number}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Call failed',
        description: error.message || 'An error occurred while making the call',
        variant: 'destructive',
      });
      
      // Special handling for trial accounts
      if (error.message?.includes('trial account') || 
          error.message?.includes('Trial account') ||
          error.code === 'TWILIO_TRIAL_ACCOUNT') {
        toast({
          title: "Twilio Trial Account",
          description: "Your Twilio trial account has limitations. Try enabling Development Mode for basic functionality.",
          variant: "warning"
        });
      }
      
      // Special handling for missing ElevenLabs API key
      if (error.message?.includes('ElevenLabs API key') || 
          error.code === 'ELEVENLABS_API_KEY_MISSING') {
        toast({
          title: "ElevenLabs API Key Missing",
          description: "Please add your ElevenLabs API key in your profile settings to use custom voices.",
          variant: "warning"
        });
        
        // Automatically disable ElevenLabs voice if the API key is missing
        setUseElevenLabsVoice(false);
      }
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
                <p className="text-muted-foreground text-xs">{prospects[currentProspectIndex].phone_number}</p>
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
