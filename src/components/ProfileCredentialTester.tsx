
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

interface ProfileCredentialTesterProps {
  accountSid: string;
  authToken: string;
}

export function ProfileCredentialTester({ accountSid, authToken }: ProfileCredentialTesterProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const verifyCredentials = async () => {
    if (!accountSid || !authToken) {
      setVerificationResult({
        success: false,
        message: "Please enter both Account SID and Auth Token to verify"
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-twilio-creds', {
        body: {
          account_sid: accountSid,
          auth_token: authToken
        },
      });

      if (error) {
        console.error('Error verifying credentials:', error);
        setVerificationResult({
          success: false,
          message: `Verification failed: ${error.message}`
        });
        return;
      }

      if (data.success) {
        setVerificationResult({
          success: true,
          message: `Credentials verified successfully! Account: ${data.account_info?.friendly_name || 'Unknown'}`
        });
      } else {
        setVerificationResult({
          success: false,
          message: data.error || "Verification failed due to an unknown error"
        });
      }
    } catch (err) {
      console.error('Error in verification process:', err);
      setVerificationResult({
        success: false,
        message: err instanceof Error ? err.message : "An unknown error occurred"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <Button 
          onClick={verifyCredentials} 
          disabled={isVerifying || !accountSid || !authToken}
          variant="outline"
          type="button"
          size="sm"
        >
          {isVerifying ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Verifying...
            </>
          ) : (
            'Verify Credentials'
          )}
        </Button>
        <p className="text-xs text-gray-500">
          Test your Twilio credentials before saving
        </p>
      </div>

      {verificationResult && (
        <Alert className={`mt-2 ${verificationResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <AlertDescription>
            {verificationResult.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
