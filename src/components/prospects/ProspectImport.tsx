
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProspectList } from "@/types";
import { Upload } from "lucide-react";

interface ProspectImportProps {
  onSuccess: () => void;
}

const ProspectImport = ({ onSuccess }: ProspectImportProps) => {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useState(() => {
    fetchProspectLists();
  });

  const fetchProspectLists = async () => {
    try {
      setIsLoadingLists(true);
      
      const { data, error } = await supabase
        .from("prospect_lists")
        .select("id, list_name")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setLists(data);
    } catch (error: any) {
      toast({
        title: "Error fetching prospect lists",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingLists(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file.",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedListId) {
      toast({
        title: "No list selected",
        description: "Please select a prospect list.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Read the file
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const csvText = event.target?.result as string;
          
          // Process the CSV (simple parsing)
          const rows = csvText.split('\n');
          const headers = rows[0].split(',').map(header => header.trim().toLowerCase());
          
          // Check for required headers
          if (!headers.includes('phone_number')) {
            toast({
              title: "Invalid CSV format",
              description: "CSV must include a 'phone_number' column.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          
          // Parse the rows into prospect objects
          const prospects = [];
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            
            const values = row.split(',');
            if (values.length !== headers.length) continue;
            
            const prospect: Record<string, any> = {
              list_id: selectedListId,
              user_id: user?.id,
              status: 'Pending',
            };
            
            headers.forEach((header, index) => {
              if (header === 'phone_number') {
                // Format phone number (remove non-numeric chars)
                prospect[header] = values[index].replace(/\D/g, '');
              } else if (['first_name', 'last_name', 'property_address', 'notes'].includes(header)) {
                prospect[header] = values[index].trim();
              }
            });
            
            if (prospect.phone_number && prospect.phone_number.length > 0) {
              prospects.push(prospect);
            }
          }
          
          if (prospects.length === 0) {
            toast({
              title: "No valid prospects found",
              description: "The CSV file doesn't contain any valid prospect data.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          
          // Insert prospects in batches of 100
          const batchSize = 100;
          let successCount = 0;
          
          for (let i = 0; i < prospects.length; i += batchSize) {
            const batch = prospects.slice(i, i + batchSize);
            
            const { error, count } = await supabase
              .from("prospects")
              .insert(batch)
              .select("id");
              
            if (error) {
              console.error("Error inserting batch:", error);
            } else if (count) {
              successCount += count;
            }
          }
          
          // Upload the file to Supabase storage
          const filePath = `prospect_lists/${user?.id}/${selectedListId}/${Date.now()}_${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from("prospects_csv")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });
          
          if (uploadError) {
            console.error("Error uploading file:", uploadError);
          } else {
            // Update the prospect list with the file info
            await supabase
              .from("prospect_lists")
              .update({
                original_filename: file.name,
                supabase_storage_path: filePath,
              })
              .eq("id", selectedListId);
          }
          
          toast({
            title: "Import successful",
            description: `Imported ${successCount} prospects to the selected list.`,
          });
          
          setFile(null);
          setSelectedListId("");
          onSuccess();
        } catch (error: any) {
          console.error("Error processing CSV:", error);
          toast({
            title: "Error processing CSV",
            description: error.message || "An unexpected error occurred",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      };
      
      fileReader.onerror = () => {
        toast({
          title: "Error reading file",
          description: "There was an error reading the CSV file.",
          variant: "destructive",
        });
        setIsLoading(false);
      };
      
      fileReader.readAsText(file);
      
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Import Prospects</h2>
        <p className="text-muted-foreground">
          Upload a CSV file to import prospects to a list.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="list">Select a List</Label>
            <Select
              value={selectedListId}
              onValueChange={setSelectedListId}
              disabled={isLoadingLists}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a prospect list" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.list_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Upload CSV File</Label>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Input 
                id="file" 
                type="file" 
                accept=".csv"
                onChange={handleFileChange} 
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected file: {file.name}
              </p>
            )}
          </div>

          <div className="bg-muted p-4 rounded-md">
            <h3 className="font-medium mb-2">CSV Format Requirements</h3>
            <p className="text-sm text-muted-foreground mb-2">
              The CSV file must contain the following headers:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground">
              <li><strong>phone_number</strong> (required) - Contact phone number</li>
              <li><strong>first_name</strong> (optional) - First name of the prospect</li>
              <li><strong>last_name</strong> (optional) - Last name of the prospect</li>
              <li><strong>property_address</strong> (optional) - Property address</li>
              <li><strong>notes</strong> (optional) - Additional notes or information</li>
            </ul>
          </div>

          <Button 
            onClick={handleImport} 
            disabled={!file || !selectedListId || isLoading} 
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isLoading ? "Importing..." : "Import Prospects"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProspectImport;
