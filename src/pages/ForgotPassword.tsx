
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ResetFormValues = z.infer<typeof resetSchema>;

const ForgotPassword = () => {
  const { resetPassword, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  // Set up cleanup on component unmount
  useEffect(() => {
    console.log("[ForgotPassword] Component mounted");
    return () => {
      mounted.current = false;
      console.log("[ForgotPassword] Component unmounting");
    };
  }, []);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ResetFormValues) => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("[ForgotPassword] Requesting password reset for:", values.email);
      
      await resetPassword(values.email);
      
      if (!mounted.current) return;
      
      setResetSent(true);
      
      // Show success toast
      toast({
        title: "Reset link sent",
        description: "If an account exists, you'll receive reset instructions via email."
      });
      
    } catch (error: any) {
      if (!mounted.current) return;
      
      console.error('[ForgotPassword] Password reset error:', error);
      setError(error.message || "Failed to send reset email. Please try again.");
      
      // Show error toast
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: error.message || "Failed to send reset email. Please try again."
      });
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
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
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your email to receive a password reset link</CardDescription>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <Alert className="bg-green-50 border-green-200 text-green-800">
                <AlertDescription>
                  If an account exists with that email, we've sent you instructions to reset your password. Please check your inbox.
                </AlertDescription>
              </Alert>
            ) : (
              <Form {...form}>
                {error && (
                  <Alert className="mb-4 bg-red-50 border-red-200 text-red-800">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@example.com" {...field} disabled={isLoading || loading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full exp-gradient" disabled={isLoading || loading}>
                    {isLoading || loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <div className="text-sm">
              Remember your password?{' '}
              <Link to="/login" className="text-exp-blue hover:underline">
                Back to login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
