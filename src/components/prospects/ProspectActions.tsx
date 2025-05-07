
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Phone, Loader2, AlertCircle, Settings } from 'lucide-react';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AgentConfig } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';

interface ProspectActionsProps {
  prospectId: string;
  prospectName: string;
}

const ProspectActions = ({ prospectId, prospectName }: ProspectActionsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { makeCall, isLoading: isCallingLoading } = useTwilioCall();
  const { user } = useAuth();
  const { toast } = useToast();

  const openCallDialog = async () => {
    setCallError(null);
    setErrorCode(null);
    setIsLoadingConfigs(true);
    try {
      console.log('Fetching agent configurations');
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading agent configurations:', error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} agent configurations`);
      setConfigs(data || []);
      if (data && data.length > 0) {
        setSelectedConfigId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading agent configurations:', error);
      toast({
        title: 'Error loading configurations',
        description: error.message || 'Failed to load agent configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingConfigs(false);
      setIsDialogOpen(true);
    }
  };

  const handleMakeCall = async () => {
    setCallError(null);
    setErrorCode(null);
    
    if (!selectedConfigId || !user?.id) {
      toast({
        title: 'Missing information',
        description: 'Please select an agent configuration',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      console.log('Making call with:', {
        prospectId,
        agentConfigId: selectedConfigId,
        userId: user.id
      });
      
      const response = await makeCall({
        prospectId,
        agentConfigId: selectedConfigId,
        userId: user.id
      });
      
      console.log('Call response:', response);
      
      if (response.success) {
        setIsDialogOpen(false);
        toast({
          title: 'Call initiated',
          description: `Call to ${prospectName} initiated successfully.`,
        });
      } else {
        // Store the error code if available
        setErrorCode(response.code || null);
        throw new Error(response.error || 'Unknown error initiating call');
      }
    } catch (error: any) {
      console.error("Error making call:", error);
      setCallError(error.message || 'An error occurred while trying to make the call');
    }
  };

  const isProfileError = () => {
    return errorCode === 'PROFILE_NOT_FOUND' || 
           errorCode === 'TWILIO_CONFIG_INCOMPLETE' || 
           (callError && (
             callError.includes('Profile') || 
             callError.includes('Twilio configuration')
           ));
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openCallDialog}>
        <Phone className="mr-2 h-4 w-4" /> Call
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call {prospectName || 'Prospect'}</DialogTitle>
            <DialogDescription>
              Select an agent configuration to use for this call
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {callError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {callError}
                  {isProfileError() && (
                    <div className="mt-2">
                      <Link to="/profile-setup" className="flex items-center text-sm font-medium underline">
                        <Settings className="mr-1 h-4 w-4" /> Go to Profile Setup
                      </Link>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            {isLoadingConfigs ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No agent configurations available.</p>
                <p className="text-sm mt-2">
                  <Button 
                    variant="link" 
                    onClick={() => window.location.href = '/agent-config'}
                  >
                    Create one now
                  </Button>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="config">Agent Configuration</Label>
                <Select
                  value={selectedConfigId}
                  onValueChange={setSelectedConfigId}
                  disabled={configs.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map(config => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.config_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMakeCall} 
              disabled={isCallingLoading || !selectedConfigId}
            >
              {isCallingLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calling...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" /> Make Call
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProspectActions;
