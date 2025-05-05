
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useElevenLabs, VoiceOptions } from '@/hooks/useElevenLabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, Play, Volume2 } from 'lucide-react';
import MainLayout from '@/components/MainLayout';

const formSchema = z.object({
  text: z.string().min(1, 'Please enter some text to synthesize'),
  voiceId: z.string(),
  model: z.string(),
  stability: z.number().min(0).max(1),
  similarityBoost: z.number().min(0).max(1),
});

type FormValues = z.infer<typeof formSchema>;

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
}

interface VoiceModel {
  model_id: string;
  name: string;
  description?: string;
}

// Sample models - in a real app you might fetch these from ElevenLabs API
const models: VoiceModel[] = [
  { model_id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2', description: 'Our most realistic model supporting 29 languages' },
  { model_id: 'eleven_turbo_v2', name: 'Eleven Turbo v2', description: 'Optimized for speed with English-only support' },
  { model_id: 'eleven_multilingual_v1', name: 'Eleven Multilingual v1', description: 'Legacy multilingual model' },
];

const TextToSpeechTester = () => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const { generateSpeech, getVoices, playAudio, audioSrc, isLoading, error } = useElevenLabs();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: "Welcome to eXp Realty Voice AI, your smart real estate prospecting assistant.",
      voiceId: "EXAVITQu4vr4xnSDxMaL", // Default to "Sarah" voice
      model: "eleven_multilingual_v2",
      stability: 0.5,
      similarityBoost: 0.75,
    },
  });

  useEffect(() => {
    const fetchVoices = async () => {
      setLoadingVoices(true);
      try {
        const voicesData = await getVoices();
        setVoices(voicesData || []);
      } catch (err) {
        console.error("Error fetching voices:", err);
      } finally {
        setLoadingVoices(false);
      }
    };

    fetchVoices();
  }, []);

  const onSubmit = async (values: FormValues) => {
    try {
      const options: VoiceOptions = {
        text: values.text,
        voiceId: values.voiceId,
        model: values.model,
        stability: values.stability,
        similarityBoost: values.similarityBoost,
      };
      
      await generateSpeech(options);
    } catch (err) {
      console.error("Error generating speech:", err);
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Text to Speech Tester</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Generate Voice with ElevenLabs</CardTitle>
            <CardDescription>
              Configure voice settings and generate speech from text
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text to Synthesize</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter text to convert to speech..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="voiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={loadingVoices}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a voice" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingVoices ? (
                              <SelectItem value="loading" disabled>
                                Loading voices...
                              </SelectItem>
                            ) : (
                              voices.map((voice) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  {voice.name} {voice.category && `(${voice.category})`}
                                </SelectItem>
                              ))
                            )}
                            {!loadingVoices && voices.length === 0 && (
                              <SelectItem value="error" disabled>
                                No voices available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {models.map((model) => (
                              <SelectItem key={model.model_id} value={model.model_id}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="stability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stability: {field.value.toFixed(2)}</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500">
                          Lower values yield more creativity, higher values make voice more consistent
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="similarityBoost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Similarity Boost: {field.value.toFixed(2)}</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500">
                          Higher values make voice sound more like the original voice sample
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Volume2 className="mr-2 h-4 w-4" />
                        Generate Speech
                      </>
                    )}
                  </Button>
                  
                  {audioSrc && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={playAudio}
                      disabled={isLoading}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Play Audio
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
          
          <CardFooter className="flex-col items-start">
            {error && (
              <div className="w-full rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            
            {audioSrc && (
              <div className="w-full mt-4">
                <p className="text-sm font-medium mb-2">Generated Audio:</p>
                <audio controls className="w-full" src={audioSrc}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </MainLayout>
  );
};

export default TextToSpeechTester;
