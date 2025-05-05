
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ProspectList } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
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
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { CalendarIcon, Edit, List, Trash } from "lucide-react";

interface ProspectListsProps {
  onSelectList: (list: ProspectList) => void;
}

const ProspectLists = ({ onSelectList }: ProspectListsProps) => {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    list_name: "",
    description: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchProspectLists();
  }, []);

  const fetchProspectLists = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("prospect_lists")
        .select(`
          id, 
          list_name, 
          description, 
          created_at, 
          original_filename,
          prospects:prospects(count)
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform the data to include the prospect count
      const transformedData = data.map((list) => ({
        ...list,
        prospect_count: Array.isArray(list.prospects) ? list.prospects.length : 0
      }));

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

  const handleCreateList = async () => {
    try {
      if (!formData.list_name) {
        toast({
          title: "Missing information",
          description: "Please provide a list name",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("prospect_lists")
        .insert({
          list_name: formData.list_name,
          description: formData.description,
          user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "List created",
        description: `The list "${formData.list_name}" was created successfully.`,
      });

      setLists([{ ...data, prospect_count: 0 }, ...lists]);
      setFormData({ list_name: "", description: "" });
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error creating list",
        description: error.message,
        variant: "destructive",
      });
    }
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

      setLists(lists.filter(list => list.id !== id));
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Prospect Lists</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <List className="mr-2 h-4 w-4" />
              Create New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Prospect List</DialogTitle>
              <DialogDescription>
                Create a new list to organize your prospects.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="list_name" className="text-right">
                  List Name
                </Label>
                <Input
                  id="list_name"
                  value={formData.list_name}
                  onChange={(e) => setFormData({...formData, list_name: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateList}>Create List</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <p>Loading prospect lists...</p>
        </div>
      ) : lists.length === 0 ? (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>No Prospect Lists</CardTitle>
            <CardDescription>
              You haven't created any prospect lists yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Create a new list to get started with managing your prospects.</p>
          </CardContent>
          <CardFooter>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)}>
                <List className="mr-2 h-4 w-4" />
                Create Your First List
              </Button>
            </DialogTrigger>
          </CardFooter>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>List Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center">Prospects</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((list) => (
                <TableRow key={list.id}>
                  <TableCell className="font-medium">{list.list_name}</TableCell>
                  <TableCell>{list.description || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {formatDate(list.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{list.prospect_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectList(list)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteList(list.id, list.list_name)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ProspectLists;
