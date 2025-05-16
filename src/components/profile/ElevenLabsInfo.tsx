
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Check, ExternalLink, Key, Loader2, BookOpen, HelpCircle, FileBox } from 'lucide-react';
import { withTimeout } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

const ElevenLabsInfo = () => {
  const [apiKey, setApiKey] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { user, profile, refreshProfile } = useAuth();
  
  const hasApiKey = profile?.elevenlabs_api_key !== null && profile?.elevenlabs_api_key !== undefined;
  const hasPhoneNumberId = profile?.elevenlabs_phone_number_id !== null && profile?.elevenlabs_phone_number_id !== undefined;

  const handleSaveApiKey = async () => {
    try {
      setIsSubmitting(true);
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to update your API key",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      
      if (!apiKey) {
        toast({
          title: "Missing API Key",
          description: "Please enter an ElevenLabs API key",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      // Basic validation - API keys should be at least 32 characters
      if (apiKey.length < 32) {
        toast({
          title: "Invalid API Key Format",
          description: "The API key you entered appears to be invalid. Please check and try again.",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      
      // Verify the API key before saving
      try {
        setVerificationStatus('idle');
        
        const controller = new AbortController();
        const verificationPromise = fetch("https://api.elevenlabs.io/v1/voices", {
          method: "GET",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          signal: controller.signal
        });
        
        const response = await withTimeout(
          verificationPromise,
          10000,
          "ElevenLabs API key verification timed out"
        );
        
        if (!response.ok) {
          setVerificationStatus('error');
          throw new Error(`Invalid API key (${response.status}): ${response.statusText}`);
        }
        
        setVerificationStatus('success');
      } catch (error) {
        setVerificationStatus('error');
        toast({
          title: "API Key Verification Failed",
          description: error instanceof Error ? error.message : "Failed to verify API key with ElevenLabs",
          variant: "destructive",
          duration: 5000,
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log("Updating API key for user:", user.id);
      
      // Update the profile with the new API key
      const { error } = await supabase
        .from('profiles')
        .update({ 
          elevenlabs_api_key: apiKey,
          elevenlabs_api_key_last_validated: new Date().toISOString() 
        })
        .eq('id', user.id);
        
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("API key updated successfully");
      
      toast({
        title: "API Key Saved",
        description: "Your ElevenLabs API key has been successfully saved.",
        duration: 3000,
      });
      
      // Refresh the user profile to get the updated data
      await refreshProfile();
      
      // Clear the input field for security
      setApiKey('');
      
    } catch (error: any) {
      console.error("Error saving API key:", error);
      toast({
        title: "Error Saving API Key",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveApiKey = async () => {
    try {
      setIsSubmitting(true);
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to update your API key",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      
      console.log("Removing API key for user:", user.id);
      
      // Remove the API key from the profile
      const { error } = await supabase
        .from('profiles')
        .update({ elevenlabs_api_key: null })
        .eq('id', user.id);
        
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("API key removed successfully");
      
      // Refresh the user profile to get the updated data
      await refreshProfile();
      
      toast({
        title: "API Key Removed",
        description: "Your ElevenLabs API key has been removed.",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error removing API key:", error);
      toast({
        title: "Error Removing API Key",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyApiKey = async () => {
    if (!apiKey) {
      toast({
        title: "Missing API Key",
        description: "Please enter an ElevenLabs API key to verify",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsVerifying(true);
    setVerificationStatus('idle');

    try {
      // Simple validation by trying to fetch voices with a timeout
      const controller = new AbortController();
      const verifyPromise = fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        signal: controller.signal
      });
      
      const response = await withTimeout(
        verifyPromise, 
        10000, 
        "ElevenLabs API key verification timed out"
      );

      if (!response.ok) {
        setVerificationStatus('error');
        throw new Error(`Invalid API key or ElevenLabs API error (${response.status})`);
      }

      setVerificationStatus('success');
      toast({
        title: "API Key Valid",
        description: "Your ElevenLabs API key has been verified successfully.",
        duration: 3000,
      });
    } catch (error: any) {
      setVerificationStatus('error');
      toast({
        title: "API Key Verification Failed",
        description: error.message || "Failed to verify API key with ElevenLabs",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSavePhoneNumberId = async () => {
    try {
      setIsSubmitting(true);
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to update your phone number ID",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      
      if (!phoneNumberId) {
        toast({
          title: "Missing Phone Number ID",
          description: "Please enter an ElevenLabs phone number ID",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      console.log("Updating phone number ID for user:", user.id);
      
      // Update the profile with the new phone number ID
      const { error } = await supabase
        .from('profiles')
        .update({ 
          elevenlabs_phone_number_id: phoneNumberId,
        })
        .eq('id', user.id);
        
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Phone number ID updated successfully");
      
      toast({
        title: "Phone Number ID Saved",
        description: "Your ElevenLabs phone number ID has been successfully saved.",
        duration: 3000,
      });
      
      // Refresh the user profile to get the updated data
      await refreshProfile();
      
    } catch (error: any) {
      console.error("Error saving phone number ID:", error);
      toast({
        title: "Error Saving Phone Number ID",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-t pt-6 mt-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">ElevenLabs Integration</h2>
        <p className="text-sm text-gray-600 mb-4">
          Add your ElevenLabs API key to enable voice conversation features in the application.
        </p>
        
        {!hasApiKey ? (
          <>
            <Alert variant="warning" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="mb-2">You need an ElevenLabs API key to use the voice conversation features.</p>
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  <li>Create an account at <a 
                      href="https://elevenlabs.io/sign-up" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >ElevenLabs</a>
                  </li>
                  <li>Go to your <a 
                      href="https://elevenlabs.io/app/api-key" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >ElevenLabs Dashboard</a> and copy your API key
                  </li>
                  <li>Make sure you have created or have access to an <a
                      href="https://elevenlabs.io/app/convai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >ElevenLabs AI Agent</a>
                  </li>
                  <li>Paste your API key below and click "Save"</li>
                </ol>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="api-key">ElevenLabs API Key</Label>
              <div className="flex space-x-2">
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your ElevenLabs API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={`flex-1 ${
                    verificationStatus === 'success' ? 'border-green-500' : 
                    verificationStatus === 'error' ? 'border-red-500' : ''
                  }`}
                />
                <Button 
                  onClick={verifyApiKey} 
                  variant={verificationStatus === 'success' ? "outline" : "secondary"}
                  disabled={isVerifying || !apiKey}
                  className={verificationStatus === 'success' ? 'border-green-500 text-green-500' : ''}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                      Verifying
                    </>
                  ) : verificationStatus === 'success' ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      Valid
                    </>
                  ) : "Verify"}
                </Button>
              </div>
              <div className="flex space-x-2 mt-2">
                <Button 
                  onClick={handleSaveApiKey} 
                  disabled={isSubmitting || isVerifying}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                      Saving...
                    </>
                  ) : "Save API Key"}
                </Button>
              </div>
              <div className="mt-3 flex flex-col space-y-2">
                <a 
                  href="https://elevenlabs.io/app/api-key" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Get your API key from ElevenLabs Dashboard
                </a>
                <a 
                  href="https://elevenlabs.io/docs/conversational-ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center"
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  ElevenLabs Conversational AI Documentation
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <Alert variant="default" className="border-green-500 mb-4">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <p>ElevenLabs API key has been configured.</p>
                <p className="text-sm mt-1 text-muted-foreground">You can now use the voice conversation features.</p>
              </AlertDescription>
            </Alert>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleRemoveApiKey}
                disabled={isSubmitting}
              >
                <Key className="h-4 w-4 mr-2" />
                Replace API Key
              </Button>
              <Button
                variant="default"
                onClick={() => window.location.href = '/conversation-testing'}
              >
                Test Conversation
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open('https://elevenlabs.io/docs/conversational-ai', '_blank')}
                size="icon"
                className="px-2"
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <a 
                href="https://elevenlabs.io/app/convai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary flex items-center mb-1"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Manage your AI Agents in ElevenLabs Dashboard
              </a>
              <a 
                href="https://elevenlabs.io/docs/conversational-ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary flex items-center"
              >
                <BookOpen className="h-3 w-3 mr-1" />
                ElevenLabs Conversational AI Documentation
              </a>
            </div>
            
            {/* Phone Number ID Section */}
            <Separator className="my-6" />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">ElevenLabs Phone Number</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>You need to register a phone number in ElevenLabs to make outbound calls. Each user needs their own registered phone number.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Alert variant={hasPhoneNumberId ? "success" : "warning"} className="mb-4">
                {hasPhoneNumberId ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {hasPhoneNumberId ? (
                    <p>ElevenLabs phone number ID has been configured.</p>
                  ) : (
                    <div>
                      <p className="mb-2">You need to register a phone number in ElevenLabs and add the ID here to make outbound calls.</p>
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        <li>Go to your <a 
                            href="https://elevenlabs.io/app/voice-settings/phone-numbers" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >ElevenLabs Phone Numbers</a> page
                        </li>
                        <li>Register a new phone number or use an existing one</li>
                        <li>Copy the ID of your phone number</li>
                        <li>Paste your phone number ID below and click "Save"</li>
                      </ol>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="phone-number-id">ElevenLabs Phone Number ID</Label>
                  <a 
                    href="https://elevenlabs.io/app/voice-settings/phone-numbers" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Manage phone numbers
                  </a>
                </div>
                <div className="flex space-x-2">
                  <Input
                    id="phone-number-id"
                    placeholder="Enter your ElevenLabs phone number ID"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSavePhoneNumberId} 
                    disabled={isSubmitting || !phoneNumberId}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                        Saving...
                      </>
                    ) : "Save"}
                  </Button>
                </div>
                {profile?.elevenlabs_phone_number_id && (
                  <p className="text-xs text-green-600 mt-1 flex items-center">
                    <Check className="h-3 w-3 mr-1" />
                    Current phone number ID: {profile.elevenlabs_phone_number_id}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  This ID is required for making outbound calls through ElevenLabs.
                </p>
                <a 
                  href="https://elevenlabs.io/docs/conversational-ai/phone-numbers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center mt-2"
                >
                  <FileBox className="h-3 w-3 mr-1" />
                  Learn more about ElevenLabs phone numbers
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ElevenLabsInfo;
