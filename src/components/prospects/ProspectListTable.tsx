
import { CalendarIcon, Edit, Trash } from "lucide-react";
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
  return (
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
                    onClick={() => onDeleteList(list.id, list.list_name)}
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
  );
};

export default ProspectListTable;
