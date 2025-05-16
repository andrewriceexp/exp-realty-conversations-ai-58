
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
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CallAgentSelector, 
  ElevenLabsVoiceSelector, 
  CallStatusIndicator, 
  DevelopmentModeOptions, 
  ConfigurationWarnings 
} from './call-dialog-components';
import { useTwilioCall, MakeCallParams } from '@/hooks/useTwilioCall';
import { AgentConfig } from '@/types';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from "@/components/ui/toast"
import { cn } from "@/lib/utils";
import ElevenLabsDirectConnect from './ElevenLabsDirectConnect';

interface CallDialogProps {
  prospectId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCallComplete: () => void;
  reload: () => void;
}

export function CallDialog({
  prospectId, 
  isOpen, 
  onOpenChange, 
  onCallComplete,
  reload,
}: CallDialogProps) {
  const [selectedConfig, setSelectedConfig] = useState<AgentConfig | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [callInProgress, setCallInProgress] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [developmentMode, setDevelopmentMode] = useState(false);
  const [echoMode, setEchoMode] = useState(false); 
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [useElevenLabsAgent, setUseElevenLabsAgent] = useState(false);
  const [elevenLabsAgentId, setElevenLabsAgentId] = useState('');
  const [elevenLabsPhoneNumberId, setElevenLabsPhoneNumberId] = useState('');
  
  const twilioCall = useTwilioCall();

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
    let callResponse;

    try {
      // Set up the call parameters
      const callParams: MakeCallParams = {
        prospectId,
        agentConfigId: selectedConfig?.id,
        bypassValidation: developmentMode,
        debugMode: developmentMode,
        voiceId: selectedVoiceId || undefined,
        echoMode
      };

      // Add ElevenLabs specific parameters if using ElevenLabs
      if (useElevenLabsAgent && elevenLabsAgentId) {
        callParams.useElevenLabsAgent = true;
        callParams.elevenLabsAgentId = elevenLabsAgentId;
        callParams.elevenLabsPhoneNumberId = elevenLabsPhoneNumberId;
      }
      
      if (developmentMode) {
        callResponse = await twilioCall.makeDevelopmentCall(callParams);
      } else {
        callResponse = await twilioCall.makeCall(callParams);
      }

      if (callResponse.success) {
        setCallStatus('Call connected');
        setCurrentCallId(callResponse.callSid || null);
        toast({
          title: "Call Initiated",
          description: "Your call has been successfully initiated.",
        });
      } else {
        setCallStatus(`Call failed: ${callResponse.message}`);
        toast({
          title: "Call Failed",
          description: callResponse.message || "Failed to initiate call",
          variant: "destructive",
        });
        setCallInProgress(false);
        
        // Check for specific error codes
        if (callResponse.code === "ELEVENLABS_PHONE_NUMBER_MISSING" || 
            callResponse.code === "ELEVENLABS_PHONE_NUMBER_INVALID") {
          toast({
            title: "Phone Number Missing",
            description: "You need to configure your ElevenLabs phone number ID in your profile settings.",
            variant: "destructive",
            duration: 8000,
            action: (
              <ToastAction altText="Go to profile" onClick={() => window.location.href = '/profile-setup'}>
                Configure
              </ToastAction>
            )
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
      });
      setCallInProgress(false);
    }
  };
  
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
              selectedConfig={selectedConfig} 
              setSelectedConfig={setSelectedConfig} 
              className="col-span-3"
            />
          </div>
          
          <ConfigurationWarnings 
            agentConfig={selectedConfig} 
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
              developmentMode={developmentMode}
              setDevelopmentMode={setDevelopmentMode}
              echoMode={echoMode}
              setEchoMode={setEchoMode}
            />
          )}
          
        </div>
        
        {callInProgress ? (
          <div className="flex flex-col gap-4">
            <CallStatusIndicator status={callStatus} />
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
              disabled={!selectedConfig && !useElevenLabsAgent}
              className={cn(useElevenLabsAgent ? "exp-gradient" : "")}
            >
              Start Call
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

