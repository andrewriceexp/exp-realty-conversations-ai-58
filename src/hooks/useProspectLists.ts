
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ProspectList } from "@/types";

export const useProspectLists = () => {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchProspectLists = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("prospect_lists")
        .select(`
          id, 
          user_id,
          list_name, 
          description, 
          original_filename,
          supabase_storage_path,
          created_at,
          updated_at,
          prospects:prospects(count)
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform the data to include the prospect count
      const transformedData = data.map((list) => ({
        ...list,
        prospect_count: Array.isArray(list.prospects) ? list.prospects.length : 0
      })) as ProspectList[];

      setLists(transformedData);
    } catch (error: any) {
      toast({
        title: "Error fetching prospect lists",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addList = (newList: ProspectList) => {
    setLists([newList, ...lists]);
  };

  const removeList = (id: string) => {
    setLists(lists.filter(list => list.id !== id));
  };

  const handleDeleteList = async (id: string, listName: string) => {
    if (!confirm(`Are you sure you want to delete the list "${listName}"? This will also delete all prospects in this list.`)) {
      return;
    }

    try {
      // Delete all prospects in the list first
      const { error: prospectsError } = await supabase
        .from("prospects")
        .delete()
        .eq("list_id", id);

      if (prospectsError) throw prospectsError;

      // Then delete the list
      const { error } = await supabase
        .from("prospect_lists")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "List deleted",
        description: `The list "${listName}" and all its prospects were deleted.`,
      });

      removeList(id);
    } catch (error: any) {
      toast({
        title: "Error deleting list",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  useEffect(() => {
    fetchProspectLists();
  }, []);

  return {
    lists,
    loading,
    addList,
    handleDeleteList,
    formatDate,
    fetchProspectLists
  };
};
