
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campaign, ProspectList, AgentConfig } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface CreateCampaignDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: (campaign: Omit<Campaign, "id" | "user_id" | "created_at" | "updated_at">) => Promise<any>;
}

const formSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  prospect_list_id: z.string().optional(),
  agent_config_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const CreateCampaignDialog = ({ isOpen, onOpenChange, onCampaignCreated }: CreateCampaignDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prospectLists, setProspectLists] = useState<ProspectList[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      prospect_list_id: undefined,
      agent_config_id: undefined,
    },
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Fetch prospect lists
      const { data: listsData, error: listsError } = await supabase
        .from("prospect_lists")
        .select("*")
        .order("created_at", { ascending: false });

      if (listsError) throw listsError;
      setProspectLists(listsData);

      // Fetch agent configs
      const { data: configsData, error: configsError } = await supabase
        .from("agent_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (configsError) throw configsError;
      setAgentConfigs(configsData);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      form.reset();
      fetchData();
    }
  }, [isOpen, user]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    
    try {
      const campaign: Omit<Campaign, "id" | "user_id" | "created_at" | "updated_at"> = {
        name: data.name,
        description: data.description || null,
        prospect_list_id: data.prospect_list_id || null,
        agent_config_id: data.agent_config_id || null,
        status: "Draft",
        scheduled_start: null,
      };
      
      await onCampaignCreated(campaign);
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Error creating campaign",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Create a new voice AI calling campaign to reach your prospects.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Spring 2025 Follow-ups" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this campaign's purpose"
                      className="resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prospect_list_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prospect List (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loading || prospectLists.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a prospect list" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {prospectLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.list_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {prospectLists.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No prospect lists available. Create one in the Prospects section.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agent_config_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Agent Configuration (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loading || agentConfigs.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an AI agent configuration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {agentConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.config_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {agentConfigs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No agent configurations available. Create one in the Agents section.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;
