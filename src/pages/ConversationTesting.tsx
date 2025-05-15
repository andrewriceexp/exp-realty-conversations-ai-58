import { useState, useEffect, useCallback } from "react";
import MainLayout from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@/hooks/use-auth";
import ConversationPanel from "@/components/conversations/ConversationPanel";
import ConversationHistory from "@/components/conversations/ConversationHistory";
import { ConversationMetrics } from "@/components/conversations/ConversationMetrics";
import { Loader2, AlertCircle, ExternalLink, RefreshCw, InfoIcon } from "lucide-react";
import { useElevenLabsAuth } from "@/hooks/useElevenLabsAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AgentSettings } from "@/components/agent-config/AgentSettings";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { Textarea } from "@/components/ui/textarea";
import { format } from 'date-fns';

interface AgentOption {
  id: string;
  name: string;
}

export default function ConversationTesting() {
  // Default to the provided agent ID
  const [selectedAgentId, setSelectedAgentId] = useState<string>("6Optf6WRTzp3rEyj2aiL");
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [prospectName, setProspectName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [testScenario, setTestScenario] = useState("");
  const [isTestingActive, setIsTestingActive] = useState(false);
  const [lastApiKeyValidation, setLastApiKeyValidation] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState("testing");
  const [convMessages, setConvMessages] = useState<Array<{role: string; content: string; timestamp: Date}>>([]);
  const [agentResponseTime, setAgentResponseTime] = useState(0);
  const [userResponseTime, setUserResponseTime] = useState(0);
  
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { 
    isReady, 
    error: authError, 
    hasApiKey, 
    validateApiKey, 
    apiKeyStatus,
    isLoading: isAuthLoading,
    lastValidated
  } = useElevenLabsAuth();
  
  const { saveConversation } = useConversationHistory();

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

  // Attempt to fetch agents from the API if the user has a valid API key
  useEffect(() => {
    const fetchAgents = async () => {
      if (!profile?.elevenlabs_api_key || apiKeyStatus !== 'valid') return;
      
      setIsLoadingAgents(true);
      try {
        const response = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
          headers: {
            'xi-api-key': profile.elevenlabs_api_key,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // Auth issue
            console.error("Authentication error fetching agents");
          } else {
            console.error(`Error fetching agents: ${response.status}`);
          }
          return;
        }
        
        const data = await response.json();
        
        if (data && Array.isArray(data)) {
          // Map agents to our format
          const fetchedAgents = data.map((agent: any) => ({
            id: agent.id,
            name: agent.name || `Agent ${agent.id.substring(0, 8)}`
          }));
          
          // Keep our default agents and add new ones that don't conflict
          const existingIds = new Set(agents.map(a => a.id));
          const uniqueNewAgents = fetchedAgents.filter(a => !existingIds.has(a.id));
          
          setAgents([...agents, ...uniqueNewAgents]);
        }
      } catch (error) {
        console.error("Error fetching agents:", error);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    
    fetchAgents();
  }, [profile?.elevenlabs_api_key, apiKeyStatus]);

  // Validate API key when component mounts, but only once
  const validateApiKeyIfNeeded = useCallback(async () => {
    if (!profile) return;
    
    if (hasApiKey && apiKeyStatus !== 'valid' && !isAuthLoading) {
      try {
        await validateApiKey();
        setLastApiKeyValidation(Date.now());
      } catch (error) {
        console.error("API key validation failed:", error);
      }
    }
  }, [hasApiKey, validateApiKey, apiKeyStatus, isAuthLoading, profile]);
  
  useEffect(() => {
    if (hasApiKey) {
      validateApiKeyIfNeeded();
    }
  }, [hasApiKey, validateApiKeyIfNeeded]);

  // Force a re-validation of the API key
  const handleForceRevalidate = async () => {
    if (hasApiKey) {
      try {
        const isValid = await validateApiKey();
        setLastApiKeyValidation(Date.now());
        
        toast({
          title: isValid ? "API Key Validated" : "API Key Validation Failed",
          description: isValid 
            ? "Your ElevenLabs API key is valid and ready to use."
            : "Please check that your API key is correct in your profile settings.",
          variant: isValid ? "default" : "destructive"
        });
      } catch (error) {
        toast({
          title: "API Key Validation Failed",
          description: "An error occurred while validating your API key. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

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
    
    if (!hasApiKey) {
      toast({
        title: "ElevenLabs API Key Required",
        description: "Please configure your ElevenLabs API key in your profile settings",
        variant: "destructive",
      });
      return;
    }
    
    if (apiKeyStatus !== 'valid') {
      try {
        const isValid = await validateApiKey();
        if (!isValid) {
          toast({
            title: "API Key Invalid",
            description: "Your ElevenLabs API key could not be validated. Please check and update it in your profile.",
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        toast({
          title: "API Key Validation Failed",
          description: "An error occurred while validating your API key. Please try again.",
          variant: "destructive"
        });
        return;
      }
    }
    
    // If we got here, the API key is valid and we can start the test
    setIsTestingActive(true);

    // Initialize metrics
    setAgentResponseTime(0);
    setUserResponseTime(0);
    setConvMessages([]);
  };

  // Track conversation messages for metrics
  useEffect(() => {
    // Expose the saveTestConversation method for the ConversationPanel to use
    // @ts-ignore - Attaching to window for convenience in this context
    window.saveTestConversation = async (
      agentId: string,
      agentName: string,
      messages: Array<{role: string; content: string; timestamp: Date}>,
      prospectName?: string,
      prospectPhone?: string,
      summary?: string
    ) => {
      try {
        // Save messages for metrics display
        setConvMessages(messages);
        
        // Save to conversation history
        await saveConversation(
          agentId,
          agentName,
          messages,
          prospectName,
          prospectPhone,
          summary
        );
        
        toast({
          title: "Conversation Saved",
          description: "The conversation has been saved to your history",
        });
        
        return true;
      } catch (error) {
        console.error("Failed to save conversation:", error);
        toast({
          title: "Error Saving Conversation",
          description: "The conversation could not be saved to your history",
          variant: "destructive"
        });
        return false;
      }
    };
    
    return () => {
      // @ts-ignore
      delete window.saveTestConversation;
    };
  }, [saveConversation]);

  const handleConversationEnd = (summary?: string) => {
    setIsTestingActive(false);
    
    if (summary) {
      toast({
        title: "Conversation Summary",
        description: summary.length > 100 ? `${summary.slice(0, 100)}...` : summary,
      });
    }
    
    // Switch to analysis tab when the conversation ends
    if (convMessages.length > 0) {
      setTimeout(() => setCurrentTab("analysis"), 500);
    }
  };

  const navigateToProfile = () => {
    window.location.href = '/profile-setup';
  };

  // Sample test scenarios
  const testScenarios = [
    {
      name: "Basic Introduction",
      scenario: "Test how the agent introduces itself and handles initial greetings."
    },
    {
      name: "Property Inquiry",
      scenario: "Ask about a property at 123 Main St that was recently listed for $450,000."
    },
    {
      name: "Objection Handling",
      scenario: "Express that you're not interested in buying right now, but might be in 6 months."
    },
    {
      name: "Appointment Setting",
      scenario: "See if the agent can successfully schedule a property viewing appointment."
    }
  ];

  const loadTestScenario = (scenario: string) => {
    setTestScenario(scenario);
    toast({
      title: "Test Scenario Loaded",
      description: "You can modify this scenario before starting the test."
    });
  };

  return (
    <MainLayout>
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Conversation Testing</h1>
              <p className="text-muted-foreground">
                Test your ElevenLabs conversational agents before using them in campaigns
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="testing">Testing</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={navigateToProfile}>
                    Update API Key
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleForceRevalidate}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-validate Key
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {hasApiKey && apiKeyStatus === 'valid' && (
            <Alert variant="default" className="border-green-500">
              <AlertCircle className="h-5 w-5 text-green-500" />
              <AlertDescription className="flex justify-between items-center">
                <div>
                  <p>Your ElevenLabs API key is valid and ready to use.</p>
                  <p className="text-sm text-muted-foreground">
                    Last validated: {lastValidated ? new Date(lastValidated).toLocaleTimeString() : 'Never'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleForceRevalidate} disabled={isAuthLoading}>
                  {isAuthLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Re-validate
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <InfoIcon className="h-5 w-5 text-blue-500" />
            <AlertDescription>
              <h4 className="font-medium text-blue-900">Connection Requirements</h4>
              <p className="text-sm text-muted-foreground mt-1">
                This feature requires microphone access and a stable internet connection. If you're having issues connecting:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                <li>Allow microphone permissions when prompted</li>
                <li>Check your internet connection</li>
                <li>Try reconnecting if the first attempt fails</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          <TabsContent value="testing">
            {selectedAgentId && (
              <AgentSettings 
                agentId={selectedAgentId}
                onUpdate={() => {
                  toast({
                    title: "Agent Updated",
                    description: "Agent settings have been successfully updated.",
                  });
                }}
              />
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
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="scenario">Test Scenario (Optional)</Label>
                        <div className="inline-flex gap-2">
                          {testScenarios.map((scenario, index) => (
                            <Button 
                              key={index}
                              variant="outline" 
                              size="sm"
                              onClick={() => loadTestScenario(scenario.scenario)}
                            >
                              {scenario.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        id="scenario"
                        value={testScenario}
                        onChange={(e) => setTestScenario(e.target.value)}
                        placeholder="Describe the test scenario or add notes for yourself"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-4">
                      <Button 
                        onClick={handleStartTest}
                        disabled={!hasApiKey || isAuthLoading || apiKeyStatus === 'invalid'}
                        className="w-full"
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
                      
                      <Alert className="mt-4">
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
          </TabsContent>
          
          <TabsContent value="history">
            <ConversationHistory maxHeight="600px" />
          </TabsContent>
          
          <TabsContent value="analysis">
            {convMessages.length > 0 ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Conversation Analysis</CardTitle>
                    <CardDescription>
                      Metrics and insights from your most recent conversation test
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ConversationMetrics 
                      messages={convMessages} 
                      agentResponseTime={agentResponseTime}
                      userResponseTime={userResponseTime}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Conversation Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {convMessages.map((message, index) => (
                        <div 
                          key={index} 
                          className={`p-3 rounded-lg ${
                            message.role === 'user' 
                              ? 'ml-12 bg-primary text-primary-foreground' 
                              : 'mr-12 bg-muted'
                          }`}
                        >
                          <div className="text-xs mb-1 opacity-70">
                            {message.role === 'user' ? 'You' : 'Assistant'} • {
                              format(message.timestamp, 'h:mm:ss a')
                            }
                          </div>
                          <div>{message.content}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
                <p className="text-lg mb-4">No conversation data available yet</p>
                <p className="text-sm mb-6">Complete a test conversation to see analysis and metrics here</p>
                <Button onClick={() => setCurrentTab('testing')}>
                  Start a Test Conversation
                </Button>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </MainLayout>
  );
}
