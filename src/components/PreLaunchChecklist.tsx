
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Settings, Users, Bot, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  route: string;
  icon: React.ReactNode;
}

const PreLaunchChecklist = () => {
  const { user, profile } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Check profile setup
        const profileComplete = profile && 
          profile.first_name && 
          profile.twilio_account_sid && 
          profile.twilio_auth_token && 
          profile.twilio_phone_number;
          
        // Check if there's at least one prospect list
        const { count: prospectCount } = await supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
          
        // Check if there's at least one agent config
        const { count: agentCount } = await supabase
          .from('agent_configs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Build checklist
        const newChecklist: ChecklistItem[] = [
          {
            id: 'profile',
            title: 'Complete Profile Setup',
            description: 'Add your name and configure your Twilio credentials',
            completed: !!profileComplete,
            route: '/profile',
            icon: <Settings className="h-5 w-5" />
          },
          {
            id: 'prospects',
            title: 'Add Prospects',
            description: 'Import or create a list of prospects to call',
            completed: (prospectCount || 0) > 0,
            route: '/prospects',
            icon: <Users className="h-5 w-5" />
          },
          {
            id: 'agent',
            title: 'Configure AI Agent',
            description: 'Set up your AI voice agent with customized prompts',
            completed: (agentCount || 0) > 0,
            route: '/agent-config',
            icon: <Bot className="h-5 w-5" />
          }
        ];
        
        setChecklist(newChecklist);
      } catch (error) {
        console.error('Error fetching launch checklist data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, profile]);

  const handleNavigate = (route: string) => {
    navigate(route);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Launch Checklist</CardTitle>
          <CardDescription>Loading checklist...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const completedCount = checklist.filter(item => item.completed).length;
  const allCompleted = completedCount === checklist.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Launch Checklist
        </CardTitle>
        <CardDescription>
          Complete these steps to start making AI calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-start gap-4">
              <div className="mt-0.5 text-green-500">
                {item.completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button
                variant={item.completed ? "outline" : "default"}
                size="sm"
                onClick={() => handleNavigate(item.route)}
              >
                {item.completed ? "Edit" : "Complete"}
              </Button>
            </div>
          ))}

          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Progress: {completedCount}/{checklist.length} complete</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${(completedCount / checklist.length) * 100}%` }} 
                  />
                </div>
              </div>
              <Button
                disabled={!allCompleted}
                onClick={() => navigate('/campaigns')}
              >
                {allCompleted ? "Create Campaign" : "Complete Setup"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PreLaunchChecklist;
