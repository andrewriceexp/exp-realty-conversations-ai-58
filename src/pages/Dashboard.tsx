
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CalendarIcon, PhoneCall, Users, ListChecks, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import PreLaunchChecklist from '@/components/PreLaunchChecklist';
import { useToast } from '@/hooks/use-toast';

// Dashboard component to show overview of the system
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProspects: 0,
    totalCalls: 0,
    pendingProspects: 0,
    activeCampaigns: 0
  });
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch dashboard data
  useEffect(() => {
    if (!user) return;
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Get prospect counts
        const { count: totalProspects, error: prospectsError } = await supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
          
        if (prospectsError) throw prospectsError;
        
        // Get pending prospect count
        const { count: pendingProspects, error: pendingError } = await supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'Pending');
          
        if (pendingError) throw pendingError;
        
        // Get call count
        const { count: totalCalls, error: callsError } = await supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
          
        if (callsError) throw callsError;
        
        // Get active campaigns
        const { count: activeCampaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'Active');
          
        if (campaignsError) throw campaignsError;
        
        // Get recent calls
        const { data: recentCallsData, error: recentError } = await supabase
          .from('call_logs')
          .select(`
            id,
            call_status,
            started_at,
            call_duration_seconds,
            recording_url,
            prospects!inner(id, first_name, last_name, phone_number)
          `)
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(5);
          
        if (recentError) throw recentError;
        
        setStats({
          totalProspects: totalProspects || 0,
          pendingProspects: pendingProspects || 0,
          totalCalls: totalCalls || 0,
          activeCampaigns: activeCampaigns || 0
        });
        
        setRecentCalls(recentCallsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          title: "Error loading dashboard data",
          description: "Please try refreshing the page",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [user, toast]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric' 
    }).format(date);
  };
  
  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button onClick={() => navigate('/campaigns/new')}>New Campaign</Button>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Launch Setup</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard 
              title="Total Prospects" 
              value={stats.totalProspects} 
              icon={<Users className="h-5 w-5" />}
              description="Prospects in your database" 
              loading={loading}
            />
            <StatsCard 
              title="Pending Calls" 
              value={stats.pendingProspects} 
              icon={<PhoneCall className="h-5 w-5" />}
              description="Prospects awaiting calls" 
              loading={loading}
            />
            <StatsCard 
              title="Total Calls Made" 
              value={stats.totalCalls} 
              icon={<PhoneCall className="h-5 w-5" />}
              description="Completed voice interactions" 
              loading={loading}
            />
            <StatsCard 
              title="Active Campaigns" 
              value={stats.activeCampaigns} 
              icon={<ListChecks className="h-5 w-5" />}
              description="Campaigns currently running" 
              loading={loading}
            />
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Recent Calls</CardTitle>
              <CardDescription>Your latest prospect interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading recent calls...</div>
              ) : recentCalls.length > 0 ? (
                <div className="divide-y">
                  {recentCalls.map((call) => (
                    <div key={call.id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {call.prospects.first_name} {call.prospects.last_name}
                        </p>
                        <div className="flex items-center text-sm text-muted-foreground gap-2">
                          <CalendarIcon className="h-3 w-3" /> 
                          {formatDate(call.started_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <CallStatusBadge status={call.call_status} />
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDuration(call.call_duration_seconds)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <PhoneCall className="mx-auto h-12 w-12 opacity-30 mb-2" />
                  <p>No calls have been made yet</p>
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => navigate('/prospects')}
                  >
                    Go to prospects to make your first call
                  </Button>
                </div>
              )}
            </CardContent>
            {recentCalls.length > 0 && (
              <CardFooter className="flex justify-end border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => navigate('/analytics')}>
                  View All Call Activity
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickActionCard 
              title="Import Prospects" 
              description="Upload a CSV file with prospect information"
              buttonText="Import Now"
              onClick={() => navigate('/prospects/import')}
            />
            <QuickActionCard 
              title="Configure AI Agent" 
              description="Customize your AI voice assistant behavior"
              buttonText="Configure"
              onClick={() => navigate('/agent-config')}
            />
            <QuickActionCard 
              title="Launch Campaign" 
              description="Start a new automated calling campaign"
              buttonText="Create Campaign"
              onClick={() => navigate('/campaigns/new')}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="setup">
          <PreLaunchChecklist />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ 
  title, 
  value, 
  icon, 
  description, 
  loading 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  description: string;
  loading: boolean;
}) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {loading ? '—' : value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="p-2 bg-muted rounded-md">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ 
  title, 
  description, 
  buttonText, 
  onClick 
}: { 
  title: string; 
  description: string; 
  buttonText: string; 
  onClick: () => void;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={onClick} className="w-full">{buttonText}</Button>
      </CardFooter>
    </Card>
  );
};

// Call Status Badge Component
const CallStatusBadge = ({ status }: { status: string }) => {
  let color = "bg-gray-100 text-gray-800";
  
  switch (status?.toLowerCase()) {
    case "completed":
      color = "bg-green-100 text-green-800";
      break;
    case "failed":
      color = "bg-red-100 text-red-800";
      break;
    case "busy":
    case "no-answer":
      color = "bg-yellow-100 text-yellow-800";
      break;
    case "initiated":
    case "ringing":
      color = "bg-blue-100 text-blue-800";
      break;
    case "answered":
      color = "bg-purple-100 text-purple-800";
      break;
  }
  
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${color}`}>
      {status || "Unknown"}
    </span>
  );
};

export default Dashboard;
