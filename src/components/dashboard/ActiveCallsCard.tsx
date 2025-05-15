
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export function ActiveCallsCard() {
  const { user } = useAuth();
  const [activeCalls, setActiveCalls] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchActiveCalls = async () => {
      setIsLoading(true);
      try {
        const { data, error, count } = await supabase
          .from('call_logs')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .in('call_status', ['in-progress', 'ringing', 'initiated']);
        
        if (error) throw error;
        
        setActiveCalls(count || 0);
      } catch (error) {
        console.error('Error fetching active calls:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveCalls();

    // Subscribe to changes in call_logs table
    const callsSubscription = supabase
      .channel('active_calls_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'call_logs',
          filter: `user_id=eq.${user.id}`,
        }, 
        () => {
          fetchActiveCalls();
        }
      )
      .subscribe();

    return () => {
      callsSubscription.unsubscribe();
    };
  }, [user]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Active Calls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? "Loading..." : activeCalls}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {activeCalls === 1 ? 'Call' : 'Calls'} currently in progress
        </p>
      </CardContent>
    </Card>
  );
}
