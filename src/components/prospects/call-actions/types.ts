
import { AgentConfig } from '@/types';

export interface ProspectCallProps {
  prospectId: string;
  prospectName: string;
}

export interface VoiceOption {
  id: string;
  name: string;
}

export interface AgentOption {
  id: string;
  name: string;
}

export interface ConfigurationStatus {
  twilioSetup: boolean;
  elevenLabsSetup: boolean;
  message: string | null;
}

export interface CallOptions {
  prospectId: string;
  agentConfigId: string;
  userId: string;
  bypassValidation: boolean;
  debugMode: boolean;
  echoMode: boolean;
  voiceId?: string;
  useElevenLabsAgent: boolean;
  elevenLabsAgentId?: string;
}
