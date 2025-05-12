
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Prospect, ProspectStatus } from '@/types';

interface CampaignCallerProps {
  campaignId: string;
  prospectListId: string;
  agentConfigId: string;
}

const CampaignCaller = ({ campaignId, prospectListId, agentConfigId }: CampaignCallerProps) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [currentProspectIndex, setCurrentProspectIndex] = useState(0);
  const { makeCall } = useTwilioCall();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (prospectListId) {
      fetchProspects();
    }
  }, [prospectListId]);

  const fetchProspects = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('list_id', prospectListId)
        .eq('status', 'Pending') // Only get prospects that haven't been called yet
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Type casting to ensure data conforms to Prospect type with correct status enum
      const typedProspects: Prospect[] = data?.map(prospect => ({
        ...prospect,
        status: prospect.status as ProspectStatus
      })) || [];

      setProspects(typedProspects);
    } catch (error: any) {
      toast({
        title: 'Failed to load prospects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallNext = async () => {
    if (!prospects.length || currentProspectIndex >= prospects.length || !user) {
      toast({
        title: 'No more prospects to call',
        description: 'All prospects have been contacted.',
      });
      return;
    }

    const prospect = prospects[currentProspectIndex];
    
    try {
      setIsCalling(true);
      
      const response = await makeCall({
        prospectId: prospect.id,
        agentConfigId,
        userId: user.id
      });
      
      if (response.success) {
        // Update campaign call count
        await supabase
          .from('campaigns')
          .update({ 
            calls_made: currentProspectIndex + 1 
          })
          .eq('id', campaignId);
          
        // Move to next prospect
        setCurrentProspectIndex(prev => prev + 1);
        
        toast({
          title: 'Call initiated',
          description: `Calling ${prospect.first_name || ''} ${prospect.last_name || ''} at ${prospect.phone_number}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Call failed',
        description: error.message || 'An error occurred while making the call',
        variant: 'destructive',
      });
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="border rounded-md p-4 space-y-4">
      <h3 className="text-md font-medium">Campaign Caller</h3>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-muted-foreground">No prospects available to call.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm">
            <div className="flex justify-between mb-2">
              <span>Prospects to call:</span>
              <span className="font-medium">{prospects.length - currentProspectIndex} remaining</span>
            </div>
            {currentProspectIndex < prospects.length && (
              <div className="border-l-2 border-green-500 pl-2 py-1">
                <p className="font-medium">Next: {prospects[currentProspectIndex].first_name} {prospects[currentProspectIndex].last_name}</p>
                <p className="text-muted-foreground text-xs">{prospects[currentProspectIndex].phone_number}</p>
              </div>
            )}
          </div>
          
          <Button 
            className="w-full"
            disabled={isCalling || currentProspectIndex >= prospects.length}
            onClick={handleCallNext}
          >
            {isCalling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Call Next Prospect
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CampaignCaller;
