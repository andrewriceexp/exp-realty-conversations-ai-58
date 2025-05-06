
import { useState } from "react";
import MainLayout from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { 
  Bar, 
  BarChart, 
  Cell, 
  Legend,
  Pie, 
  PieChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis 
} from "recharts";
import { DashboardStats, CallStatus, ProspectStatus } from "@/types";

const Analytics = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("overview");

  // Fetch analytics data
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) throw new Error("User not authenticated");

      // Get call statistics
      const { data: callLogs, error: callError } = await supabase
        .from("call_logs")
        .select("*")
        .eq("user_id", user.id);

      if (callError) throw callError;

      // Get prospect statistics
      const { data: prospects, error: prospectError } = await supabase
        .from("prospects")
        .select("*")
        .eq("user_id", user.id);

      if (prospectError) throw prospectError;

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      const totalCalls = callLogs?.length || 0;
      const callsToday = callLogs?.filter(call => 
        new Date(call.started_at) >= todayStart
      ).length || 0;
      
      const callsThisWeek = callLogs?.filter(call => 
        new Date(call.started_at) >= weekStart
      ).length || 0;

      const totalProspects = prospects?.length || 0;
      const pendingProspects = prospects?.filter(p => p.status === "Pending").length || 0;
      const completedProspects = prospects?.filter(p => p.status === "Completed").length || 0;

      // Calculate average call duration
      let totalDuration = 0;
      let callsWithDuration = 0;
      callLogs?.forEach(call => {
        if (call.call_duration_seconds) {
          totalDuration += call.call_duration_seconds;
          callsWithDuration++;
        }
      });
      
      const averageCallDuration = callsWithDuration > 0 
        ? Math.round(totalDuration / callsWithDuration) 
        : 0;

      return {
        totalCalls,
        callsToday,
        callsThisWeek,
        totalProspects,
        pendingProspects,
        completedProspects,
        averageCallDuration
      };
    },
    enabled: !!user
  });

  // Prepare chart data
  const callStatusData = useQuery({
    queryKey: ["call-status-data"],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("call_logs")
        .select("call_status")
        .eq("user_id", user.id);

      if (error) throw error;

      // Count occurrences of each status
      const statusCounts: Record<CallStatus, number> = {} as Record<CallStatus, number>;
      
      data.forEach(item => {
        const status = item.call_status as CallStatus;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      // Convert to array for chart
      return Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count
      }));
    },
    enabled: !!user
  });

  const prospectStatusData = useQuery({
    queryKey: ["prospect-status-data"],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("prospects")
        .select("status")
        .eq("user_id", user.id);

      if (error) throw error;

      // Count occurrences of each status
      const statusCounts: Record<ProspectStatus, number> = {} as Record<ProspectStatus, number>;
      
      data.forEach(item => {
        const status = item.status as ProspectStatus;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      // Convert to array for chart
      return Object.entries(statusCounts).map(([status, count]) => ({
        name: status,
        value: count
      }));
    },
    enabled: !!user
  });

  // Colors for pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A4DE6C'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calls">Call Analytics</TabsTrigger>
            <TabsTrigger value="prospects">Prospect Analytics</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Key Metric Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{stats?.totalCalls}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{stats?.callsToday}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{stats?.totalProspects}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Call Duration</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{stats?.averageCallDuration}s</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Call Outcomes</CardTitle>
                  <CardDescription>
                    Distribution of call statuses across all campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  {callStatusData.isLoading ? (
                    <div className="h-80 flex items-center justify-center">
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : callStatusData.data?.length ? (
                    <ChartContainer config={{}} className="h-80">
                      <BarChart data={callStatusData.data}>
                        <XAxis dataKey="status" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="#8884d8" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No call data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Prospect Status</CardTitle>
                  <CardDescription>
                    Current status of all prospects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {prospectStatusData.isLoading ? (
                    <div className="h-80 flex items-center justify-center">
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : prospectStatusData.data?.length ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={prospectStatusData.data}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {prospectStatusData.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <ChartTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No prospect data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Call Analytics Tab */}
          <TabsContent value="calls" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call Performance</CardTitle>
                <CardDescription>
                  Detailed breakdown of call outcomes and performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This section will be expanded with more detailed call analytics in a future update.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prospect Analytics Tab */}
          <TabsContent value="prospects" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Prospect Engagement</CardTitle>
                <CardDescription>
                  Analysis of prospect engagement and conversion metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This section will be expanded with more detailed prospect analytics in a future update.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;
