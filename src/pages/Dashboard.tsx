
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats, ProspectList, AgentConfig, CallLog } from '@/types';
import { Phone, List, FileText, User, Calendar, Clock, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    callsToday: 0,
    callsThisWeek: 0,
    totalProspects: 0,
    pendingProspects: 0,
    completedProspects: 0,
    averageCallDuration: 0
  });
  const [recentLists, setRecentLists] = useState<ProspectList[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [configs, setConfigs] = useState<AgentConfig[]>([]);

  // Check if profile setup is complete
  const isProfileComplete = profile && 
    profile.full_name && 
    profile.twilio_account_sid && 
    profile.twilio_auth_token &&
    profile.twilio_phone_number;

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile?.id) return;

      setIsLoading(true);
      try {
        // Fetch stats for each status type separately instead of using group
        const { data: pendingData, error: pendingError } = await supabase
          .from('prospects')
          .select('count', { count: 'exact' })
          .eq('user_id', profile.id)
          .eq('status', 'Pending');
          
        if (pendingError) throw pendingError;
        
        const { data: completedData, error: completedError } = await supabase
          .from('prospects')
          .select('count', { count: 'exact' })
          .eq('user_id', profile.id)
          .eq('status', 'Completed');
          
        if (completedError) throw completedError;
        
        // Get total prospects count
        const { count: totalCount, error: totalError } = await supabase
          .from('prospects')
          .select('*', { count: 'exact' })
          .eq('user_id', profile.id);
          
        if (totalError) throw totalError;
        
        // Get current date in UTC format
        const today = new Date().toISOString().split('T')[0];
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weekAgo = oneWeekAgo.toISOString().split('T')[0];
        
        // Fetch call stats
        const { data: callData, error: callError } = await supabase
          .from('call_logs')
          .select('started_at, call_duration_seconds')
          .eq('user_id', profile.id);
          
        if (callError) throw callError;
        
        // Calculate statistics
        const totalCalls = callData?.length || 0;
        const callsToday = callData?.filter(call => call.started_at.startsWith(today)).length || 0;
        const callsThisWeek = callData?.filter(call => 
          call.started_at >= weekAgo && call.started_at <= today + 'T23:59:59Z'
        ).length || 0;
        
        const validDurations = callData
          ?.map(call => call.call_duration_seconds)
          .filter(duration => duration && duration > 0) as number[];
        
        const averageCallDuration = validDurations?.length
          ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length
          : 0;
        
        setStats({
          totalCalls,
          callsToday,
          callsThisWeek,
          totalProspects: totalCount || 0,
          pendingProspects: pendingData?.[0]?.count || 0,
          completedProspects: completedData?.[0]?.count || 0,
          averageCallDuration
        });
        
        // Fetch recent lists
        const { data: lists, error: listsError } = await supabase
          .from('prospect_lists')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (listsError) throw listsError;
        setRecentLists(lists || []);
        
        // Fetch recent calls
        const { data: calls, error: recentCallsError } = await supabase
          .from('call_logs')
          .select(`
            *,
            prospects:prospect_id (first_name, last_name, phone_number),
            agent_configs:agent_config_id (config_name)
          `)
          .eq('user_id', profile.id)
          .order('started_at', { ascending: false })
          .limit(5);
          
        if (recentCallsError) throw recentCallsError;
        
        // Format call data with prospect info
        const formattedCalls = calls?.map(call => ({
          ...call,
          prospect_name: call.prospects 
            ? `${call.prospects.first_name || ''} ${call.prospects.last_name || ''}`.trim() || 'Unnamed Prospect'
            : 'Unnamed Prospect',
          prospect_phone: call.prospects?.phone_number || '',
          config_name: call.agent_configs?.config_name || 'Unknown Config'
        }));
        
        setRecentCalls(formattedCalls || []);
        
        // Fetch agent configs
        const { data: configsData, error: configsError } = await supabase
          .from('agent_configs')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });
          
        if (configsError) throw configsError;
        setConfigs(configsData || []);
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [profile?.id]);

  if (!isProfileComplete) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-exp-blue mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Complete Your Profile</h2>
            <p className="text-gray-600 mb-6">
              To start using Voice AI Prospecting, please complete your profile setup with your Twilio credentials.
            </p>
            <Button onClick={() => navigate('/profile')} className="exp-gradient">
              Complete Profile Setup
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {profile?.full_name || 'Agent'}</h1>
            <p className="text-gray-600">Here's an overview of your prospecting activity</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => navigate('/prospects/new')} 
              className="flex items-center gap-2 bg-exp-gold hover:bg-exp-gold/90 text-black"
            >
              <List className="h-4 w-4" />
              <span>Upload List</span>
            </Button>
            <Button 
              onClick={() => navigate('/campaigns/new')} 
              className="flex items-center gap-2 exp-gradient"
            >
              <Phone className="h-4 w-4" />
              <span>Start Calling</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Prospects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <User className="h-6 w-6 text-exp-blue mr-2" />
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.totalProspects}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {isLoading ? '...' : stats.pendingProspects} pending calls
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Phone className="h-6 w-6 text-exp-blue mr-2" />
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.totalCalls}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {isLoading ? '...' : stats.callsToday} today | {isLoading ? '...' : stats.callsThisWeek} this week
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Avg. Call Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-exp-blue mr-2" />
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : Math.round(stats.averageCallDuration)}s
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Based on completed calls
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Completed Prospects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Calendar className="h-6 w-6 text-exp-blue mr-2" />
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stats.completedProspects}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {isLoading || stats.totalProspects === 0 
                  ? '0%' 
                  : `${Math.round((stats.completedProspects / stats.totalProspects) * 100)}%`} of total
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Lists */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Prospect Lists</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/prospects')}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded"></div>
                  ))}
                </div>
              ) : recentLists.length > 0 ? (
                <div className="space-y-3">
                  {recentLists.map((list) => (
                    <div 
                      key={list.id} 
                      className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0"
                    >
                      <div className="flex items-center">
                        <List className="h-5 w-5 text-exp-blue mr-3" />
                        <div>
                          <div className="font-medium">{list.list_name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(list.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(`/prospects/${list.id}`)}
                        className="text-exp-blue"
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <List className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p>No prospect lists yet</p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/prospects/new')} 
                    className="mt-2 text-exp-blue"
                  >
                    Upload your first list
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Calls */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Calls</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/campaigns')}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded"></div>
                  ))}
                </div>
              ) : recentCalls.length > 0 ? (
                <div className="space-y-3">
                  {recentCalls.map((call) => (
                    <div 
                      key={call.id} 
                      className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0"
                    >
                      <div className="flex items-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                          call.call_status === 'Completed' ? 'bg-green-100 text-green-600' :
                          call.call_status === 'Failed' ? 'bg-red-100 text-red-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          <Phone className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{call.prospect_name}</div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${
                              call.call_status === 'Completed' ? 'bg-green-500' :
                              call.call_status === 'Failed' ? 'bg-red-500' :
                              'bg-blue-500'
                            }`}></span>
                            {call.call_status}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(`/calls/${call.id}`)}
                        className="text-exp-blue"
                      >
                        Details
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Phone className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p>No calls made yet</p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/campaigns/new')} 
                    className="mt-2 text-exp-blue"
                  >
                    Start your first campaign
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agent Configurations Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Voice AI Configurations</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/settings')}
              >
                Manage Configs
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded"></div>
                ))}
              </div>
            ) : configs.length > 0 ? (
              <div className="space-y-3">
                {configs.map((config) => (
                  <div 
                    key={config.id} 
                    className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-exp-blue mr-3" />
                      <div>
                        <div className="font-medium">{config.config_name}</div>
                        <div className="text-xs text-gray-500">
                          {config.voice_provider} | {config.llm_model}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate(`/settings/config/${config.id}`)}
                      className="text-exp-blue"
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p>No AI configurations yet</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/settings/config/new')} 
                  className="mt-2 text-exp-blue"
                >
                  Create your first AI config
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
