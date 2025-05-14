
import { useState } from "react";
import MainLayout from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import ConversationPanel from "@/components/conversations/ConversationPanel";
import { Loader2 } from "lucide-react";

interface AgentOption {
  id: string;
  name: string;
}

const ConversationTesting = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [prospectName, setProspectName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [isTestingActive, setIsTestingActive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch available ElevenLabs agents (this would be replaced with your actual agent IDs)
  const fetchAgents = async () => {
    setIsLoadingAgents(true);
    try {
      // This is a placeholder. In a real implementation, you would:
      // 1. Either fetch agent IDs from your database
      // 2. Or call an ElevenLabs API endpoint to get your agents
      
      // For demo purposes, we'll use some example agents
      const demoAgents = [
        { id: "948f15c2-a0a9-4429-b566-905724459054", name: "Real Estate Prospecting Agent" },
        { id: "a6f2619c-9bdb-4a5c-b1d8-3680a0fb6149", name: "Property Information Agent" },
        { id: "c703a492-59e9-48a4-88c0-b91124c6a357", name: "Appointment Scheduling Agent" },
      ];
      
      setAgents(demoAgents);
      
      // If you have actual agent IDs stored in your database:
      // const { data, error } = await supabase
      //   .from('elevenlabs_agents')
      //   .select('id, name')
      //   .eq('user_id', user?.id);
      //
      // if (error) throw error;
      // setAgents(data || []);
      
    } catch (error) {
      console.error("Error fetching agents:", error);
      toast({
        title: "Failed to load agents",
        description: "Could not retrieve conversation agents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const handleStartTest = () => {
    if (!selectedAgentId) {
      toast({
        title: "Agent required",
        description: "Please select an agent to start testing",
        variant: "destructive",
      });
      return;
    }
    
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Conversation Testing</h1>
          <p className="text-muted-foreground">
            Test your ElevenLabs conversational agents before using them in campaigns
          </p>
        </div>

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
                    onOpenChange={() => {
                      if (agents.length === 0) {
                        fetchAgents();
                      }
                    }}
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

                <Button onClick={handleStartTest}>
                  Start Test Conversation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ConversationTesting;
