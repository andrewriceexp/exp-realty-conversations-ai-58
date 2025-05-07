
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { AgentConfig, ProspectList } from "@/types";
import { Upload } from "lucide-react";

interface ImportProspectsSheetProps {
  agentConfigs: AgentConfig[];
  prospectLists: ProspectList[];
  onImport?: (listId: string, configId: string, file: File) => Promise<void>;
}

const ImportProspectsSheet = ({
  agentConfigs,
  prospectLists,
  onImport
}: ImportProspectsSheetProps) => {
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        console.error("Invalid file type. Please upload a CSV file.");
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedListId || !selectedConfigId) {
      return;
    }

    setIsImporting(true);
    
    try {
      if (onImport) {
        await onImport(selectedListId, selectedConfigId, file);
      }
      
      // Reset form and close sheet on success
      setFile(null);
      setSelectedListId("");
      setSelectedConfigId("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error during import:", error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import Prospects
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Import Prospects</SheetTitle>
          <SheetDescription>
            Upload a CSV file to import prospects. The file should contain at least a 'phone_number' column.
          </SheetDescription>
        </SheetHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="list" className="text-right">
              List
            </Label>
            <Select
              value={selectedListId}
              onValueChange={setSelectedListId}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a prospect list" />
              </SelectTrigger>
              <SelectContent>
                {prospectLists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.list_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="config" className="text-right">
              Agent Config
            </Label>
            <Select
              value={selectedConfigId}
              onValueChange={setSelectedConfigId}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select an agent config" />
              </SelectTrigger>
              <SelectContent>
                {agentConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.config_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="file" className="text-right">
              CSV File
            </Label>
            <div className="col-span-3">
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected file: {file.name}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <SheetFooter>
          <Button 
            onClick={handleImport}
            disabled={!file || !selectedListId || !selectedConfigId || isImporting}
          >
            {isImporting ? "Importing..." : "Import Prospects"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ImportProspectsSheet;
