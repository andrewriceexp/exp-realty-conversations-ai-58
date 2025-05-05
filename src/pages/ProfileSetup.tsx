
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MainLayout from '@/components/MainLayout';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  exp_realty_id: z.string().optional(),
  twilio_account_sid: z.string()
    .min(34, 'Twilio Account SID must be 34 characters')
    .max(34, 'Twilio Account SID must be 34 characters'),
  twilio_auth_token: z.string()
    .min(32, 'Twilio Auth Token must be 32 characters')
    .optional(),
  twilio_phone_number: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +12125551234)'),
  a2p_10dlc_registered: z.boolean().default(false),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfileSetup = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      exp_realty_id: profile?.exp_realty_id || '',
      twilio_account_sid: profile?.twilio_account_sid || '',
      twilio_auth_token: '',
      twilio_phone_number: profile?.twilio_phone_number || '',
      a2p_10dlc_registered: profile?.a2p_10dlc_registered || false,
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      setIsLoading(true);
      
      // Only update the auth token if one was provided
      const updateData: any = {...values};
      if (!values.twilio_auth_token) {
        delete updateData.twilio_auth_token;
      }
      
      await updateProfile(updateData);
      navigate('/');
    } catch (error) {
      console.error('Profile update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Profile Setup</h1>
        
        <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800">
          <AlertDescription>
            Complete your profile to get started with Voice AI Prospecting. You'll need your Twilio credentials to make outbound calls.
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="exp_realty_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>eXp Realty ID (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Your eXp ID" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Twilio Configuration</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    You'll need a Twilio account to make outbound calls. 
                    <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-exp-blue hover:underline ml-1">
                      Sign up for Twilio
                    </a>
                  </p>
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="twilio_account_sid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twilio Account SID</FormLabel>
                          <FormControl>
                            <Input placeholder="AC..." {...field} disabled={isLoading} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Find this in your Twilio Dashboard
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="twilio_auth_token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {profile?.twilio_auth_token ? 'Update Twilio Auth Token (Optional)' : 'Twilio Auth Token'}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder={profile?.twilio_auth_token ? '••••••••' : 'Enter your Auth Token'} 
                              {...field} 
                              disabled={isLoading} 
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            {profile?.twilio_auth_token 
                              ? 'Leave blank to keep current token' 
                              : 'Find this in your Twilio Dashboard'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="twilio_phone_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twilio Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+12125551234" {...field} disabled={isLoading} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Must be in E.164 format (e.g., +12125551234) and registered with Twilio
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="a2p_10dlc_registered"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              My phone number is registered for A2P 10DLC
                            </FormLabel>
                            <FormDescription>
                              For U.S. numbers, A2P 10DLC registration is required for automated calling.
                              <a 
                                href="https://www.twilio.com/docs/messaging/a2p-10dlc" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-exp-blue hover:underline ml-1"
                              >
                                Learn more
                              </a>
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full exp-gradient" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Profile'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ProfileSetup;
