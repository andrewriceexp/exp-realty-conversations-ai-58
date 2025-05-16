
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/hooks/use-toast';
import { ProfileCredentialTester } from '@/components/ProfileCredentialTester';
import TwilioConfiguration from './TwilioConfiguration';
import ElevenLabsInfo from './ElevenLabsInfo';

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

export type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: any;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
}

export default function ProfileForm({ profile, onSave, saving }: ProfileFormProps) {
  const [hasAuthToken, setHasAuthToken] = useState(!!profile?.twilio_auth_token);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      exp_realty_id: profile?.exp_realty_id || '',
      twilio_account_sid: profile?.twilio_account_sid || '',
      twilio_auth_token: '',  // Always start with an empty auth token field
      twilio_phone_number: profile?.twilio_phone_number || '',
      a2p_10dlc_registered: profile?.a2p_10dlc_registered || false,
    },
  });

  // Reset form with profile values when profile loads or changes
  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name || '',
        exp_realty_id: profile.exp_realty_id || '',
        twilio_account_sid: profile.twilio_account_sid || '',
        twilio_auth_token: '', // Keep this empty
        twilio_phone_number: profile.twilio_phone_number || '',
        a2p_10dlc_registered: profile.a2p_10dlc_registered || false,
      });
      setHasAuthToken(!!profile.twilio_auth_token);
    }
  }, [profile, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      setUpdateSuccess(false);
      setErrorMessage(null);
      
      // Create update object
      const updateData: any = { ...values };
      
      // Only update the auth token if one was provided (not empty)
      if (!updateData.twilio_auth_token) {
        delete updateData.twilio_auth_token;
        console.log('Auth token field was empty, not updating token');
      } else {
        console.log(`Auth token provided (${updateData.twilio_auth_token.length} characters), updating token`);
      }
      
      console.log('Submitting profile update with data:', { 
        ...updateData, 
        twilio_auth_token: updateData.twilio_auth_token ? '****' : undefined,
      });
      
      await onSave(updateData);
      
      // Reset the auth token field
      form.setValue('twilio_auth_token', '');
      
      // Update state to reflect that we now have an auth token stored
      // if one was provided in this update
      if (values.twilio_auth_token) {
        setHasAuthToken(true);
      }
      
      // Set success state
      setUpdateSuccess(true);
      toast({
        title: "Profile Updated",
        description: "Your profile and credentials have been saved successfully."
      });
    } catch (error: any) {
      console.error('Profile update error:', error);
      setErrorMessage(error.message || 'Failed to update profile');
      setUpdateSuccess(false);
      toast({
        title: "Update Failed",
        description: error.message || 'Failed to update profile',
        variant: "destructive"
      });
    }
  };

  return (
    <>
      {updateSuccess && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <AlertDescription>
            Profile successfully updated! Your credentials have been saved.
          </AlertDescription>
        </Alert>
      )}
      
      {errorMessage && (
        <Alert className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertDescription>
            Error: {errorMessage}
          </AlertDescription>
        </Alert>
      )}
      
      <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800">
        <AlertDescription>
          Complete your profile to get started with Voice AI Prospecting. You'll need your Twilio credentials to make outbound calls.
        </AlertDescription>
      </Alert>

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
                    <Input placeholder="John Smith" {...field} disabled={saving} />
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
                    <Input placeholder="Your eXp ID" {...field} disabled={saving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <TwilioConfiguration 
            form={form} 
            isLoading={saving} 
            hasAuthToken={hasAuthToken}
          />
          
          <div className="flex gap-4">
            <Button 
              type="submit" 
              className="flex-1 exp-gradient" 
              disabled={saving}
            >
              {saving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : 'Save Profile'}
            </Button>
            
            <Button 
              type="button" 
              variant="outline"
              onClick={() => window.location.href = '/dashboard'} 
              disabled={saving}
              className="flex-1"
            >
              Go to Dashboard
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
