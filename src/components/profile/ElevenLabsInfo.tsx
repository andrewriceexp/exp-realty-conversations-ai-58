import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useElevenLabs } from '@/contexts/ElevenLabsContext';
import { Loader2, ExternalLink, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ElevenLabsInfo() {
  const { apiKey, isApiKeyValid, isLoading, validateApiKey } = useElevenLabs();
  const [inputApiKey, setInputApiKey] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();

  // Load the saved phone number ID when the component mounts
  useState(() => {
    if (profile?.elevenlabs_phone_number_id) {
      setPhoneNumberId(profile.elevenlabs_phone_number_id);
    }
  });

  const handleSaveApiKey = async () => {
    if (!inputApiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const isValid = await validateApiKey(inputApiKey);

      if (isValid) {
        // Save the API key to the user's profile
        const { error } = await supabase
          .from('profiles')
          .update({ elevenlabs_api_key: inputApiKey })
          .eq('id', profile?.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'API key saved successfully',
        });
        
        // Refresh the user profile to get the updated API key
        if (refreshProfile) {
          await refreshProfile();
        }
        
        setInputApiKey('');
      } else {
        toast({
          title: 'Error',
          description: 'Invalid API key. Please check and try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to save API key',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePhoneNumberId = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ elevenlabs_phone_number_id: phoneNumberId })
        .eq('id', profile?.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Phone Number ID saved successfully',
      });
      
      // Refresh the user profile to get the updated phone number ID
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (error) {
      console.error('Error saving phone number ID:', error);
      toast({
        title: 'Error',
        description: 'Failed to save phone number ID',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      <div>
        <h3 className="mb-4 text-lg font-medium">ElevenLabs Integration</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="elevenlabs-api-key">API Key</Label>
              {isApiKeyValid && (
                <Badge className="ml-2 bg-green-600">
                  <Check className="mr-1 h-4 w-4" /> Verified
                </Badge>
              )}
            </div>
            <div className="mt-1 flex space-x-2">
              <div className="relative flex-1">
                <Input
                  id="elevenlabs-api-key"
                  value={inputApiKey}
                  onChange={e => setInputApiKey(e.target.value)}
                  type={showApiKey ? "text" : "password"}
                  placeholder={apiKey ? "•".repeat(20) : "Enter your ElevenLabs API Key"}
                  className="pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <Button onClick={handleSaveApiKey} disabled={isSaving || isLoading}>
                {isSaving || isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
            <div className="mt-1">
              <a
                href="https://elevenlabs.io/app/api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 flex items-center hover:underline"
              >
                Get your API key <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>

          <div>
            <Label htmlFor="elevenlabs-phone-number-id">Phone Number ID</Label>
            <div className="mt-1 flex space-x-2">
              <Input
                id="elevenlabs-phone-number-id"
                value={phoneNumberId}
                onChange={e => setPhoneNumberId(e.target.value)}
                placeholder="Enter your ElevenLabs Phone Number ID"
                className="flex-1"
              />
              <Button onClick={handleSavePhoneNumberId} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
            <div className="mt-1">
              <a
                href="https://elevenlabs.io/app/conversational-ai/phone-numbers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 flex items-center hover:underline"
              >
                Find your Phone Number ID <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
