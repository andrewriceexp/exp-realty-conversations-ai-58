
import { useState, useEffect } from "react";
import { Campaign } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export const useCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        setCampaigns([]);
        return;
      }

      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          prospect_lists(list_name),
          agent_configs(config_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedCampaigns: Campaign[] = data.map(item => ({
        id: item.id,
        user_id: item.user_id,
        name: item.name,
        description: item.description,
        prospect_list_id: item.prospect_list_id,
        agent_config_id: item.agent_config_id,
        status: item.status,
        scheduled_start: item.scheduled_start,
        created_at: item.created_at,
        updated_at: item.updated_at,
        prospect_list_name: item.prospect_lists?.list_name || "",
        agent_config_name: item.agent_configs?.config_name || ""
      }));
      
      setCampaigns(formattedCampaigns);
    } catch (error: any) {
      console.error("Error fetching campaigns:", error);
      toast({
        title: "Error fetching campaigns",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addCampaign = async (campaign: Omit<Campaign, "id" | "user_id" | "created_at" | "updated_at">) => {
    try {
      if (!user) {
        toast({
          title: "Authentication required",
          description: "You need to be logged in to create a campaign",
          variant: "destructive",
        });
        return null;
      }

      const newCampaign = {
        ...campaign,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from("campaigns")
        .insert([newCampaign])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Campaign created",
        description: `The campaign "${campaign.name}" has been created successfully.`,
      });

      // Refresh the campaigns list
      fetchCampaigns();
      return data;
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Error creating campaign",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the campaign "${name}"?`)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      // Remove the campaign from the local state
      setCampaigns(campaigns.filter(campaign => campaign.id !== id));
      
      toast({
        title: "Campaign deleted",
        description: `The campaign "${name}" has been deleted.`,
      });
      
      return true;
    } catch (error: any) {
      console.error("Error deleting campaign:", error);
      toast({
        title: "Error deleting campaign",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateCampaignStatus = async (id: string, status: Campaign["status"]) => {
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      // Update the campaign in local state
      setCampaigns(campaigns.map(campaign => 
        campaign.id === id ? { ...campaign, status } : campaign
      ));

      toast({
        title: "Campaign updated",
        description: `Campaign status changed to ${status}.`,
      });
      
      return true;
    } catch (error: any) {
      console.error("Error updating campaign status:", error);
      toast({
        title: "Error updating campaign",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    } else {
      setCampaigns([]);
      setLoading(false);
    }
  }, [user]);

  return {
    campaigns,
    loading,
    addCampaign,
    deleteCampaign,
    updateCampaignStatus,
    fetchCampaigns
  };
};
