
import { useEffect, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { DashboardStats } from '@/types';
import { format, subDays, startOfDay, endOfDay, formatDistanceToNow } from 'date-fns';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DownloadIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ActiveCallsCard } from '@/components/dashboard/ActiveCallsCard';

const Analytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [callData, setCallData] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("7");
  const [isLoading, setIsLoading] = useState(true);
  const [chartType, setChartType] = useState('calls');

  const periods = [
    { value: "7", label: "Last 7 Days" },
    { value: "14", label: "Last 14 Days" },
    { value: "30", label: "Last 30 Days" },
    { value: "90", label: "Last 90 Days" },
  ];

  const colors = [
    "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8",
    "#82ca9d", "#ffc658", "#8dd1e1", "#a4de6c", "#d0ed57"
  ];

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user, selectedPeriod]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Fetch statistics
      const { data: prospectData, error: prospectError } = await supabase
        .from('prospects')
        .select('count(*)', { count: 'exact' })
        .eq('user_id', user?.id);
      
      if (prospectError) throw prospectError;
      
      const { data: pendingProspectsData, error: pendingProspectsError } = await supabase
        .from('prospects')
        .select('count(*)', { count: 'exact' })
        .eq('user_id', user?.id)
        .eq('status', 'Pending');
        
      if (pendingProspectsError) throw pendingProspectsError;
      
      const { data: completedProspectsData, error: completedProspectsError } = await supabase
        .from('prospects')
        .select('count(*)', { count: 'exact' })
        .eq('user_id', user?.id)
        .eq('status', 'Completed');
        
      if (completedProspectsError) throw completedProspectsError;

      const daysAgo = parseInt(selectedPeriod, 10);
      const startDate = startOfDay(subDays(new Date(), daysAgo));
      
      const { data: callsData, error: callsError } = await supabase
        .from('call_logs')
        .select(`
          id, started_at, ended_at, call_duration_seconds, call_status
        `)
        .eq('user_id', user?.id)
        .gte('started_at', startDate.toISOString());
      
      if (callsError) throw callsError;
      
      const { data: todayCallsData, error: todayCallsError } = await supabase
        .from('call_logs')
        .select('count(*)', { count: 'exact' })
        .eq('user_id', user?.id)
        .gte('started_at', startOfDay(new Date()).toISOString())
        .lte('started_at', endOfDay(new Date()).toISOString());
      
      if (todayCallsError) throw todayCallsError;
      
      const { data: weekCallsData, error: weekCallsError } = await supabase
        .from('call_logs')
        .select('count(*)', { count: 'exact' })
        .eq('user_id', user?.id)
        .gte('started_at', startOfDay(subDays(new Date(), 7)).toISOString());
      
      if (weekCallsError) throw weekCallsError;
      
      // Process the data
      const totalCalls = callsData?.length || 0;
      const completedCalls = callsData?.filter(call => call.call_status === 'completed').length || 0;
      const successRate = totalCalls ? Math.round((completedCalls / totalCalls) * 100) : 0;
      
      let totalDuration = 0;
      callsData?.forEach(call => {
        if (call.call_duration_seconds) {
          totalDuration += call.call_duration_seconds;
        }
      });
      const averageCallDuration = totalCalls ? Math.round(totalDuration / totalCalls) : 0;
      
      // Safely handle count values from Supabase responses
      const totalProspectsCount = typeof prospectData?.[0]?.count === 'number' 
        ? prospectData[0].count 
        : parseInt(prospectData?.[0]?.count as string || '0');
      
      const pendingProspectsCount = typeof pendingProspectsData?.[0]?.count === 'number'
        ? pendingProspectsData[0].count
        : parseInt(pendingProspectsData?.[0]?.count as string || '0');
      
      const completedProspectsCount = typeof completedProspectsData?.[0]?.count === 'number'
        ? completedProspectsData[0].count
        : parseInt(completedProspectsData?.[0]?.count as string || '0');
      
      const todayCallsCount = typeof todayCallsData?.[0]?.count === 'number'
        ? todayCallsData[0].count
        : parseInt(todayCallsData?.[0]?.count as string || '0');
      
      const weekCallsCount = typeof weekCallsData?.[0]?.count === 'number'
        ? weekCallsData[0].count
        : parseInt(weekCallsData?.[0]?.count as string || '0');
      
      // Prepare dashboard stats
      const dashboardStats: DashboardStats = {
        totalProspects: totalProspectsCount,
        totalCalls: totalCalls,
        completedCalls: completedCalls,
        averageCallDuration: averageCallDuration,
        successRate: successRate,
        callsToday: todayCallsCount,
        callsThisWeek: weekCallsCount,
        pendingProspects: pendingProspectsCount,
        completedProspects: completedProspectsCount
      };
      
      setStats(dashboardStats);
      
      // Prepare chart data - group by day
      const chartData: any[] = [];
      const dailyCalls: Record<string, { date: string, calls: number, duration: number }> = {};
      
      callsData?.forEach(call => {
        const date = format(new Date(call.started_at), 'yyyy-MM-dd');
        if (!dailyCalls[date]) {
          dailyCalls[date] = { date, calls: 0, duration: 0 };
        }
        dailyCalls[date].calls += 1;
        dailyCalls[date].duration += call.call_duration_seconds || 0;
      });
      
      // Fill in missing days with zero calls
      for (let i = 0; i <= daysAgo; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (!dailyCalls[date]) {
          dailyCalls[date] = { date, calls: 0, duration: 0 };
        }
      }
      
      // Convert to array and sort by date
      Object.values(dailyCalls)
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach(day => {
          chartData.push({
            date: format(new Date(day.date), 'MM/dd'),
            calls: day.calls,
            avgDuration: day.calls ? Math.round(day.duration / day.calls) : 0
          });
        });
      
      setCallData(chartData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = () => {
    try {
      const csvData = [
        ['Date', 'Calls', 'Average Duration (seconds)'],
        ...callData.map(day => [day.date, day.calls, day.avgDuration])
      ].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `call-analytics-${selectedPeriod}-days.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Analytics data has been downloaded",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data",
        variant: "destructive",
      });
    }
  };

  const renderChart = () => {
    if (chartType === 'calls') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={callData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="calls" stroke="#8884d8" name="Calls" />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'duration') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={callData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="avgDuration" stroke="#82ca9d" name="Average Duration (seconds)" />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'prospects') {
      const prospectData = [
        { name: 'Pending', value: stats?.pendingProspects || 0 },
        { name: 'Completed', value: stats?.completedProspects || 0 },
        { name: 'Remaining', value: (stats?.totalProspects || 0) - ((stats?.pendingProspects || 0) + (stats?.completedProspects || 0)) },
      ];
  
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              dataKey="value"
              isAnimationActive={false}
              data={prospectData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              label
            >
              {prospectData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Prospects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "Loading..." : stats?.totalProspects}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "Loading..." : stats?.totalCalls}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completed Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "Loading..." : stats?.completedCalls}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Call Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "Loading..." : `${stats?.averageCallDuration} seconds`}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "Loading..." : `${stats?.successRate}%`}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calls Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "Loading..." : stats?.callsToday}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calls This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "Loading..." : stats?.callsThisWeek}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="charts" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExportData}>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="chart-type" className="text-sm font-medium">Chart Type:</label>
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select chart type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calls">Calls</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="prospects">Prospects</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Call Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading chart data...</div>
              ) : (
                renderChart()
              )}
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                Data from the last {selectedPeriod} days
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      <ActiveCallsCard />
    </div>
  );
};

export default Analytics;
