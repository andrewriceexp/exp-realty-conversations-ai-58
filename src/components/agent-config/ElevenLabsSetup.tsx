
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Check, ExternalLink, Key, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function ElevenLabsSetup() {
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

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
      
      console.log("Updating API key for user:", user.id);
      
      // Update the profile with the new API key
      const { error } = await supabase
        .from('profiles')
        .update({ elevenlabs_api_key: apiKey })
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
        .eq('id', user?.id);
        
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

    try {
      // Simple validation by trying to fetch voices
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Invalid API key or ElevenLabs API error (${response.status})`);
      }

      toast({
        title: "API Key Valid",
        description: "Your ElevenLabs API key has been verified successfully.",
        duration: 3000,
      });
    } catch (error: any) {
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

  const hasApiKey = profile?.elevenlabs_api_key !== null && profile?.elevenlabs_api_key !== undefined;

  const handleTestConversation = () => {
    navigate('/conversation-testing');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ElevenLabs API Setup</CardTitle>
        <CardDescription>
          Set up your ElevenLabs API credentials to enable voice conversation features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasApiKey ? (
          <>
            <Alert variant="warning" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="mb-2">You need an ElevenLabs API key to use the voice features.</p>
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
                  className="flex-1"
                />
                <Button 
                  onClick={verifyApiKey} 
                  variant="outline" 
                  disabled={isVerifying || !apiKey}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                      Verifying
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
              <div className="mt-3">
                <a 
                  href="https://elevenlabs.io/app/api-key" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Get your API key from ElevenLabs Dashboard
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <Alert variant="default" className="border-green-500">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <p>ElevenLabs API key has been configured.</p>
                <p className="text-sm mt-1 text-muted-foreground">You can now use the voice conversation features.</p>
              </AlertDescription>
            </Alert>
            <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <Button
                variant="outline"
                onClick={handleRemoveApiKey}
                disabled={isSubmitting}
                className="flex-1"
              >
                <Key className="h-4 w-4 mr-2" />
                Replace API Key
              </Button>
              <Button
                variant="default"
                onClick={handleTestConversation}
                className="flex-1"
              >
                Test Conversation
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
