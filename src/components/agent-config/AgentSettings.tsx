
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";

interface AgentSettingsProps {
  agentId: string;
  onUpdate?: () => void;
}

interface AgentSettingsFormValues {
  inputFormat: string;
  outputFormat: string;
  enableAuth: boolean;
  enablePromptOverrides: boolean;
}

export function AgentSettings({ agentId, onUpdate }: AgentSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agentDetails, setAgentDetails] = useState<any>(null);
  
  const form = useForm<AgentSettingsFormValues>({
    defaultValues: {
      inputFormat: "mulaw_8000",
      outputFormat: "mulaw_8000",
      enableAuth: true,
      enablePromptOverrides: true
    }
  });

  // Fetch current agent settings
  useEffect(() => {
    const fetchAgentSettings = async () => {
      if (!agentId) return;
      
      setIsLoading(true);
      try {
        // In a real implementation, you would fetch the current settings from the API
        // This is just a placeholder - in practice, this would come from the ElevenLabs API
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}/settings`, {
          headers: {
            'Content-Type': 'application/json'
            // Include authorization if needed
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAgentDetails(data);
          
          // Update form with fetched values
          form.reset({
            inputFormat: data.input_format || "mulaw_8000",
            outputFormat: data.output_format || "mulaw_8000",
            enableAuth: data.require_auth !== false, // Default to true if not specified
            enablePromptOverrides: data.enable_prompt_overrides !== false // Default to true if not specified
          });
        }
      } catch (error) {
        console.error('Error fetching agent settings:', error);
        // Still provide default values even if fetch fails
        form.reset({
          inputFormat: "mulaw_8000",
          outputFormat: "mulaw_8000",
          enableAuth: true,
          enablePromptOverrides: true
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAgentSettings();
  }, [agentId, form]);

  const onSubmit = async (data: AgentSettingsFormValues) => {
    if (!agentId) {
      toast({
        title: "Error",
        description: "Agent ID is required",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Update agent settings through ElevenLabs API
      const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
          // Include authorization if needed
        },
        body: JSON.stringify({
          input_format: data.inputFormat,
          output_format: data.outputFormat,
          require_auth: data.enableAuth,
          enable_prompt_overrides: data.enablePromptOverrides
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update agent settings');
      }

      toast({
        title: "Settings Updated",
        description: "Agent configuration has been successfully updated.",
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error updating agent settings:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update agent settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Settings</CardTitle>
        <CardDescription>
          Configure your agent's voice and telephony settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            For optimal telephony performance, use µ-law 8000Hz format for both input and output.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="inputFormat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Input Audio Format</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select input format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mulaw_8000">µ-law 8000Hz (Recommended for calls)</SelectItem>
                        <SelectItem value="pcm_16000">PCM 16000Hz</SelectItem>
                        <SelectItem value="pcm_22050">PCM 22050Hz</SelectItem>
                        <SelectItem value="pcm_24000">PCM 24000Hz</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Format for processing incoming audio
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="outputFormat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output Audio Format</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select output format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mulaw_8000">µ-law 8000Hz (Recommended for calls)</SelectItem>
                        <SelectItem value="pcm_16000">PCM 16000Hz</SelectItem>
                        <SelectItem value="pcm_22050">PCM 22050Hz</SelectItem>
                        <SelectItem value="pcm_24000">PCM 24000Hz</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Format for generated speech output
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enableAuth"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Require Authentication
                    </FormLabel>
                    <FormDescription>
                      Enable if your agent needs to verify callers
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enablePromptOverrides"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Prompt Overrides
                    </FormLabel>
                    <FormDescription>
                      Allow dynamic customization of prompts and first messages
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
