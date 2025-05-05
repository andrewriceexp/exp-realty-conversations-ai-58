
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

interface EmptyListStateProps {
  onCreateClick: () => void;
}

const EmptyListState = ({ onCreateClick }: EmptyListStateProps) => {
  return (
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
        <Button onClick={onCreateClick}>
          <List className="mr-2 h-4 w-4" />
          Create Your First List
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmptyListState;
