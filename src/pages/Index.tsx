
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-16 text-center md:pt-32 md:pb-24">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          eXp Voice AI <span className="text-blue-400">Prospecting</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
          Automate your real estate prospecting with AI-powered voice calls. 
          Reach more potential clients with less effort and higher conversion rates.
        </p>
        <Button 
          onClick={handleGetStarted} 
          size="lg" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
        >
          {user ? 'Go to Dashboard' : 'Get Started'}
        </Button>
      </div>

      {/* Features */}
      <div className="bg-slate-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              title="AI Voice Automation" 
              description="Use advanced AI to make natural sounding calls that engage prospects effectively."
              icon="🤖"
            />
            <FeatureCard 
              title="Campaign Management" 
              description="Create, schedule and track multiple campaigns for different prospect lists."
              icon="📊"
            />
            <FeatureCard 
              title="Detailed Analytics" 
              description="Get insights into call performance, prospect engagement, and conversion rates."
              icon="📈"
            />
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-6">Ready to transform your prospecting?</h2>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
          Join eXp realty agents who are already saving time and closing more deals with Voice AI.
        </p>
        <Button 
          onClick={handleGetStarted}
          size="lg" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
        >
          {user ? 'Go to Dashboard' : 'Sign Up Now'}
        </Button>
      </div>
    </div>
  );
};

// Feature card component for the landing page
const FeatureCard = ({ title, description, icon }: { title: string; description: string; icon: string }) => {
  return (
    <div className="bg-slate-700 p-6 rounded-lg text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-300">{description}</p>
    </div>
  );
};

export default Index;
