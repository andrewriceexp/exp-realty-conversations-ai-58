
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

const EmptyCampaignState = () => {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>No Campaign Selected</CardTitle>
        <CardDescription>
          Select a campaign from the list or create a new one to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Voice AI campaigns allow you to automatically call prospects using your configured AI voice agent.</p>
      </CardContent>
      <CardFooter>
        <Button disabled>
          <Phone className="mr-2 h-4 w-4" />
          Select a Campaign
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmptyCampaignState;
