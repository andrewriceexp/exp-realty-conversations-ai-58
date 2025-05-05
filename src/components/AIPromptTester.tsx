
import { useState } from 'react';
import { useOpenAI } from '@/hooks/useOpenAI';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AIPromptTester() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const { generateContent, isLoading } = useOpenAI();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const generatedText = await generateContent({ 
        prompt,
        systemPrompt: 'You are a helpful assistant for a real estate agent. Provide concise responses.'
      });
      setResult(generatedText);
      toast({
        title: 'Success',
        description: 'Content generated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate content',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>OpenAI Integration Tester</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium mb-1">
                Enter your prompt:
              </label>
              <Textarea
                id="prompt"
                placeholder="Type your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full"
              />
            </div>
            
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Content'
              )}
            </Button>
          </form>
          
          {result && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Result:</h3>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                {result}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
