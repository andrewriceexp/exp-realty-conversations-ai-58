
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { XCircle, Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cleanupAuthState } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password should be at least 6 characters"),
});

const Login = () => {
  const { signIn, loading, error, user, session, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const buttonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get return URL from location state
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Clean up auth state on component mount - but non-aggressively
  useEffect(() => {
    // Non-aggressive cleanup that preserves valid sessions
    cleanupAuthState(false);
    console.log("Login component mounted, auth state cleaned");
    
    // Reset any stuck redirect or loading states when the component mounts
    setIsRedirecting(false);
    
    return () => {
      // Clear any timeouts on unmount
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current);
      }
    };
  }, []);

  // Emergency timeout to prevent stuck disabled buttons
  useEffect(() => {
    if (loading || isRedirecting) {
      // Set a timeout to reset loading state if it gets stuck
      buttonTimeoutRef.current = setTimeout(() => {
        console.warn("Login timeout reached - forcing button to re-enable");
        setIsRedirecting(false);
      }, 8000); // 8 second timeout
      
      return () => {
        if (buttonTimeoutRef.current) {
          clearTimeout(buttonTimeoutRef.current);
        }
      };
    }
  }, [loading, isRedirecting]);

  // Redirect if already logged in, but prevent infinite loops
  useEffect(() => {
    if (user && session && !isLoading && !isRedirecting) {
      console.log("User already logged in, redirecting to:", from);
      setIsRedirecting(true);
      
      // Use a slight delay to prevent rapid state changes
      const redirectTimeout = setTimeout(() => {
        navigate(from, { replace: true });
      }, 100);
      
      return () => clearTimeout(redirectTimeout);
    }
  }, [user, session, isLoading, navigate, from, isRedirecting]);

  // Log auth state changes for debugging
  useEffect(() => {
    console.log("Auth state in Login:", { 
      hasUser: !!user, 
      hasSession: !!session,
      isLoading, 
      loading, 
      isRedirecting,
      loginAttempted
    });
  }, [user, session, isLoading, loading, isRedirecting, loginAttempted]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      // Clear any previous errors
      setErrorMessage(null);
      setLoginAttempted(true);
      
      // Call the signIn function with email and password
      console.log("Attempting sign in for:", data.email);
      const result = await signIn(data.email, data.password);
      
      if (result?.error) {
        setErrorMessage(result.error.message || "Login failed. Please try again.");
        return;
      }
      
      if (!result?.user) {
        setErrorMessage("Login failed. No user data received.");
        return;
      }
      
      // Add toast for successful login
      toast({
        title: "Login successful!",
        description: "Redirecting you to the dashboard...",
        duration: 3000,
      });
      
      // Redirect will happen automatically via the useEffect above
    } catch (error: any) {
      console.error("Login error:", error);
      setErrorMessage(error.message || "Login failed. Please try again.");
      setIsRedirecting(false);
    }
  };

  // Determine if button should be disabled (more specific conditions)
  const isButtonDisabled = loading && loginAttempted;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials below to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(error || errorMessage) && (
            <Alert variant="destructive" className="mb-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {error || errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your@email.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••••" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isButtonDisabled}
                >
                  {loading && loginAttempted ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  Sign In
                </Button>
              </div>
              
              {isRedirecting && (
                <div className="text-sm text-muted-foreground flex items-center justify-center mt-2">
                  <Info className="h-3 w-3 mr-1" />
                  <span>Redirecting...</span>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>
          <div className="text-sm text-center">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
