
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ProspectList } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreateListDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onListCreated: (list: ProspectList) => void;
}

const CreateListDialog = ({ isOpen, onOpenChange, onListCreated }: CreateListDialogProps) => {
  const [formData, setFormData] = useState({
    list_name: "",
    description: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();

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

      const newList = {
        ...data,
        prospect_count: 0
      } as ProspectList;

      onListCreated(newList);
      setFormData({ list_name: "", description: "" });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error creating list",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
  );
};

export default CreateListDialog;
