import React, { useEffect, useState, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { useAuth } from '@/hooks/use-auth';
import { useElevenLabs } from '@/contexts/ElevenLabsContext';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, RefreshCcw, Volume2, VolumeX, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';

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

const MAX_RETRY_ATTEMPTS = 3;
const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds
const RECONNECT_DELAY_MS = 1000; // 1 second delay before reconnect

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  agentId,
  prospectName = 'Prospect',
  prospectPhone,
  onConversationEnd,
}) => {
  const { getSignedUrl, isLoading: isLoadingUrl, error: urlError, clearError } = useElevenLabs();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionTimer, setConnectionTimer] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, profile, session } = useAuth();
  const { isReady, error: authError, hasApiKey, apiKeyStatus } = useElevenLabsAuth();
  
  // Reset error states when component unmounts or when key dependencies change
  useEffect(() => {
    return () => {
      clearError();
      setConnectionError(null);
      setDebugInfo(null);
      if (connectionTimer) {
        clearTimeout(connectionTimer);
      }
    };
  }, [clearError, agentId, connectionTimer]);
  
  // Initialize the conversation hook from ElevenLabs SDK
  const conversation = useConversation({
    onMessage: ((message: any) => {
      console.log('[ConversationPanel] Received message from conversation:', message);
      
      // Handle the message based on its type
      if (message.type === 'assistant_response' || message.type === 'agent_response') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: message.content || message.agent_response_event?.agent_response || '',
          timestamp: new Date()
        }]);
      } else if (message.type === 'user_speech_final' || message.type === 'user_transcript') {
        setMessages(prev => [...prev, {
          role: 'user',
          content: message.content || message.user_transcription_event?.user_transcript || '',
          timestamp: new Date()
        }]);
      }
    }) as any,
    onError: (error: any) => {
      console.error('[ConversationPanel] Conversation error:', error);
      let errorMessage = typeof error === 'object' && error !== null && 'message' in error 
        ? error.message 
        : String(error);
      
      // Clear any connection timeout
      if (connectionTimer) {
        clearTimeout(connectionTimer);
        setConnectionTimer(null);
      }
      
      setConnectionError(errorMessage);
      toast({
        title: "Conversation Error",
        description: errorMessage,
        variant: "destructive"
      });
      setIsStarting(false);
      setIsMicEnabled(false);
    },
    onConnect: () => {
      console.log('[ConversationPanel] Conversation connected successfully');
      
      // Clear any connection timeout
      if (connectionTimer) {
        clearTimeout(connectionTimer);
        setConnectionTimer(null);
      }
      
      setConnectionError(null);
      setDebugInfo(null);
      setRetryCount(0);
      setConversationStarted(true);
      setIsStarting(false);
      toast({
        title: "Conversation Connected",
        description: "You can now speak with the AI assistant"
      });
    },
    onDisconnect: () => {
      console.log('[ConversationPanel] Conversation disconnected');
      
      // Clear any connection timeout
      if (connectionTimer) {
        clearTimeout(connectionTimer);
        setConnectionTimer(null);
      }
      
      if (conversationStarted && !conversationEnded) {
        // If disconnected unexpectedly
        setConnectionError("Connection was closed unexpectedly. Please try again.");
      }
      
      setConversationEnded(true);
      setIsMicEnabled(false);
      setIsStarting(false);
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

  // Retry logic for connection attempts with exponential backoff
  const retryConnection = async () => {
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      setConnectionError(`Maximum connection attempts reached (${MAX_RETRY_ATTEMPTS}). Please try again later.`);
      setIsStarting(false);
      toast({
        title: "Connection Failed",
        description: "Could not connect after multiple attempts. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    const currentRetry = retryCount + 1;
    const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, retryCount), 10000); // Exponential backoff with 10s max
    
    console.log(`[ConversationPanel] Retrying connection attempt ${currentRetry}/${MAX_RETRY_ATTEMPTS} after ${delay}ms delay`);
    setRetryCount(currentRetry);
    
    // Add a small delay before retrying to avoid rapid reconnection attempts
    setTimeout(() => {
      handleStartConversation();
    }, delay);
  };

  // Start the conversation
  const handleStartConversation = async () => {
    try {
      setIsStarting(true);
      setConnectionError(null);
      setDebugInfo(null);
      
      // Clear any existing connection timeout
      if (connectionTimer) {
        clearTimeout(connectionTimer);
      }
      
      // Request microphone permissions
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micError) {
        throw new Error("Microphone access denied. Please enable microphone access and try again.");
      }
      
      if (!user) {
        throw new Error("You must be logged in to start a conversation");
      }

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again");
      }

      if (!agentId || agentId.trim() === '') {
        throw new Error("Invalid agent ID. Please select a valid agent.");
      }

      console.log('[ConversationPanel] Starting conversation with agent ID:', agentId);
      
      // Get the signed URL from our backend
      console.log('[ConversationPanel] Getting signed URL...');
      const signedUrl = await getSignedUrl(agentId);
      
      if (!signedUrl) {
        const errorMsg = urlError || "Failed to get conversation URL from ElevenLabs. Check your API key.";
        throw new Error(errorMsg);
      }
      
      // IMPORTANT: Don't modify the URL parameters - let ElevenLabs SDK handle format negotiation 
      console.log('[ConversationPanel] Using signed URL without modification:', signedUrl);
      
      // Store debug info to help troubleshoot
      setDebugInfo(`Agent: ${agentId}`);
      
      // Set connection timeout
      const timeoutId = setTimeout(() => {
        console.error("[ConversationPanel] Connection attempt timed out after", CONNECTION_TIMEOUT_MS, "ms");
        setConnectionError(`Connection timed out after ${CONNECTION_TIMEOUT_MS/1000} seconds. Please try again.`);
        setIsStarting(false);
        
        // Auto-retry if we haven't exceeded retry attempts
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          toast({
            title: "Connection timed out",
            description: `Automatically retrying (${retryCount + 1}/${MAX_RETRY_ATTEMPTS + 1})...`
          });
          retryConnection();
        } else {
          toast({
            title: "Connection Failed",
            description: "Maximum retry attempts reached. Please try again later.",
            variant: "destructive"
          });
        }
      }, CONNECTION_TIMEOUT_MS);
      
      setConnectionTimer(timeoutId);
      
      // Start the connection
      try {
        // Pass the signedUrl directly without modifying it
        await conversation.startSession({
          signedUrl
        });
        
        setIsMicEnabled(true);
        setDebugInfo(null);
      } catch (startError) {
        // Clear the timeout since we already got an error
        clearTimeout(timeoutId);
        setConnectionTimer(null);
        
        console.error("[ConversationPanel] Failed to start session:", startError);
        throw new Error(`Failed to start session: ${startError instanceof Error ? startError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error("[ConversationPanel] Error starting conversation:", error);
      setConnectionError(error instanceof Error ? error.message : "An unknown error occurred");
      setIsStarting(false);
      setIsMicEnabled(false);
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
      // Clear any connection timeout
      if (connectionTimer) {
        clearTimeout(connectionTimer);
        setConnectionTimer(null);
      }
      
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
      console.error("[ConversationPanel] Error ending conversation:", error);
      toast({
        title: "Error Ending Conversation",
        description: error instanceof Error ? error.message : "An error occurred while ending the conversation",
        variant: "destructive"
      });
    }
  };

  // Reinitialize conversation
  const handleRetryConversation = () => {
    // Clear all conversation state and errors
    setConnectionError(null);
    setDebugInfo(null);
    setMessages([]);
    setConversationStarted(false);
    setConversationEnded(false);
    setIsMicEnabled(false);
    setIsStarting(false);
    setRetryCount(0);
    
    // Clear any connection timeout
    if (connectionTimer) {
      clearTimeout(connectionTimer);
      setConnectionTimer(null);
    }
    
    clearError();
    
    // Wait a moment before allowing to try again
    setTimeout(() => {
      toast({
        title: "Ready to try again",
        description: "Please click the microphone button to start a new conversation"
      });
    }, 500);
  };

  // Toggle volume (mute/unmute)
  const handleToggleVolume = async (volume: number) => {
    try {
      await conversation.setVolume({ volume });
      toast({
        title: volume === 0 ? "Audio Muted" : "Audio Unmuted",
        description: volume === 0 ? "AI voice has been muted" : "AI voice has been unmuted"
      });
    } catch (error) {
      console.error("[ConversationPanel] Error setting volume:", error);
    }
  };

  // Clean up conversation on unmount
  useEffect(() => {
    const currentConversation = conversation; // Capture instance
    
    return () => {
      clearError();
      setConnectionError(null);
      setDebugInfo(null);
      
      if (connectionTimer) {
        clearTimeout(connectionTimer);
      }
      
      // Check if conversation is active and should be ended
      if (conversationStarted && !conversationEnded) {
        console.log('[ConversationPanel] Cleaning up: Ending conversation session on unmount');
        currentConversation.endSession().catch(err => 
          console.error("[ConversationPanel] Error ending session on unmount:", err)
        );
      }
    };
  }, [clearError, agentId, connectionTimer, conversation, conversationStarted, conversationEnded]);
  
  // Determine what to show based on auth status and API key
  if (apiKeyStatus === 'missing') {
    return (
      <div className="flex flex-col h-[500px] border rounded-md">
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-medium">ElevenLabs API Key Required</h3>
            <p className="text-muted-foreground">
              To use the conversation feature, you need to add your ElevenLabs API key in your profile settings.
            </p>
            <Button 
              onClick={() => window.location.href = '/profile-setup'} 
              className="mt-4"
            >
              Go to Profile Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] border rounded-md">
      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 && !conversationStarted && !isStarting && (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <p>Click the microphone button below to start a conversation with the AI assistant</p>
              <p className="text-sm mt-2">Make sure your microphone is connected and permissions are granted</p>
            </div>
          </div>
        )}
        
        {isStarting && messages.length === 0 && !conversationStarted && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Starting conversation{retryCount > 0 ? ` (Attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS + 1})` : ''}...</p>
              <p className="text-sm mt-2 text-muted-foreground">This may take a few moments</p>
            </div>
          </div>
        )}
        
        {(connectionError || authError) && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="space-y-2">
              <p className="font-medium">{connectionError || authError}</p>
              {debugInfo && (
                <p className="text-xs opacity-80 mt-1 font-mono break-all">{debugInfo}</p>
              )}
              {!hasApiKey && (
                <p className="text-sm">Please add your ElevenLabs API key in your profile settings.</p>
              )}
              {!user && (
                <p className="text-sm">Please log in to use this feature.</p>
              )}
              <div className="flex justify-end mt-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRetryConversation}
                >
                  <RefreshCcw className="h-3 w-3 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open('https://elevenlabs.io/docs/conversational-ai', '_blank')}
                >
                  <Info className="h-3 w-3 mr-2" />
                  Docs
                </Button>
              </div>
            </AlertDescription>
          </Alert>
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
            disabled={conversationEnded || isLoadingUrl || isStarting}
          >
            {isLoadingUrl || isStarting ? (
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
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://elevenlabs.io/docs/conversational-ai', '_blank')}
          >
            <Info className="h-4 w-4 mr-2" />
            ElevenLabs Docs
          </Button>
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
