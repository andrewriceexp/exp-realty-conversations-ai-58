
import React, { useEffect, useState, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { useAuth } from '@/contexts/AuthContext';
import { useElevenLabs } from '@/contexts/ElevenLabsContext';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';

interface ConversationPanelProps {
  agentId: string;
  prospectName?: string;
  prospectPhone?: string;
  onConversationEnd?: (summary?: string) => void;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Updated type definition for ElevenLabs message object to match their API
interface ElevenLabsMessage {
  type: string;
  content: string;
  source?: any;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  agentId,
  prospectName = 'Prospect',
  prospectPhone,
  onConversationEnd,
}) => {
  const { getSignedUrl, isLoading: isLoadingUrl } = useElevenLabs();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [conversationEnded, setConversationEnded] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize the conversation hook from ElevenLabs SDK
  const conversation = useConversation({
    // Force TypeScript to accept our callback by using type assertion
    onMessage: ((message: any) => {
      // Handle the message based on its type
      if (message.type === 'assistant_response') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: message.content,
          timestamp: new Date()
        }]);
      } else if (message.type === 'user_speech_final') {
        setMessages(prev => [...prev, {
          role: 'user',
          content: message.content,
          timestamp: new Date()
        }]);
      }
    }) as any,
    onError: (error) => {
      toast({
        title: "Conversation Error",
        description: error.message || "An error occurred during the conversation",
        variant: "destructive"
      });
    },
    onConnect: () => {
      setConversationStarted(true);
      toast({
        title: "Conversation Connected",
        description: "You can now speak with the AI assistant"
      });
    },
    onDisconnect: () => {
      setConversationEnded(true);
      setIsMicEnabled(false);
    },
    // Define client tools that the agent can use
    clientTools: {
      scheduleAppointment: ({ date, time }: { date: string, time: string }) => {
        toast({
          title: "Appointment Scheduled",
          description: `Appointment set for ${date} at ${time}`,
        });
        return "Appointment has been scheduled successfully";
      },
      recordNote: ({ note }: { note: string }) => {
        toast({
          title: "Note Recorded",
          description: "The agent has recorded a note about this conversation"
        });
        return "Note has been recorded";
      }
    },
    // Optional overrides for conversational behavior
    overrides: {
      agent: {
        prompt: {
          prompt: `You are speaking with ${prospectName}${prospectPhone ? ` (${isAnonymizationEnabled() ? '[PHONE HIDDEN]' : prospectPhone})` : ''}. Be friendly and professional. You are an AI assistant helping with real estate inquiries.`,
        },
        firstMessage: `Hello ${prospectName}, I'm calling from eXp Realty. How are you doing today?`,
        language: "en",
      }
    }
  });

  // Get status from the conversation hook
  const { status, isSpeaking } = conversation;
  
  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start the conversation
  const handleStartConversation = async () => {
    try {
      // Request microphone permissions
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get the signed URL from our backend
      const signedUrl = await getSignedUrl(agentId);
      if (!signedUrl) {
        throw new Error("Failed to get conversation URL");
      }
      
      // Start the conversation with ElevenLabs
      await conversation.startSession({
        agentId: agentId,  // Use agentId directly, not url
      });
      setIsMicEnabled(true);
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast({
        title: "Failed to start conversation",
        description: error instanceof Error ? error.message : "Please check microphone permissions and try again",
        variant: "destructive"
      });
    }
  };

  // Toggle the microphone
  const toggleMic = async () => {
    if (!conversationStarted) {
      await handleStartConversation();
      return;
    }
    
    setIsMicEnabled(prev => !prev);
    if (!isMicEnabled) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        toast({
          title: "Microphone Error",
          description: "Failed to access microphone. Please check your permissions.",
          variant: "destructive"
        });
      }
    }
  };

  // End the conversation
  const handleEndConversation = async () => {
    try {
      await conversation.endSession();
      setConversationEnded(true);
      setIsMicEnabled(false);
      
      // Get the last message from the assistant as a summary
      const lastAssistantMessage = [...messages]
        .reverse()
        .find(m => m.role === 'assistant')?.content;
        
      if (onConversationEnd) {
        onConversationEnd(lastAssistantMessage);
      }
      
      toast({
        title: "Conversation Ended",
        description: "The conversation has been ended successfully"
      });
    } catch (error) {
      console.error("Error ending conversation:", error);
      toast({
        title: "Error Ending Conversation",
        description: error instanceof Error ? error.message : "An error occurred while ending the conversation",
        variant: "destructive"
      });
    }
  };

  // Toggle volume (mute/unmute)
  const handleToggleVolume = async (volume: number) => {
    try {
      await conversation.setVolume({ volume });
    } catch (error) {
      console.error("Error setting volume:", error);
    }
  };

  return (
    <div className="flex flex-col h-[500px] border rounded-md">
      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 && !conversationStarted && (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <p>Click the button below to start a conversation with the AI assistant</p>
              <p className="text-sm mt-2">Make sure your microphone is connected and permissions are granted</p>
            </div>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
          >
            <div 
              className={`inline-block p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <p>{message.content}</p>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        
        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="flex items-center justify-center my-2">
            <div className="animate-pulse text-sm text-muted-foreground flex items-center">
              <Volume2 className="h-4 w-4 mr-2" />
              AI is speaking...
            </div>
          </div>
        )}
        
        {/* Connection status */}
        {status === 'connecting' && (
          <div className="flex items-center justify-center my-2">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <span className="text-sm text-muted-foreground">Connecting...</span>
          </div>
        )}
      </div>
      
      {/* Controls Area */}
      <div className="border-t p-4 flex items-center justify-between bg-background">
        <div className="flex items-center space-x-2">
          <Button
            variant={isMicEnabled ? "default" : "outline"}
            size="icon"
            onClick={toggleMic}
            disabled={conversationEnded || isLoadingUrl}
          >
            {isLoadingUrl ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isMicEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleToggleVolume(0)}
            disabled={!conversationStarted || conversationEnded}
          >
            <VolumeX className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleToggleVolume(1)}
            disabled={!conversationStarted || conversationEnded}
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
        
        <div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndConversation}
            disabled={!conversationStarted || conversationEnded}
          >
            End Conversation
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConversationPanel;
