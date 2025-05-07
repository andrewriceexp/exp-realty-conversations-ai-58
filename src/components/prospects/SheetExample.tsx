
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import { useProspectLists } from "@/hooks/useProspectLists";
import ImportProspectsSheet from "./ImportProspectsSheet";

const SheetExample = () => {
  const { toast } = useToast();
  const { configs } = useAgentConfigs();
  const { lists, addList } = useProspectLists();

  const handleImport = async (listId: string, configId: string, file: File) => {
    // This is a mock implementation
    // In a real app, you would call an API to process the file
    return new Promise<void>((resolve) => {
      // Simulate API call with a delay
      setTimeout(() => {
        toast({
          title: "Import successful",
          description: `Imported prospects from ${file.name} to list and config`,
        });
        resolve();
      }, 1500);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Sheet Component Example</h2>
        <p className="text-muted-foreground">
          This is an example of using the Sheet component for importing prospects.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <p>Click the button to open the import sheet</p>
            <ImportProspectsSheet 
              agentConfigs={configs}
              prospectLists={lists}
              onImport={handleImport}
            />
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default SheetExample;
