
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Check, Key } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function ElevenLabsSetup() {
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const handleSaveApiKey = async () => {
    try {
      setIsSubmitting(true);
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to update your API key",
          variant: "destructive",
        });
        return;
      }
      
      if (!apiKey) {
        toast({
          title: "Missing API Key",
          description: "Please enter an ElevenLabs API key",
          variant: "destructive",
        });
        return;
      }
      
      // Update the profile with the new API key
      const { error } = await supabase
        .from('profiles')
        .update({ elevenlabs_api_key: apiKey })
        .eq('id', user.id);
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "API Key Saved",
        description: "Your ElevenLabs API key has been successfully saved.",
        variant: "default",
      });
      
      // Refresh the user profile to get the updated data
      await refreshProfile();
      
      // Clear the input field for security
      setApiKey('');
      
    } catch (error: any) {
      toast({
        title: "Error Saving API Key",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
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
        });
        return;
      }
      
      // Update the profile with the new API key
      const { error } = await supabase
        .from('profiles')
        .update({ elevenlabs_api_key: null })
        .eq('id', user?.id);
        
      if (error) {
        throw error;
      }
      
      // Refresh the user profile to get the updated data
      await refreshProfile();
      
      toast({
        title: "API Key Removed",
        description: "Your ElevenLabs API key has been removed.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error Removing API Key",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasApiKey = profile?.elevenlabs_api_key !== null && profile?.elevenlabs_api_key !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ElevenLabs API Setup</CardTitle>
        <CardDescription>
          Set up your ElevenLabs API credentials to enable voice features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasApiKey ? (
          <>
            <Alert variant="warning" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need an ElevenLabs API key to use the voice features. Get your API key from{" "}
                <a 
                  href="https://elevenlabs.io/app/api-key" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  ElevenLabs Dashboard
                </a>.
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
                />
                <Button onClick={handleSaveApiKey} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <Alert variant="default" className="border-green-500">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription>
                ElevenLabs API key has been configured.
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
