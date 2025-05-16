
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const resetSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetFormValues = z.infer<typeof resetSchema>;

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    console.log("[ResetPassword] Component mounted");
    
    // Check if the URL contains a hash parameter (recovery token)
    const url = new URL(window.location.href);
    const hashParam = url.hash.substring(1);
    
    // Also check for recovery token in query parameters (alternate format)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    console.log("[ResetPassword] URL params:", { hashParam, tokenParam });
    
    if (hashParam) {
      console.log("[ResetPassword] Found hash parameter");
      setHash(hashParam);
    } else if (tokenParam) {
      console.log("[ResetPassword] Found token parameter");
      setHash(tokenParam);
    } else {
      console.log("[ResetPassword] No valid reset token found");
      setError("Invalid or missing reset token");
      
      try {
        toast({
          title: 'Invalid reset link',
          description: 'The password reset link appears to be invalid or expired.',
          variant: 'destructive',
        });
      } catch (toastError) {
        console.warn("[ResetPassword] Toast error:", toastError);
      }
      
      // Delay redirect to allow user to see the error
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    }
  }, [navigate, toast]);

  const onSubmit = async (values: ResetFormValues) => {
    console.log("[ResetPassword] Submitting password reset");
    setIsLoading(true);
    setError(null);
    
    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: values.password
      });
      
      if (error) {
        console.error("[ResetPassword] Error updating password:", error);
        setError(error.message);
        
        try {
          toast({
            title: 'Password Reset Failed',
            description: error.message,
            variant: 'destructive',
          });
        } catch (toastError) {
          console.warn("[ResetPassword] Toast error:", toastError);
        }
        
        return;
      }
      
      console.log("[ResetPassword] Password updated successfully");
      
      try {
        toast({
          title: 'Password Reset Successful',
          description: 'Your password has been updated. You can now log in with your new password.',
        });
      } catch (toastError) {
        console.warn("[ResetPassword] Toast error:", toastError);
      }
      
      // Redirect to login page
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (error: any) {
      console.error("[ResetPassword] Exception updating password:", error);
      setError(error.message || "An error occurred while resetting your password.");
      
      try {
        toast({
          title: 'Password Reset Failed',
          description: error.message || "An error occurred while resetting your password.",
          variant: 'destructive',
        });
      } catch (toastError) {
        console.warn("[ResetPassword] Toast error:", toastError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md mb-8">
        <div className="text-center mb-6">
          <div className="flex justify-center">
            <img src="/placeholder.svg" alt="eXp Realty Logo" className="h-12 mb-6" />
          </div>
          <h1 className="text-2xl font-bold text-exp-blue">eXp Realty Voice AI</h1>
          <p className="text-sm text-gray-600 mt-1">Automated Prospecting Tool</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Set New Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full exp-gradient" 
                  disabled={isLoading || !hash}>
                  {isLoading ? 'Updating Password...' : 'Update Password'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <div className="text-sm">
              <Button
                variant="link"
                onClick={() => navigate('/login')}
                className="p-0 h-auto text-exp-blue hover:underline"
              >
                Back to login
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
