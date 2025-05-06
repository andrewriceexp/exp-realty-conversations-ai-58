
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

interface EmptyCampaignListStateProps {
  onCreateClick: () => void;
}

const EmptyCampaignListState = ({ onCreateClick }: EmptyCampaignListStateProps) => {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">No Campaigns</CardTitle>
        <CardDescription>
          You haven't created any voice campaigns yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Create a campaign to start calling prospects with your AI voice agent.</p>
      </CardContent>
      <CardFooter>
        <Button onClick={onCreateClick} size="sm">
          <Phone className="mr-2 h-4 w-4" />
          Create First Campaign
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmptyCampaignListState;
