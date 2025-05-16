
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
  }, [profile, setElevenLabsPhoneNumberId]);
  
  const handleSavePhoneNumberId = async () => {
    if (!elevenLabsPhoneNumberId.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number ID cannot be empty",
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
        description: "Your ElevenLabs phone number ID has been saved.",
      });
    } catch (error) {
      console.error("Error saving phone number ID:", error);
      toast({
        title: "Settings Error",
        description: "Failed to save your phone number ID. Please try again.",
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
                    Requires an agent set up in ElevenLabs and a phone number connected to your account.
                    The phone number must be the actual phone number in E.164 format (e.g., +12125551234), not a UUID.
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
                  This should look like "phnum_01jvbq7pw0f36bx7gyzgt7m1j9"
                </p>
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="elevenlabs-phone-number-id" className="text-sm">
                    ElevenLabs Phone Number
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Enter your actual phone number in E.164 format (e.g., +12125551234).
                          This must be a phone number registered in your ElevenLabs account.
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
                    placeholder="Enter your phone number (e.g., +12125551234)"
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
                  Must be in E.164 format (e.g., +12125551234) and registered in your ElevenLabs account
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
