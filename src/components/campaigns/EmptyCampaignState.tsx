
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
        <div className="mt-4 space-y-4">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary mr-3">
              1
            </div>
            <p className="text-sm">Create a prospect list by importing contacts</p>
          </div>
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary mr-3">
              2
            </div>
            <p className="text-sm">Configure an AI voice agent with your preferred settings</p>
          </div>
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary mr-3">
              3
            </div>
            <p className="text-sm">Create a campaign and select when to start calls</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Select a campaign from the list on the left to view its details and progress.</p>
      </CardFooter>
    </Card>
  );
};

export default EmptyCampaignState;
