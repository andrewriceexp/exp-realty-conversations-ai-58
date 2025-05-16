
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ElevenLabsDirectConnectProps {
  useElevenLabsAgent?: boolean;
  setUseElevenLabsAgent?: (value: boolean) => void;
  elevenLabsAgentId?: string;
  setElevenLabsAgentId?: (value: string) => void;
  elevenLabsPhoneNumberId?: string;
  setElevenLabsPhoneNumberId?: (value: string) => void;
}

export default function ElevenLabsDirectConnect({
  useElevenLabsAgent = false,
  setUseElevenLabsAgent = () => {},
  elevenLabsAgentId = '',
  setElevenLabsAgentId = () => {},
  elevenLabsPhoneNumberId = '',
  setElevenLabsPhoneNumberId = () => {}
}: ElevenLabsDirectConnectProps = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(false);

  // Check if ElevenLabs API key is configured
  const hasApiKey = Boolean(profile?.elevenlabs_api_key);

  // Handle click on "configure" button
  const handleConfigureClick = () => {
    navigate("/profile-setup");
  };

  // Effect to check API key on mount
  useEffect(() => {
    const checkApiKeyValidity = async () => {
      if (!hasApiKey) return;

      setIsCheckingApiKey(true);
      try {
        // Logic for API key validation would go here
        setIsCheckingApiKey(false);
      } catch (error) {
        console.error("Error checking ElevenLabs API key:", error);
        setIsCheckingApiKey(false);
        toast({
          title: "API Key Validation Failed",
          description: "Could not validate your ElevenLabs API key. Please check your settings.",
          variant: "destructive",
        });
      }
    };

    checkApiKeyValidity();
  }, [hasApiKey, toast]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img
            src="https://avatars.githubusercontent.com/u/107469010"
            alt="ElevenLabs Logo"
            className="h-6 w-6 rounded"
          />
          ElevenLabs Direct Connect
        </CardTitle>
        <CardDescription>Use ElevenLabs Conversational AI directly</CardDescription>
      </CardHeader>

      {setUseElevenLabsAgent && (
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="use-elevenlabs"
                checked={useElevenLabsAgent}
                onChange={(e) => setUseElevenLabsAgent(e.target.checked)}
                className="mr-2"
              />
              <Label htmlFor="use-elevenlabs">Use ElevenLabs direct connection</Label>
            </div>
            
            {useElevenLabsAgent && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="elevenlabs-agent-id">ElevenLabs Agent ID</Label>
                  <Input
                    id="elevenlabs-agent-id"
                    value={elevenLabsAgentId}
                    onChange={(e) => setElevenLabsAgentId(e.target.value)}
                    placeholder="Enter your ElevenLabs agent ID"
                  />
                </div>
                
                <div>
                  <Label htmlFor="elevenlabs-phone-number-id">Phone Number ID</Label>
                  <Input
                    id="elevenlabs-phone-number-id"
                    value={elevenLabsPhoneNumberId}
                    onChange={(e) => setElevenLabsPhoneNumberId(e.target.value)}
                    placeholder="Enter your ElevenLabs phone number ID"
                  />
                </div>
                
                {!hasApiKey && (
                  <div className="flex items-center text-amber-600 gap-2 p-2 bg-amber-50 rounded">
                    <Info className="h-5 w-5" />
                    <span>ElevenLabs API key not configured</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
      
      {!setUseElevenLabsAgent && (
        <CardContent>
          {hasApiKey ? (
            <div className="flex items-center text-green-600 gap-2 p-2 bg-green-50 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>ElevenLabs API key configured</span>
            </div>
          ) : (
            <div className="flex items-center text-amber-600 gap-2 p-2 bg-amber-50 rounded">
              <Info className="h-5 w-5" />
              <span>ElevenLabs API key not configured</span>
            </div>
          )}
        </CardContent>
      )}

      <CardFooter>
        <Button 
          onClick={handleConfigureClick} 
          className="w-full" 
          variant={hasApiKey ? "outline" : "default"}
        >
          {hasApiKey ? "Update Configuration" : "Configure ElevenLabs Integration"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
