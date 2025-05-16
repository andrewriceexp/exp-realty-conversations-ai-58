
import { CalendarIcon, Edit, Trash, EyeIcon, EyeOffIcon } from "lucide-react";
import { ProspectList } from "@/types";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { isAnonymizationEnabled, setAnonymizationEnabled } from "@/utils/anonymizationUtils";
import { useState, useEffect } from "react";

interface ProspectListTableProps {
  lists: ProspectList[];
  onSelectList: (list: ProspectList) => void;
  onDeleteList: (id: string, listName: string) => void;
  formatDate: (dateString: string) => string;
}

const ProspectListTable = ({ 
  lists, 
  onSelectList, 
  onDeleteList, 
  formatDate 
}: ProspectListTableProps) => {
  const [anonymizeData, setAnonymizeData] = useState(isAnonymizationEnabled());
  
  // Update localStorage when anonymization preference changes
  useEffect(() => {
    setAnonymizationEnabled(anonymizeData);
  }, [anonymizeData]);
  
  const toggleAnonymization = () => {
    setAnonymizeData(prev => !prev);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-2">
        <div className="flex items-center space-x-2">
          <Switch 
            checked={anonymizeData} 
            onCheckedChange={toggleAnonymization} 
            id="anonymize-lists" 
          />
          <label 
            htmlFor="anonymize-lists" 
            className="text-sm font-medium flex items-center gap-1 cursor-pointer"
          >
            {anonymizeData ? (
              <>
                <EyeOffIcon className="h-4 w-4" /> Anonymized View
              </>
            ) : (
              <>
                <EyeIcon className="h-4 w-4" /> Original View
              </>
            )}
          </label>
        </div>
      </div>
      
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
            {lists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No prospect lists found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              lists.map((list) => (
                <TableRow key={list.id}>
                  <TableCell className="font-medium">
                    {anonymizeData && list.list_name 
                      ? `${list.list_name.slice(0, 3)}...${list.list_name.slice(-3)}` 
                      : list.list_name}
                  </TableCell>
                  <TableCell>
                    {anonymizeData && list.description 
                      ? `${list.description.slice(0, 5)}...` 
                      : list.description || "—"}
                  </TableCell>
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
                        onClick={() => onDeleteList(list.id, list.list_name)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ProspectListTable;
