
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { CallDialog } from './call-actions';
import { isAnonymizationEnabled } from '@/utils/anonymizationUtils';

interface ProspectActionsProps {
  prospectId: string;
  prospectName: string;
}

const ProspectActions = ({ prospectId, prospectName }: ProspectActionsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
        <Phone className="mr-2 h-4 w-4" /> Call
      </Button>
      
      <CallDialog 
        prospectId={prospectId}
        prospectName={prospectName}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
};

export default ProspectActions;
