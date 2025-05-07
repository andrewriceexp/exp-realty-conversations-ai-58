
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import { ProspectList } from "@/types";

interface AddProspectManuallyProps {
  listId: string;
  onSuccess: () => void;
}

const AddProspectManually = ({ listId, onSuccess }: AddProspectManuallyProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    firstName: "",
    lastName: "",
    propertyAddress: "",
    notes: ""
  });
  
  const { toast } = useToast();
  const { user } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phoneNumber) {
      toast({
        title: "Phone number required",
        description: "Please enter a phone number for the prospect.",
        variant: "destructive",
      });
      return;
    }

    // Format phone number (remove non-numeric characters)
    const formattedPhone = formData.phoneNumber.replace(/\D/g, '');

    if (formattedPhone.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number with at least 10 digits.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const { error, data } = await supabase
        .from("prospects")
        .insert({
          list_id: listId,
          user_id: user?.id,
          phone_number: formattedPhone,
          first_name: formData.firstName || null,
          last_name: formData.lastName || null,
          property_address: formData.propertyAddress || null,
          notes: formData.notes || null,
          status: 'Pending'
        })
        .select("id");

      if (error) throw error;

      toast({
        title: "Prospect added",
        description: "The prospect was successfully added to the list.",
      });

      // Reset form and close dialog
      setFormData({
        phoneNumber: "",
        firstName: "",
        lastName: "",
        propertyAddress: "",
        notes: ""
      });
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error adding prospect",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Prospect Manually
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new prospect</DialogTitle>
          <DialogDescription>
            Enter the prospect's details manually to add them to the list.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number (required)</Label>
            <Input 
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="(555) 123-4567"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input 
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input 
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Doe"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address</Label>
            <Input 
              id="propertyAddress"
              name="propertyAddress"
              value={formData.propertyAddress}
              onChange={handleChange}
              placeholder="123 Main St, City, State ZIP"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea 
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional information about this prospect"
              rows={3}
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Prospect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProspectManually;
