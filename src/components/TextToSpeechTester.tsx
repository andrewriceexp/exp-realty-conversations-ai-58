
import { useState } from 'react';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Play } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const VOICE_OPTIONS = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
];

const MODEL_OPTIONS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2' },
];

export default function TextToSpeechTester() {
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [model, setModel] = useState(MODEL_OPTIONS[0].id);
  const { generateSpeech, playAudio, audioSrc, isLoading, error } = useElevenLabs();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter text to convert to speech',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await generateSpeech({ 
        text,
        voiceId,
        model,
      });
      toast({
        title: 'Success',
        description: 'Speech generated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate speech',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>ElevenLabs Text-to-Speech Tester</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="voice" className="block text-sm font-medium mb-1">
                Voice
              </Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="model" className="block text-sm font-medium mb-1">
                Model
              </Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((modelOption) => (
                    <SelectItem key={modelOption.id} value={modelOption.id}>
                      {modelOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="text" className="block text-sm font-medium mb-1">
                Enter text to convert to speech:
              </Label>
              <Textarea
                id="text"
                placeholder="Type the text you want to convert to speech..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full"
              />
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading || !text.trim()} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Speech'
                )}
              </Button>
              
              {audioSrc && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={playAudio}
                  disabled={isLoading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Play
                </Button>
              )}
            </div>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
          
          {audioSrc && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Audio:</h3>
              <audio controls className="w-full" src={audioSrc}>
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
