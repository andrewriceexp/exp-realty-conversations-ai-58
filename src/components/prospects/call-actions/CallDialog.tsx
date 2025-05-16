import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CallAgentSelector, 
  CallStatusIndicator, 
  ConfigurationWarnings, 
  DevelopmentModeOptions, 
  ElevenLabsVoiceSelector 
} from './call-dialog-components';
import { useTwilioCall, MakeCallParams } from '@/hooks/useTwilioCall';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { cn } from "@/lib/utils";
import ElevenLabsDirectConnect from './ElevenLabsDirectConnect';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CallDialogProps {
  prospectId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCallComplete: () => void;
  reload: () => void;
  prospectName?: string;
}

export function CallDialog({
  prospectId, 
  isOpen, 
  onOpenChange, 
  onCallComplete,
  reload,
  prospectName = 'Prospect',
}: CallDialogProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [callInProgress, setCallInProgress] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [developmentMode, setDevelopmentMode] = useState(false);
  const [echoMode, setEchoMode] = useState(false); 
  const [debugMode, setDebugMode] = useState(false);
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [useElevenLabsAgent, setUseElevenLabsAgent] = useState(false);
  const [elevenLabsAgentId, setElevenLabsAgentId] = useState('');
  const [elevenLabsPhoneNumberId, setElevenLabsPhoneNumberId] = useState('');
  const [useElevenLabsVoice, setUseElevenLabsVoice] = useState(false);
  const [isVerifyingCall, setIsVerifyingCall] = useState(false);
  const [hasPhoneNumberError, setHasPhoneNumberError] = useState(false);
  
  const twilioCall = useTwilioCall();
  const { toast } = useToast();
  const { profile } = useAuth();

  // Initialize phone number ID from profile if available
  useEffect(() => {
    if (profile?.elevenlabs_phone_number_id) {
      setElevenLabsPhoneNumberId(profile.elevenlabs_phone_number_id);
      setHasPhoneNumberError(false);
    }
  }, [profile]);

  const handleEndCall = async () => {
    setCallStatus('Ending call...');
    try {
      const endCallResponse = await twilioCall.endCurrentCall(currentCallId);
      if (endCallResponse.success) {
        setCallStatus('Call ended');
        setCallInProgress(false);
        setCurrentCallId(null);
        toast({
          title: "Call Ended",
          description: "The call has been successfully ended.",
        });
        onCallComplete();
        reload();
      } else {
        setCallStatus(`Failed to end call: ${endCallResponse.message}`);
        toast({
          title: "Failed to End Call",
          description: endCallResponse.message || "Failed to end the call.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error ending call:", error);
      setCallStatus(`Error ending call: ${error.message}`);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while ending the call.",
        variant: "destructive",
      });
    } finally {
      setCallInProgress(false);
    }
  };

  const handleStartCall = async () => {
    setCallStatus('Initiating call...');
    setCallInProgress(true);
    setIsVerifyingCall(true);
    let callResponse;

    try {
      // Set up the call parameters
      const callParams: MakeCallParams = {
        prospectId,
        agentConfigId: selectedConfigId,
        bypassValidation: developmentMode,
        debugMode,
        voiceId: selectedVoiceId || undefined,
        echoMode
      };

      // Special validation for ElevenLabs
      if (useElevenLabsAgent) {
        if (!elevenLabsAgentId) {
          throw new Error("Please enter your ElevenLabs Agent ID");
        }

        const currentPhoneNumberId = elevenLabsPhoneNumberId.trim();
        if (!currentPhoneNumberId) {
          throw new Error("Please enter your ElevenLabs Phone Number ID (provided by ElevenLabs for your registered outbound number)");
        }

        // Add ElevenLabs specific parameters
        callParams.useElevenLabsAgent = true;
        callParams.elevenLabsAgentId = elevenLabsAgentId;
        callParams.elevenLabsPhoneNumberId = currentPhoneNumberId;
        
        console.log("Using ElevenLabs with agent ID:", elevenLabsAgentId);
        console.log("Using ElevenLabs phone number ID:", currentPhoneNumberId);
        
        // Make the ElevenLabs call with detailed logging
        try {
          callResponse = await twilioCall.makeCall(callParams);
          console.log("ElevenLabs call response:", callResponse);
          
          // If the call fails with specific errors, provide helpful guidance
          if (!callResponse.success) {
            if (callResponse.code === "ELEVENLABS_PHONE_NUMBER_NOT_FOUND") {
              throw new Error(`The ElevenLabs Phone Number ID "${currentPhoneNumberId}" was not found in your ElevenLabs account. Please verify the ID is correct and the number is registered with ElevenLabs.`);
            } else if (callResponse.code === "ELEVENLABS_API_KEY_MISSING") {
              throw new Error("ElevenLabs API key is not configured. Please set it up in your profile settings.");
            }
            // Let any other errors be caught by the generic handler below
          }
        } catch (error) {
          console.error("Error making ElevenLabs call:", error);
          throw error;
        }
      } else if (selectedConfigId) {
        // Only attempt regular call if a config is selected
        console.log("Using regular Twilio call with agent config ID:", selectedConfigId);
        
        if (developmentMode) {
          callResponse = await twilioCall.makeDevelopmentCall(callParams);
        } else {
          callResponse = await twilioCall.makeCall(callParams);
        }
      } else {
        throw new Error("Please select an agent configuration or use ElevenLabs direct connection");
      }

      if (callResponse && callResponse.success) {
        setCallStatus('Call connected');
        setCurrentCallId(callResponse.callSid || null);
        toast({
          title: "Call Initiated",
          description: "Your call has been successfully initiated.",
        });
      } else if (callResponse) {
        setCallStatus(`Call failed: ${callResponse.message}`);
        toast({
          title: "Call Failed",
          description: callResponse.message || "Failed to initiate call",
          variant: "destructive",
        });
        setCallInProgress(false);
        
        // Provide specific guidance based on error codes
        if (callResponse.code === "ELEVENLABS_PHONE_NUMBER_NOT_FOUND") {
          toast({
            title: "Phone Number ID Not Found",
            description: "The ElevenLabs Phone Number ID you provided was not found in your ElevenLabs account. Please verify the ID and ensure the associated number is registered with ElevenLabs.",
            variant: "destructive",
            duration: 8000,
          });
        }
        else if (callResponse.code === "ELEVENLABS_PHONE_NUMBER_MISSING") {
          toast({
            title: "Phone Number ID Missing",
            description: "You need to provide your ElevenLabs Phone Number ID. This is available in your ElevenLabs dashboard for your registered outbound phone number.",
            variant: "destructive",
            duration: 8000,
            action: (
              <ToastAction altText="Go to profile" onClick={() => window.location.href = '/profile-setup'}>
                Configure in Profile
              </ToastAction>
            )
          });
        } 
        else if (callResponse.code === "ELEVENLABS_PHONE_NUMBER_INVALID") {
          toast({
            title: "Invalid Phone Number ID",
            description: "The ElevenLabs Phone Number ID provided appears to be invalid. Please ensure you are using the correct ID from your ElevenLabs account.",
            variant: "destructive",
            duration: 8000
          });
        }
      }
    } catch (error: any) {
      console.error("Error starting call:", error);
      setCallStatus(`Error: ${error.message}`);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
        duration: 8000
      });
      setCallInProgress(false);
    } finally {
      setIsVerifyingCall(false);
    }
  };
  
  // Determine if Start Call button should be disabled
  const isStartCallDisabled = 
    (!selectedConfigId && !useElevenLabsAgent) || 
    (useElevenLabsAgent && (!elevenLabsAgentId || !elevenLabsPhoneNumberId || hasPhoneNumberError));
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Call Prospect</DialogTitle>
          <DialogDescription>
            Configure AI agent settings and initiate a call to the prospect
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="agent-config" className="text-right">
              Agent
            </Label>
            <CallAgentSelector 
              selectedConfigId={selectedConfigId}
              setSelectedConfigId={setSelectedConfigId}
              className="col-span-3"
            />
          </div>
          
          <ConfigurationWarnings 
            agentConfigId={selectedConfigId}
            developmentMode={developmentMode}
            useElevenLabsAgent={useElevenLabsAgent}
          />
          
          <Separator className="my-2" />
          
          {/* ElevenLabs Direct Connect Option */}
          <ElevenLabsDirectConnect 
            useElevenLabsAgent={useElevenLabsAgent}
            setUseElevenLabsAgent={setUseElevenLabsAgent}
            elevenLabsAgentId={elevenLabsAgentId}
            setElevenLabsAgentId={setElevenLabsAgentId}
            elevenLabsPhoneNumberId={elevenLabsPhoneNumberId}
            setElevenLabsPhoneNumberId={setElevenLabsPhoneNumberId}
          />
          
          {hasPhoneNumberError && useElevenLabsAgent && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Phone number must be in E.164 format (e.g., +12125551234)
              </AlertDescription>
            </Alert>
          )}
          
          {/* Only show Voice section if not using ElevenLabs direct */}
          {!useElevenLabsAgent && (
            <>
              <Separator className="my-2" />
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="voice-selection" className="text-right">
                  Voice
                </Label>
                <div className="col-span-3">
                  <ElevenLabsVoiceSelector 
                    selectedVoiceId={selectedVoiceId}
                    setSelectedVoiceId={setSelectedVoiceId}
                    useElevenLabsVoice={useElevenLabsVoice}
                    setUseElevenLabsVoice={setUseElevenLabsVoice}
                  />
                </div>
              </div>
            </>
          )}
          
          <div className="flex justify-between items-center mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDevOptions(!showDevOptions)}
              className="text-xs"
            >
              {showDevOptions ? "Hide Advanced Options" : "Show Advanced Options"}
            </Button>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Advanced options for developers</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {showDevOptions && (
            <DevelopmentModeOptions 
              bypassValidation={developmentMode}
              setBypassValidation={setDevelopmentMode}
              debugMode={debugMode}
              setDebugMode={setDebugMode}
              useEchoMode={echoMode}
              setUseEchoMode={setEchoMode}
            />
          )}
          
        </div>
        
        {callInProgress ? (
          <div className="flex flex-col gap-4">
            <CallStatusIndicator 
              status={callStatus || ''} 
              callSid={currentCallId}
              isVerifyingCall={isVerifyingCall} 
              bypassValidation={developmentMode} 
              useEchoMode={echoMode}
            />
            <Button 
              variant="destructive" 
              onClick={handleEndCall} 
              className="mt-2"
              disabled={!currentCallId}
            >
              End Call
            </Button>
          </div>
        ) : (
          <DialogFooter>
            <Button 
              onClick={handleStartCall} 
              disabled={isStartCallDisabled}
              className={cn(useElevenLabsAgent ? "exp-gradient" : "")}
              type="button"
            >
              Start Call
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
