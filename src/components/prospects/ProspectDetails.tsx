
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, PhoneIcon, MapPinIcon, ClipboardListIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Prospect, CallLog } from '@/types';
import ProspectActions from './ProspectActions';

const ProspectDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProspectData();
  }, [id]);

  const fetchProspectData = async () => {
    try {
      setLoading(true);
      if (!id || !user) return;

      // Fetch prospect details
      const { data: prospectData, error: prospectError } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (prospectError) throw prospectError;
      setProspect(prospectData);

      // Fetch call logs for this prospect
      const { data: callLogsData, error: callLogsError } = await supabase
        .from('call_logs')
        .select(`
          *,
          agent_configs:agent_config_id (config_name)
        `)
        .eq('prospect_id', id)
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
      console.error('Error fetching prospect data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!prospect) {
    return <div>Prospect not found.</div>;
  }

  const prospectName = [prospect.first_name, prospect.last_name]
    .filter(Boolean)
    .join(' ') || 'Unnamed Prospect';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{prospectName}</h2>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(prospect.status)}>{prospect.status}</Badge>
          <ProspectActions 
            prospectId={prospect.id} 
            prospectName={prospectName} 
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prospect Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <PhoneIcon className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{prospect.phone_number}</span>
            </div>
            {prospect.property_address && (
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-5 w-5 text-muted-foreground" />
                <span>{prospect.property_address}</span>
              </div>
            )}
            {prospect.last_call_attempted && (
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <span>Last contacted: {formatDate(prospect.last_call_attempted)}</span>
              </div>
            )}
            {prospect.notes && (
              <div className="flex items-start gap-2 md:col-span-2">
                <ClipboardListIcon className="h-5 w-5 text-muted-foreground mt-1" />
                <span>{prospect.notes}</span>
              </div>
            )}
          </div>
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
                        <p className="text-sm bg-muted p-2 rounded">{log.transcript}</p>
                      </div>
                    )}
                    
                    {log.summary && (
                      <div className="mt-2">
                        <h4 className="text-sm font-medium mb-1">Summary:</h4>
                        <p className="text-sm">{log.summary}</p>
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
  );
};

export default ProspectDetails;
