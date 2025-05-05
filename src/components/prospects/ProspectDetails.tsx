
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Prospect, ProspectList } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, MoreHorizontal, Search, Trash } from "lucide-react";

interface ProspectDetailsProps {
  list: ProspectList;
}

const ProspectDetails = ({ list }: ProspectDetailsProps) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchProspects();
  }, [list.id]);

  const fetchProspects = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("list_id", list.id)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setProspects(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching prospects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (prospectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("prospects")
        .update({ status: newStatus })
        .eq("id", prospectId)
        .eq("user_id", user?.id);

      if (error) throw error;
      
      setProspects(
        prospects.map((prospect) =>
          prospect.id === prospectId
            ? { ...prospect, status: newStatus as any }
            : prospect
        )
      );
      
      toast({
        title: "Status updated",
        description: `Prospect status changed to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProspect = async (prospectId: string) => {
    if (!confirm("Are you sure you want to delete this prospect?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("prospects")
        .delete()
        .eq("id", prospectId)
        .eq("user_id", user?.id);

      if (error) throw error;
      
      setProspects(prospects.filter((prospect) => prospect.id !== prospectId));
      
      toast({
        title: "Prospect deleted",
        description: "The prospect has been removed from the list.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting prospect",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phoneNumber;
  };

  const filteredProspects = prospects.filter((prospect) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (prospect.first_name?.toLowerCase().includes(searchLower) || false) ||
      (prospect.last_name?.toLowerCase().includes(searchLower) || false) ||
      prospect.phone_number.includes(searchQuery) ||
      (prospect.property_address?.toLowerCase().includes(searchLower) || false)
    );
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Pending":
        return "outline";
      case "Calling":
        return "default";
      case "Completed":
        return "secondary";
      case "Failed":
        return "destructive";
      case "Do Not Call":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold">{list.list_name}</h2>
          <p className="text-muted-foreground">
            {list.description || "No description provided"}
          </p>
        </div>
        
        <div className="flex w-full sm:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prospects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <p>Loading prospects...</p>
        </div>
      ) : prospects.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <h3 className="font-semibold">No prospects in this list</h3>
          <p className="text-muted-foreground mt-1">
            Import prospects or create prospects manually.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.map((prospect) => (
                <TableRow key={prospect.id}>
                  <TableCell className="font-medium">
                    {prospect.first_name || ""} {prospect.last_name || ""}
                    {!prospect.first_name && !prospect.last_name && "(No name)"}
                  </TableCell>
                  <TableCell>{formatPhoneNumber(prospect.phone_number)}</TableCell>
                  <TableCell>{prospect.property_address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(prospect.status)}>
                      {prospect.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteProspect(prospect.id)}
                          className="text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete Prospect
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleStatusChange(prospect.id, "Pending")}>
                          Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(prospect.id, "Calling")}>
                          Calling
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(prospect.id, "Completed")}>
                          Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(prospect.id, "Failed")}>
                          Failed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(prospect.id, "Do Not Call")}>
                          Do Not Call
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

export default ProspectDetails;
