
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ProfileCredentialTester } from '@/components/ProfileCredentialTester';
import { UseFormReturn } from 'react-hook-form';
import { ProfileFormValues } from './ProfileForm';
import { UserProfile } from "@/contexts/AuthContext";

interface TwilioConfigurationProps {
  form?: UseFormReturn<ProfileFormValues>;
  isLoading?: boolean;
  hasAuthToken?: boolean;
  profile?: UserProfile;
  onSave?: (data: any) => Promise<void>;
  saving?: boolean;
}

export default function TwilioConfiguration({ 
  form, 
  isLoading, 
  hasAuthToken,
  profile,
  onSave,
  saving
}: TwilioConfigurationProps) {
  // If being used in the standalone context (with onSave)
  if (profile && onSave) {
    return (
      <div>
        <h3 className="text-lg font-medium mb-2">Twilio Configuration</h3>
        <p className="text-sm text-gray-600 mb-4">
          Configure your Twilio account settings to make outbound calls.
        </p>
        
        {/* Form content would go here for the standalone version */}
        <p className="text-sm text-gray-600">
          Please use the Profile tab to configure your Twilio settings.
        </p>
      </div>
    );
  }

  // If being used within ProfileForm (with form)
  if (!form) return null;
  
  return (
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
                {hasAuthToken ? 'Update Twilio Auth Token (Optional)' : 'Twilio Auth Token'}
              </FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  placeholder={hasAuthToken ? '••••••••' : 'Enter your Auth Token'} 
                  {...field} 
                  disabled={isLoading} 
                />
              </FormControl>
              <FormDescription className="text-xs">
                {hasAuthToken 
                  ? 'Leave blank to keep current token' 
                  : 'Find this in your Twilio Dashboard'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      {/* Add credential tester if accountSid is available */}
      {form.watch('twilio_account_sid') && (
        <ProfileCredentialTester 
          accountSid={form.watch('twilio_account_sid')} 
          authToken={form.watch('twilio_auth_token') || ''} 
        />
      )}
      
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
  );
}
