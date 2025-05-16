
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle } from "lucide-react";
import MainLayout from "@/components/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { TwilioConfiguration } from "@/components/profile/TwilioConfiguration";
import { ElevenLabsInfo } from "@/components/profile/ElevenLabsInfo";
import { Spinner } from "@/components/ui/spinner";

const ProfileSetup = () => {
  const { user, profile, isLoading, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // If profile data changes, refresh any success/error messages
  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
  }, [profile]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Spinner className="h-8 w-8 text-primary" />
          <span className="ml-2">Loading profile data...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Profile & Settings</h1>
          <p className="text-muted-foreground">
            Configure your account settings and integrations
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="twilio">Twilio Setup</TabsTrigger>
            <TabsTrigger value="elevenlabs">ElevenLabs Setup</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <ProfileForm 
              profile={profile} 
              onSave={async (data) => {
                try {
                  setSaving(true);
                  setError(null);
                  await updateProfile(data);
                  setSuccessMessage("Profile updated successfully");
                } catch (error: any) {
                  setError(error.message || "Failed to update profile");
                } finally {
                  setSaving(false);
                }
              }}
              saving={saving}
            />
          </TabsContent>
          
          <TabsContent value="twilio">
            <TwilioConfiguration 
              profile={profile}
              onSave={async (data) => {
                try {
                  setSaving(true);
                  setError(null);
                  await updateProfile(data);
                  setSuccessMessage("Twilio configuration updated successfully");
                } catch (error: any) {
                  setError(error.message || "Failed to update Twilio configuration");
                } finally {
                  setSaving(false);
                }
              }}
              saving={saving}
            />
          </TabsContent>
          
          <TabsContent value="elevenlabs">
            <ElevenLabsInfo 
              profile={profile}
              onSave={async (data) => {
                try {
                  setSaving(true);
                  setError(null);
                  await updateProfile(data);
                  setSuccessMessage("ElevenLabs configuration updated successfully");
                } catch (error: any) {
                  setError(error.message || "Failed to update ElevenLabs configuration");
                } finally {
                  setSaving(false);
                }
              }}
              saving={saving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default ProfileSetup;
