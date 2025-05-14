
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MainLayout from '@/components/MainLayout';
import ProfileForm from '@/components/profile/ProfileForm';

const ProfileSetup = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (profile) {
      console.log("Profile loaded, has auth token:", !!profile.twilio_auth_token);
      console.log("Profile has ElevenLabs API key:", !!profile.elevenlabs_api_key);
    }
  }, [profile]);

  const handleNavigateToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Profile Setup</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm 
              profile={profile} 
              updateProfile={updateProfile}
              onNavigate={handleNavigateToDashboard}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ProfileSetup;
