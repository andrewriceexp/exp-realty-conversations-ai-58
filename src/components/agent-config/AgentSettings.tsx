
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const form = useForm<AgentSettingsFormValues>({
    defaultValues: {
      inputFormat: "mulaw_8000",
      outputFormat: "mulaw_8000",
      enableAuth: true,
      enablePromptOverrides: true
    }
  });

  const onSubmit = async (data: AgentSettingsFormValues) => {
    try {
      // Update agent settings through ElevenLabs API
      const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
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
        variant: "success"
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error updating agent settings:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update agent settings. Please try again.",
        variant: "destructive"
      });
    }
  };

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

            <Button type="submit" className="w-full">
              Save Settings
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
