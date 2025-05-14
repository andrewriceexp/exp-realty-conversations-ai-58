import { useState, useEffect, useCallback } from "react";
import MainLayout from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@/contexts/AuthContext";
import ConversationPanel from "@/components/conversations/ConversationPanel";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useElevenLabsAuth } from "@/hooks/useElevenLabsAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AgentOption {
  id: string;
  name: string;
}

const ConversationTesting = () => {
  // Default to the provided agent ID
  const [selectedAgentId, setSelectedAgentId] = useState<string>("6Optf6WRTzp3rEyj2aiL");
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [prospectName, setProspectName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [isTestingActive, setIsTestingActive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    isReady, 
    error: authError, 
    hasApiKey, 
    validateApiKey, 
    apiKeyStatus,
    isLoading: isAuthLoading
  } = useElevenLabsAuth();

  // Initialize with known agents
  useEffect(() => {
    // Set default agent in the list
    setAgents([
      { id: "6Optf6WRTzp3rEyj2aiL", name: "Real Estate Prospecting Agent (Default)" },
      { id: "948f15c2-a0a9-4429-b566-905724459054", name: "Real Estate Prospecting Agent" },
      { id: "a6f2619c-9bdb-4a5c-b1d8-3680a0fb6149", name: "Property Information Agent" },
      { id: "c703a492-59e9-48a4-88c0-b91124c6a357", name: "Appointment Scheduling Agent" },
    ]);
  }, []);

  // Validate API key when component mounts, but only once
  const validateApiKeyIfNeeded = useCallback(async () => {
    if (hasApiKey && apiKeyStatus !== 'valid' && !isAuthLoading) {
      await validateApiKey();
    }
  }, [hasApiKey, validateApiKey, apiKeyStatus, isAuthLoading]);
  
  useEffect(() => {
    if (hasApiKey) {
      validateApiKeyIfNeeded();
    }
  }, [hasApiKey, validateApiKeyIfNeeded]);

  // Handle navigation to conversation testing
  const handleStartTest = async () => {
    if (!selectedAgentId) {
      toast({
        title: "Agent required",
        description: "Please select an agent to start testing",
        variant: "destructive",
      });
      return;
    }
    
    if (!isReady) {
      if (!hasApiKey) {
        toast({
          title: "ElevenLabs API Key Required",
          description: "Please configure your ElevenLabs API key in your profile settings",
          variant: "destructive",
        });
        return;
      }
      
      if (authError) {
        toast({
          title: "Cannot start conversation",
          description: authError || "Please check your authentication and API key",
          variant: "destructive",
        });
        return;
      }
      
      // If API key status isn't valid, try to validate it now
      if (apiKeyStatus !== 'valid') {
        const isValid = await validateApiKey();
        if (!isValid) {
          return; // The hook will show appropriate error toasts
        }
      }
    }
    
    // If we got here, the API key is valid and we can start the test
    setIsTestingActive(true);
  };

  const handleConversationEnd = (summary?: string) => {
    setIsTestingActive(false);
    
    if (summary) {
      toast({
        title: "Conversation Summary",
        description: summary.length > 100 ? `${summary.slice(0, 100)}...` : summary,
      });
    }
  };

  const navigateToProfile = () => {
    window.location.href = '/profile-setup';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Conversation Testing</h1>
          <p className="text-muted-foreground">
            Test your ElevenLabs conversational agents before using them in campaigns
          </p>
        </div>

        {!hasApiKey && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="space-y-2">
              <p>To use the conversation feature, you need to add an ElevenLabs API key in your profile.</p>
              <Button variant="outline" size="sm" onClick={navigateToProfile}>
                Go to Profile Settings
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {hasApiKey && apiKeyStatus === 'invalid' && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="space-y-2">
              <p>Your ElevenLabs API key appears to be invalid. Please check and update it in your profile settings.</p>
              <Button variant="outline" size="sm" onClick={navigateToProfile}>
                Update API Key
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Configure Test Conversation</CardTitle>
            <CardDescription>
              Select an agent and provide test prospect information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isTestingActive ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">
                    Test Conversation with {prospectName || "Prospect"}
                  </h3>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsTestingActive(false)}
                  >
                    Cancel Test
                  </Button>
                </div>
                
                <ConversationPanel 
                  agentId={selectedAgentId}
                  prospectName={prospectName}
                  prospectPhone={prospectPhone}
                  onConversationEnd={handleConversationEnd}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent">Select Conversation Agent</Label>
                  <Select 
                    value={selectedAgentId} 
                    onValueChange={setSelectedAgentId}
                  >
                    <SelectTrigger id="agent">
                      <SelectValue placeholder="Select an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingAgents ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span>Loading agents...</span>
                        </div>
                      ) : agents.length > 0 ? (
                        agents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-muted-foreground">
                          No agents found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Test Prospect Name</Label>
                  <Input
                    id="name"
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Test Prospect Phone</Label>
                  <Input
                    id="phone"
                    value={prospectPhone}
                    onChange={(e) => setProspectPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="space-y-4">
                  <Button 
                    onClick={handleStartTest}
                    disabled={!hasApiKey || isAuthLoading || apiKeyStatus === 'invalid'}
                  >
                    {isAuthLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating API Key...
                      </>
                    ) : "Start Test Conversation"}
                  </Button>

                  {authError && !hasApiKey && (
                    <p className="text-sm text-destructive mt-2">
                      You need to configure your ElevenLabs API key before starting a conversation.
                    </p>
                  )}
                  
                  <Alert variant="info" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm flex justify-between items-center">
                      <span>
                        Having connection issues? Visit the ElevenLabs docs for troubleshooting tips.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onClick={() => window.open('https://elevenlabs.io/docs/conversational-ai/troubleshooting', '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> 
                        Docs
                      </Button>
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ConversationTesting;
