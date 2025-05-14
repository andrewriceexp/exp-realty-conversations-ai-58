
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertCircle, 
  Check, 
  ExternalLink, 
  Loader2, 
  Plus,
  Trash,
  RefreshCw
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Agent {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
}

export function ElevenLabsAgentManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadAgents();
    }
  }, [user]);

  const loadAgents = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('elevenlabs_agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      setAgents(data || []);
    } catch (error: any) {
      toast({
        title: "Failed to load agents",
        description: error.message || "An error occurred while loading your ElevenLabs agents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAgent = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to add an agent",
        variant: "destructive",
      });
      return;
    }
    
    if (!newAgentId) {
      toast({
        title: "Missing Agent ID",
        description: "Please enter an ElevenLabs Agent ID",
        variant: "destructive",
      });
      return;
    }
    
    if (!newAgentName) {
      toast({
        title: "Missing Agent Name",
        description: "Please enter a name for this agent",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsAddingAgent(true);
      
      // Check if the agent already exists for this user
      const { data: existingAgents } = await supabase
        .from('elevenlabs_agents')
        .select('id')
        .eq('user_id', user.id)
        .eq('agent_id', newAgentId);
        
      if (existingAgents && existingAgents.length > 0) {
        toast({
          title: "Agent Already Exists",
          description: "This agent ID is already in your list",
          variant: "destructive",
        });
        return;
      }
      
      // Add the agent to the database
      const { error } = await supabase
        .from('elevenlabs_agents')
        .insert({
          user_id: user.id,
          agent_id: newAgentId,
          name: newAgentName,
          description: newAgentDescription || null
        });
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "Agent Added",
        description: `"${newAgentName}" has been added to your agents`,
      });
      
      // Reset form fields
      setNewAgentName('');
      setNewAgentId('');
      setNewAgentDescription('');
      setIsDialogOpen(false);
      
      // Reload agents
      loadAgents();
      
    } catch (error: any) {
      toast({
        title: "Error Adding Agent",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsAddingAgent(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('elevenlabs_agents')
        .delete()
        .eq('id', agentId)
        .eq('user_id', user.id);
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "Agent Removed",
        description: "The agent has been removed from your list",
      });
      
      // Update local state
      setAgents(agents.filter(agent => agent.id !== agentId));
      
    } catch (error: any) {
      toast({
        title: "Error Removing Agent",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const hasApiKey = profile?.elevenlabs_api_key !== null && profile?.elevenlabs_api_key !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between">
          <span>ElevenLabs AI Agents</span>
          <Button variant="outline" size="sm" onClick={loadAgents}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Manage your ElevenLabs AI agents for voice conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasApiKey ? (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="mb-1">You need to configure your ElevenLabs API key first.</p>
              <p>Please go to your profile settings to add your ElevenLabs API key.</p>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">You haven't added any ElevenLabs agents yet.</p>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Agent
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add ElevenLabs AI Agent</DialogTitle>
                      <DialogDescription>
                        Enter your ElevenLabs agent details. You can find your agent ID in the ElevenLabs dashboard.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="agent-name">Agent Name</Label>
                        <Input 
                          id="agent-name" 
                          placeholder="My Customer Support Agent" 
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="agent-id">Agent ID</Label>
                        <Input 
                          id="agent-id" 
                          placeholder="6Optf6WRTzp3rEyj2aiL" 
                          value={newAgentId}
                          onChange={(e) => setNewAgentId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="agent-description">Description (Optional)</Label>
                        <Textarea 
                          id="agent-description" 
                          placeholder="A helpful assistant for answering customer questions" 
                          value={newAgentDescription}
                          onChange={(e) => setNewAgentDescription(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <a 
                        href="https://elevenlabs.io/app/convai" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center mt-2"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Find your agents in the ElevenLabs Dashboard
                      </a>
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        onClick={handleAddAgent}
                        disabled={isAddingAgent || !newAgentId || !newAgentName}
                      >
                        {isAddingAgent ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add Agent'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <div className="mt-4 text-xs text-muted-foreground">
                  <p>Don't have an agent yet?</p>
                  <a
                    href="https://elevenlabs.io/docs/conversational-ai/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary flex items-center justify-center mt-1"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Learn how to create one
                  </a>
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Agent ID</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="font-mono text-xs">{agent.agent_id}</TableCell>
                        <TableCell className="hidden md:table-cell">{agent.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove "{agent.name}" from your agent list. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteAgent(agent.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Agent
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add ElevenLabs AI Agent</DialogTitle>
                      <DialogDescription>
                        Enter your ElevenLabs agent details. You can find your agent ID in the ElevenLabs dashboard.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="agent-name">Agent Name</Label>
                        <Input 
                          id="agent-name" 
                          placeholder="My Customer Support Agent" 
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="agent-id">Agent ID</Label>
                        <Input 
                          id="agent-id" 
                          placeholder="6Optf6WRTzp3rEyj2aiL" 
                          value={newAgentId}
                          onChange={(e) => setNewAgentId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="agent-description">Description (Optional)</Label>
                        <Textarea 
                          id="agent-description" 
                          placeholder="A helpful assistant for answering customer questions" 
                          value={newAgentDescription}
                          onChange={(e) => setNewAgentDescription(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <a 
                        href="https://elevenlabs.io/app/convai" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center mt-2"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Find your agents in the ElevenLabs Dashboard
                      </a>
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        onClick={handleAddAgent}
                        disabled={isAddingAgent || !newAgentId || !newAgentName}
                      >
                        {isAddingAgent ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add Agent'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-2">
        <div className="text-xs text-muted-foreground flex space-x-4">
          <a 
            href="https://elevenlabs.io/app/convai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary flex items-center"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            ElevenLabs Dashboard
          </a>
          <a 
            href="https://elevenlabs.io/docs/conversational-ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary flex items-center"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Documentation
          </a>
        </div>
      </CardFooter>
    </Card>
  );
}
