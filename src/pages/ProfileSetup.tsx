
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Check, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MainLayout from '@/components/MainLayout';
import ProfileForm from '@/components/profile/ProfileForm';
import { useElevenLabsAuth } from '@/hooks/useElevenLabsAuth';
import { toast } from '@/hooks/use-toast';

const ProfileSetup = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { 
    isReady: isElevenLabsReady, 
    hasApiKey, 
    validateApiKey, 
    isLoading,
    apiKeyStatus,
    lastValidated
  } = useElevenLabsAuth();
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  
  // Use a callback to avoid unnecessary effect reruns
  const validateApiKeyIfNeeded = useCallback(async () => {
    if (!hasApiKey) return;
    
    // Only validate if we haven't validated in this session
    if (hasApiKey && apiKeyStatus !== 'valid' && !isLoading) {
      const isValid = await validateApiKey();
      if (isValid) {
        setShowSuccessBanner(true);
      }
    } else if (apiKeyStatus === 'valid') {
      setShowSuccessBanner(true);
    }
  }, [hasApiKey, apiKeyStatus, isLoading, validateApiKey]);
  
  useEffect(() => {
    if (profile) {
      console.log("Profile loaded, has auth token:", !!profile.twilio_auth_token);
      console.log("Profile has ElevenLabs API key:", !!profile.elevenlabs_api_key);
      
      validateApiKeyIfNeeded();
    }
  }, [profile, validateApiKeyIfNeeded]);

  const handleNavigateToDashboard = () => {
    navigate('/dashboard');
  };

  const handleNavigateToConversation = () => {
    navigate('/conversation-testing');
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Profile Setup</h1>
        
        {isElevenLabsReady && showSuccessBanner && (
          <Alert variant="default" className="border-green-500 mb-6">
            <Check className="h-5 w-5 text-green-500" />
            <AlertDescription className="flex justify-between items-center">
              <div>
                <p className="font-medium">ElevenLabs is configured successfully!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your ElevenLabs API key has been validated and saved. You can now test voice conversations.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => window.open('https://elevenlabs.io/docs/conversational-ai', '_blank')}
                  size="sm" 
                  className="flex items-center"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Documentation
                </Button>
                <Button 
                  onClick={handleNavigateToConversation} 
                  className="flex items-center"
                >
                  Test Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {hasApiKey && isLoading && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validating API Key</AlertTitle>
            <AlertDescription>
              We're verifying your ElevenLabs API key to ensure it's working properly.
            </AlertDescription>
          </Alert>
        )}
        
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
