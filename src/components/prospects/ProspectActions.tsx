
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { CallDialog } from './call-actions';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';
import { useToast } from '@/components/ui/use-toast';

interface ProspectActionsProps {
  prospectId: string;
  prospectName?: string;
}

const ProspectActions = ({ prospectId, prospectName }: ProspectActionsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const handleComplete = () => {
    // Function to handle call completion
    console.log("Call completed");
  };
  
  const handleReload = () => {
    // Function to handle reload after call
    console.log("Reloading after call");
    // This could trigger a data refresh in a parent component
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
        <Phone className="mr-2 h-4 w-4" /> Call
      </Button>
      
      <CallDialog 
        prospectId={prospectId}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCallComplete={handleComplete}
        reload={handleReload}
        prospectName={prospectName}
      />
    </>
  );
};

export default ProspectActions;
