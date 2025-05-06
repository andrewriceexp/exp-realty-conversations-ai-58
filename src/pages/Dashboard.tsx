
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Phone, 
  Calendar, 
  Clock, 
  ChevronRight,
  ListChecks, 
  Bot,
  Settings
} from 'lucide-react';
import { DashboardStats, ProspectStatus } from '@/types';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    callsToday: 0,
    callsThisWeek: 0,
    totalProspects: 0,
    pendingProspects: 0,
    completedProspects: 0,
    averageCallDuration: 0,
  });
  const [agentConfigCount, setAgentConfigCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
      fetchAgentConfigCount();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Get today and start of week dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as start of week

      // Get total calls
      const { count: totalCalls, error: callsError } = await supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', user?.id);

      // Get calls today
      const { count: callsToday, error: todayError } = await supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', user?.id)
        .gte('started_at', today.toISOString());

      // Get calls this week
      const { count: callsThisWeek, error: weekError } = await supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', user?.id)
        .gte('started_at', startOfWeek.toISOString());

      // Get prospect totals
      const { data: prospects, error: prospectsError } = await supabase
        .from('prospects')
        .select('status')
        .eq('user_id', user?.id);

      // Get average call duration
      const { data: callDurations, error: durationsError } = await supabase
        .from('call_logs')
        .select('call_duration_seconds')
        .eq('user_id', user?.id)
        .not('call_duration_seconds', 'is', null);

      if (callsError || todayError || weekError || prospectsError || durationsError) {
        console.error('Error fetching stats:', callsError || todayError || weekError || prospectsError || durationsError);
        return;
      }

      // Calculate prospect stats
      const totalProspects = prospects?.length || 0;
      const pendingProspects = prospects?.filter(p => p.status === 'Pending').length || 0;
      const completedProspects = prospects?.filter(p => p.status === 'Completed').length || 0;

      // Calculate average call duration
      let averageCallDuration = 0;
      if (callDurations && callDurations.length > 0) {
        const totalDuration = callDurations.reduce((sum, call) => {
          return sum + (call.call_duration_seconds || 0);
        }, 0);
        averageCallDuration = Math.round(totalDuration / callDurations.length);
      }

      setStats({
        totalCalls: totalCalls || 0,
        callsToday: callsToday || 0,
        callsThisWeek: callsThisWeek || 0,
        totalProspects,
        pendingProspects,
        completedProspects,
        averageCallDuration,
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentConfigCount = async () => {
    try {
      const { count, error } = await supabase
        .from('agent_configs')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error fetching agent configs count:', error);
        return;
      }

      setAgentConfigCount(count || 0);
    } catch (error) {
      console.error('Error fetching agent configs count:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Check if profile needs setup
  const needsProfileSetup = profile && (!profile.twilio_account_sid || !profile.twilio_phone_number);

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>

        {needsProfileSetup && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-yellow-800">Complete Your Profile Setup</h3>
                <p className="text-yellow-700">
                  Configure your Twilio credentials to start making calls to prospects.
                </p>
              </div>
              <Button onClick={() => navigate('/profile')}>
                Complete Setup
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Calls</CardTitle>
              <CardDescription>All time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Phone className="w-8 h-8 text-blue-500 mr-2" />
                <span className="text-3xl font-bold">{stats.totalCalls}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 text-xs text-muted-foreground">
              <div>
                Today: {stats.callsToday} | This week: {stats.callsThisWeek}
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Prospects</CardTitle>
              <CardDescription>Total prospects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="w-8 h-8 text-green-500 mr-2" />
                <span className="text-3xl font-bold">{stats.totalProspects}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 text-xs text-muted-foreground">
              <div>
                Pending: {stats.pendingProspects} | Completed: {stats.completedProspects}
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Avg. Call Duration</CardTitle>
              <CardDescription>All calls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-purple-500 mr-2" />
                <span className="text-3xl font-bold">{formatTime(stats.averageCallDuration)}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 text-xs text-muted-foreground">
              <div>Minutes:seconds</div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Agent Configs</CardTitle>
              <CardDescription>AI voice agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Bot className="w-8 h-8 text-orange-500 mr-2" />
                <span className="text-3xl font-bold">{agentConfigCount}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 text-xs text-muted-foreground">
              <div>
                {agentConfigCount === 0 ? 'No agents configured yet' : 'Configured and ready'}
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your prospecting activities</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Button 
                variant="outline" 
                className="flex justify-between w-full"
                onClick={() => navigate('/prospects')}
              >
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  <span>Manage Prospects</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <Button 
                variant="outline" 
                className="flex justify-between w-full"
                onClick={() => navigate('/campaigns')}
              >
                <div className="flex items-center">
                  <ListChecks className="w-5 h-5 mr-2" />
                  <span>Manage Campaigns</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </Button>

              <Button 
                variant="outline" 
                className="flex justify-between w-full"
                onClick={() => navigate('/agent-config')}
              >
                <div className="flex items-center">
                  <Bot className="w-5 h-5 mr-2" />
                  <span>Configure AI Agents</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <Button 
                variant="outline" 
                className="flex justify-between w-full"
                onClick={() => navigate('/profile')}
              >
                <div className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  <span>Profile Settings</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
              <CardDescription>Complete these tasks to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className={`w-5 h-5 rounded-full ${needsProfileSetup ? 'bg-yellow-500' : 'bg-green-500'} mr-3 mt-1 flex-shrink-0`}></div>
                  <div>
                    <h3 className="font-medium">Setup Twilio Integration</h3>
                    <p className="text-sm text-muted-foreground">
                      {needsProfileSetup 
                        ? 'Configure your Twilio credentials to enable outbound calling.'
                        : 'Twilio integration is configured and ready.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className={`w-5 h-5 rounded-full ${stats.totalProspects === 0 ? 'bg-yellow-500' : 'bg-green-500'} mr-3 mt-1 flex-shrink-0`}></div>
                  <div>
                    <h3 className="font-medium">Import Prospects</h3>
                    <p className="text-sm text-muted-foreground">
                      {stats.totalProspects === 0 
                        ? 'Upload your first prospect list to start making calls.'
                        : `You have ${stats.totalProspects} prospects ready for calling.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className={`w-5 h-5 rounded-full ${agentConfigCount === 0 ? 'bg-yellow-500' : 'bg-green-500'} mr-3 mt-1 flex-shrink-0`}></div>
                  <div>
                    <h3 className="font-medium">Setup AI Agent</h3>
                    <p className="text-sm text-muted-foreground">
                      {agentConfigCount === 0 
                        ? 'Create your first AI agent with custom prompts and voice.'
                        : `You have ${agentConfigCount} AI agent${agentConfigCount > 1 ? 's' : ''} configured.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className={`w-5 h-5 rounded-full ${stats.totalCalls === 0 ? 'bg-yellow-500' : 'bg-green-500'} mr-3 mt-1 flex-shrink-0`}></div>
                  <div>
                    <h3 className="font-medium">Make Your First Call</h3>
                    <p className="text-sm text-muted-foreground">
                      {stats.totalCalls === 0 
                        ? 'Start your first AI-powered call to a prospect.'
                        : `You've made ${stats.totalCalls} call${stats.totalCalls > 1 ? 's' : ''} so far.`}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
