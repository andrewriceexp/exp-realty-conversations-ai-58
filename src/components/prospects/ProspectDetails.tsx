
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, PhoneIcon, MapPinIcon, ClipboardListIcon, EyeIcon, EyeOffIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProspectList, CallLog } from '@/types';
import ProspectActions from './ProspectActions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { 
  anonymizePhoneNumber, 
  anonymizeName, 
  anonymizeAddress, 
  isAnonymizationEnabled, 
  setAnonymizationEnabled 
} from '@/utils/anonymizationUtils';
import { useProspectDetails } from '@/hooks/useProspectDetails';

interface ProspectDetailsProps {
  list: ProspectList;
}

const ProspectDetails = ({ list }: ProspectDetailsProps) => {
  const { user } = useAuth();
  const { 
    prospects, 
    selectedProspect, 
    loading, 
    loadingCustomerData,
    handleProspectSelect, 
    setSelectedProspect 
  } = useProspectDetails(list);
  
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [anonymizeData, setAnonymizeData] = useState(isAnonymizationEnabled());
  const { toast } = useToast();

  // Update localStorage when anonymization preference changes
  useEffect(() => {
    setAnonymizationEnabled(anonymizeData);
  }, [anonymizeData]);

  const fetchCallLogs = async (prospectId: string) => {
    try {
      if (!user) return;

      // Fetch call logs for this prospect
      const { data: callLogsData, error: callLogsError } = await supabase
        .from('call_logs')
        .select(`
          *,
          agent_configs:agent_config_id (config_name)
        `)
        .eq('prospect_id', prospectId)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (callLogsError) throw callLogsError;
      
      // Transform the data to include the config name
      const transformedCallLogs = callLogsData.map(log => ({
        ...log,
        config_name: log.agent_configs ? log.agent_configs.config_name : 'Unknown'
      }));
      
      setCallLogs(transformedCallLogs);
    } catch (error) {
      console.error('Error fetching call logs:', error);
    }
  };

  // When a prospect is selected, fetch their call logs
  useEffect(() => {
    if (selectedProspect) {
      fetchCallLogs(selectedProspect.id);
    }
  }, [selectedProspect]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'calling':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600';
      case 'failed':
        return 'bg-red-500 hover:bg-red-600';
      case 'do not call':
        return 'bg-gray-500 hover:bg-gray-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const formatCallDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const toggleAnonymization = () => {
    setAnonymizeData(prev => !prev);
    toast({
      title: anonymizeData ? "Data displayed normally" : "Data anonymized",
      description: anonymizeData 
        ? "Prospect information is now displayed in its original form." 
        : "Prospect information is now anonymized for privacy.",
    });
  };

  // Helper function to display name with anonymization support
  const displayName = (firstName: string | null | undefined, lastName: string | null | undefined): string => {
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unnamed';
    if (!anonymizeData) return fullName;
    
    return [
      firstName ? anonymizeName(firstName) : null,
      lastName ? anonymizeName(lastName) : null
    ].filter(Boolean).join(' ') || 'Unnamed';
  };

  // Helper function to display phone with anonymization support
  const displayPhone = (phone?: string): string => {
    if (!phone) return '—';
    return anonymizeData ? anonymizePhoneNumber(phone) : phone;
  };

  // Helper function to display address with anonymization support
  const displayAddress = (address: string | null | undefined): string => {
    if (!address) return '—';
    return anonymizeData ? anonymizeAddress(address) : address;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (prospects.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-2">No prospects found</h2>
        <p className="text-muted-foreground mb-6">
          This list doesn't have any prospects yet. You can import prospects or add them manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{list.list_name}</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch 
              checked={anonymizeData} 
              onCheckedChange={toggleAnonymization} 
              id="anonymize-data" 
            />
            <label 
              htmlFor="anonymize-data" 
              className="text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              {anonymizeData ? (
                <>
                  <EyeOffIcon className="h-4 w-4" /> Anonymized
                </>
              ) : (
                <>
                  <EyeIcon className="h-4 w-4" /> Original
                </>
              )}
            </label>
          </div>
          <Badge className="bg-blue-500">{prospects.length} Prospects</Badge>
        </div>
      </div>
      
      {!selectedProspect ? (
        <Card>
          <CardHeader>
            <CardTitle>Prospect List</CardTitle>
            <CardDescription>All contacts in this list</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((prospect) => {
                  return (
                    <TableRow key={prospect.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleProspectSelect(prospect)}>
                      <TableCell>
                        <Badge className={getStatusColor(prospect.status)}>{prospect.status}</Badge>
                      </TableCell>
                      <TableCell>{prospect.last_call_attempted ? formatDate(prospect.last_call_attempted) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <ProspectActions 
                          prospectId={prospect.id} 
                          twilio_customer_id={prospect.twilio_customer_id}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setSelectedProspect(null)} 
              className="text-blue-500 hover:underline flex items-center gap-2"
            >
              ← Back to list
            </button>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(selectedProspect.status)}>{selectedProspect.status}</Badge>
              <ProspectActions 
                prospectId={selectedProspect.id} 
                twilio_customer_id={selectedProspect.twilio_customer_id}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{displayName(selectedProspect.first_name, selectedProspect.last_name)}</span>
                {loadingCustomerData && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingCustomerData ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedProspect.phone_number && (
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{displayPhone(selectedProspect.phone_number)}</span>
                    </div>
                  )}
                  {selectedProspect.property_address && (
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="h-5 w-5 text-muted-foreground" />
                      <span>{displayAddress(selectedProspect.property_address)}</span>
                    </div>
                  )}
                  {selectedProspect.last_call_attempted && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      <span>Last contacted: {formatDate(selectedProspect.last_call_attempted)}</span>
                    </div>
                  )}
                  {selectedProspect.notes && (
                    <div className="flex items-start gap-2 md:col-span-2">
                      <ClipboardListIcon className="h-5 w-5 text-muted-foreground mt-1" />
                      <span>{anonymizeData ? '*** Notes hidden for privacy ***' : selectedProspect.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>Previous interactions with this prospect</CardDescription>
            </CardHeader>
            <CardContent>
              {callLogs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No calls have been made to this prospect yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {callLogs.map((log) => (
                    <Card key={log.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-500">{log.call_status}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(log.started_at)}
                            </span>
                          </div>
                          <div className="text-sm">
                            Duration: {formatCallDuration(log.call_duration_seconds)}
                          </div>
                        </div>
                        
                        <div className="text-sm mb-2">
                          Agent config: <span className="font-medium">{log.config_name}</span>
                        </div>
                        
                        {log.transcript && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium mb-1">Transcript:</h4>
                            <p className="text-sm bg-muted p-2 rounded">
                              {anonymizeData 
                                ? log.transcript.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "***-***-****")
                                                .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "*** ***")
                                : log.transcript}
                            </p>
                          </div>
                        )}
                        
                        {log.summary && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium mb-1">Summary:</h4>
                            <p className="text-sm">
                              {anonymizeData 
                                ? log.summary.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "***-***-****")
                                             .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "*** ***")
                                : log.summary}
                            </p>
                          </div>
                        )}
                        
                        {log.recording_url && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium mb-1">Recording:</h4>
                            <audio controls src={log.recording_url} className="w-full">
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProspectDetails;
