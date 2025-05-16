
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ElevenLabsDirectConnectProps {
  useElevenLabsAgent: boolean;
  setUseElevenLabsAgent: (use: boolean) => void;
  elevenLabsAgentId: string;
  setElevenLabsAgentId: (id: string) => void;
  elevenLabsPhoneNumberId: string;
  setElevenLabsPhoneNumberId: (id: string) => void;
}

export default function ElevenLabsDirectConnect({
  useElevenLabsAgent,
  setUseElevenLabsAgent,
  elevenLabsAgentId,
  setElevenLabsAgentId,
  elevenLabsPhoneNumberId,
  setElevenLabsPhoneNumberId
}: ElevenLabsDirectConnectProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    // Load the phone number ID from the user's profile if available
    if (profile?.elevenlabs_phone_number_id) {
      setElevenLabsPhoneNumberId(profile.elevenlabs_phone_number_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [profile]); // Removed setElevenLabsPhoneNumberId from deps as it can cause loops if parent doesn't memoize it
  
  const handleSavePhoneNumberId = async () => {
    const currentId = elevenLabsPhoneNumberId.trim();
    if (!currentId) {
      toast({
        title: "Validation Error",
        description: "ElevenLabs Phone Number ID cannot be empty",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Save the phone number ID to the user's profile
      const { error } = await supabase
        .from('profiles')
        .update({ elevenlabs_phone_number_id: elevenLabsPhoneNumberId })
        .eq('id', profile?.id);
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "Settings Saved",
        description: "Your ElevenLabs phone number has been saved.",
      });
    } catch (error) {
      console.error("Error saving phone number ID:", error);
      toast({
        title: "Settings Error",
        description: "Failed to save your phone number. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right">ElevenLabs Direct</Label>
        <div className="col-span-3 flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="use-elevenlabs"
              checked={useElevenLabsAgent}
              onCheckedChange={setUseElevenLabsAgent}
            />
            <Label htmlFor="use-elevenlabs" className="cursor-pointer">
              Use ElevenLabs Agent
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Use ElevenLabs native calling platform instead of your Twilio integration.
                    Requires an agent set up in ElevenLabs and your registered ElevenLabs Phone Number ID.
                    This ID is provided by ElevenLabs for a phone number you have registered with them.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {useElevenLabsAgent && (
            <div className="space-y-4 border p-4 rounded-md bg-muted/50">
              <div>
                <Label htmlFor="elevenlabs-agent-id" className="text-sm">
                  ElevenLabs Agent ID
                </Label>
                <Input
                  id="elevenlabs-agent-id"
                  value={elevenLabsAgentId}
                  onChange={(e) => setElevenLabsAgentId(e.target.value)}
                  placeholder="Enter your ElevenLabs agent ID"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Should look like "agent_01jvbq7pw0f36bx7gyzgt7m1j9"
                </p>
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="elevenlabs-phone-number-id" className="text-sm">
                    ElevenLabs Phone Number ID
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Enter the phone number that will be used for outbound calls via ElevenLabs.
                          This should be in E.164 format (e.g., +12125551234) and must be registered with ElevenLabs.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="elevenlabs-phone-number-id"
                    value={elevenLabsPhoneNumberId}
                    onChange={(e) => setElevenLabsPhoneNumberId(e.target.value)}
                    placeholder="Enter phone number (e.g., +12125551234)"
                    className="flex-1"
                  />
                  <button
                    onClick={handleSavePhoneNumberId}
                    disabled={isLoading}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                  >
                    {isLoading ? "Saving..." : "Save"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This must be in E.164 format (e.g., +12125551234) and registered with ElevenLabs.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
