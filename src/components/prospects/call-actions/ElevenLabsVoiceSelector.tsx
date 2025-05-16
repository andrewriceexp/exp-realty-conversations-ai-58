
import { useState, useEffect } from 'react';
import { useElevenLabs } from '@/contexts/ElevenLabsContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ElevenLabsVoiceSelectorProps {
  selectedVoiceId: string | null;
  setSelectedVoiceId: (voiceId: string | null) => void;
  useElevenLabsVoice: boolean;
  setUseElevenLabsVoice: (use: boolean) => void;
}

const ElevenLabsVoiceSelector = ({
  selectedVoiceId,
  setSelectedVoiceId,
  useElevenLabsVoice,
  setUseElevenLabsVoice
}: ElevenLabsVoiceSelectorProps) => {
  const { isApiKeyValid, isLoading, voices, fetchVoices, getVoices } = useElevenLabs();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Fetch voices if API key is valid
    if (isApiKeyValid) {
      fetchVoices();
    }
  }, [isApiKeyValid, fetchVoices]);

  const handleToggleVoice = (checked: boolean) => {
    setUseElevenLabsVoice(checked);
    if (!checked) {
      setSelectedVoiceId(null);
    } else if (voices.length > 0 && !selectedVoiceId) {
      setSelectedVoiceId(voices[0].voice_id);
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch 
          id="use-elevenlabs-voice" 
          checked={useElevenLabsVoice}
          onCheckedChange={handleToggleVoice}
          disabled={!isApiKeyValid}
        />
        <Label htmlFor="use-elevenlabs-voice" className={!isApiKeyValid ? "text-muted-foreground" : ""}>
          Use ElevenLabs voice
        </Label>
      </div>

      {useElevenLabsVoice && isApiKeyValid && (
        <Select 
          value={selectedVoiceId || undefined}
          onValueChange={setSelectedVoiceId}
          disabled={isLoading || voices.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select voice" />
          </SelectTrigger>
          <SelectContent>
            {isLoading && <SelectItem value="loading" disabled>Loading voices...</SelectItem>}
            {!isLoading && voices.length === 0 && (
              <SelectItem value="no-voices" disabled>No voices available</SelectItem>
            )}
            {voices.map((voice) => (
              <SelectItem key={voice.voice_id} value={voice.voice_id}>
                {voice.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {useElevenLabsVoice && !isApiKeyValid && (
        <div className="text-sm text-red-500">
          ElevenLabs API key is not configured or invalid. Please update your profile settings.
        </div>
      )}
    </div>
  );
};

export default ElevenLabsVoiceSelector;
