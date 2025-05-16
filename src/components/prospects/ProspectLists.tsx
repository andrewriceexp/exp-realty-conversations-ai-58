
import { useState } from "react";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProspectList } from "@/types";
import { useProspectLists } from "@/hooks/useProspectLists";
import CreateListDialog from "./CreateListDialog";
import EmptyListState from "./EmptyListState";
import ProspectListTable from "./ProspectListTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

interface ProspectListsProps {
  onSelectList: (list: ProspectList) => void;
}

const ProspectLists = ({ onSelectList }: ProspectListsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { lists, loading, addList, handleDeleteList, formatDate } = useProspectLists();

  const handleListCreated = (newList: ProspectList) => {
    addList(newList);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Prospect Lists</h2>
        <Button onClick={() => setIsDialogOpen(true)}>
          <List className="mr-2 h-4 w-4" />
          Create New List
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-8 w-8 text-primary" />
            <span className="ml-2 text-lg">Loading prospect lists...</span>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : lists.length === 0 ? (
        <EmptyListState onCreateClick={() => setIsDialogOpen(true)} />
      ) : (
        <ProspectListTable 
          lists={lists} 
          onSelectList={onSelectList}
          onDeleteList={handleDeleteList}
          formatDate={formatDate}
        />
      )}

      <CreateListDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onListCreated={handleListCreated}
      />
    </div>
  );
};

export default ProspectLists;
