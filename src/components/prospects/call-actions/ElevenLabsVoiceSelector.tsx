
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Headphones, Loader2 } from 'lucide-react';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { VoiceOption } from './types';
import { useToast } from '@/hooks/use-toast';

export interface ElevenLabsVoiceSelectorProps {
  selectedVoiceId: string | null;
  setSelectedVoiceId: (id: string | null) => void;
  useElevenLabsVoice: boolean;
  setUseElevenLabsVoice: (use: boolean) => void;
}

const ElevenLabsVoiceSelector = ({
  selectedVoiceId,
  setSelectedVoiceId,
  useElevenLabsVoice,
  setUseElevenLabsVoice
}: ElevenLabsVoiceSelectorProps) => {
  const { getVoices } = useElevenLabs();
  const { toast } = useToast();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  
  // Default ElevenLabs voices
  const defaultVoices: VoiceOption[] = [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
    { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" }, 
    { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" }
  ];

  useEffect(() => {
    if (useElevenLabsVoice) {
      fetchElevenLabsVoices();
    } else {
      // Use the default voices anyway
      setVoices(defaultVoices);
      if (defaultVoices.length > 0 && !selectedVoiceId) {
        setSelectedVoiceId(defaultVoices[0].id);
      }
    }
  }, [useElevenLabsVoice, selectedVoiceId]);

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

  return (
    <>
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
              value={selectedVoiceId || ''}
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
    </>
  );
};

export default ElevenLabsVoiceSelector;
