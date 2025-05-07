
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyConfigStateProps {
  onCreate: () => void;
}

export const EmptyConfigState = ({ onCreate }: EmptyConfigStateProps) => {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">No configuration selected or created yet.</p>
        <Button onClick={onCreate}>Create New Configuration</Button>
      </CardContent>
    </Card>
  );
};
