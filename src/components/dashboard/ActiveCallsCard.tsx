
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { PhoneCall, Phone } from 'lucide-react';

export function ActiveCallsCard() {
  const { user } = useAuth();
  const { endCurrentCall } = useTwilioCall();
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingCall, setEndingCall] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveCalls = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('call_logs')
          .select(`
            id,
            twilio_call_sid,
            call_status,
            started_at,
            prospects!inner(id, first_name, last_name, phone_number)
          `)
          .eq('user_id', user.id)
          .in('call_status', ['initiated', 'in-progress', 'ringing', 'queued', 'answered'])
          .order('started_at', { ascending: false });
          
        if (error) throw error;
        
        setActiveCalls(data || []);
      } catch (error) {
        console.error('Error fetching active calls:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchActiveCalls();
    
    // Set up a polling interval to refresh active calls
    const intervalId = setInterval(fetchActiveCalls, 10000);
    
    return () => clearInterval(intervalId);
  }, [user]);
  
  const handleEndCall = async (callSid: string, callId: string) => {
    try {
      setEndingCall(callId);
      await endCurrentCall();
      // Remove the call from the active calls list
      setActiveCalls(prev => prev.filter(call => call.id !== callId));
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setEndingCall(null);
    }
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5" />
          Active Calls
        </CardTitle>
        <CardDescription>Calls currently in progress</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : activeCalls.length > 0 ? (
          <div className="space-y-3">
            {activeCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <p className="font-medium">
                    {call.prospects.first_name} {call.prospects.last_name}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {call.call_status}
                    </span>
                    <span>{formatTime(call.started_at)}</span>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => handleEndCall(call.twilio_call_sid, call.id)}
                  disabled={endingCall === call.id}
                >
                  {endingCall === call.id ? 'Ending...' : 'End Call'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Phone className="mx-auto h-12 w-12 opacity-30 mb-2" />
            <p>No active calls</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
