import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, AlertCircle } from 'lucide-react';

/**
 * Fallback page for email confirmation errors
 * Successful confirmations are handled server-side by confirm-email edge function
 */
export default function EmailConfirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'missing_token':
        return 'Invalid confirmation link. The confirmation token is missing.';
      case 'expired':
        return 'This confirmation link has expired. Please request a new one.';
      default:
        return errorCode || 'Email confirmation failed. Please try again or contact support.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Confirmation Failed
          </CardTitle>
          <CardDescription className="flex items-start gap-2 mt-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{getErrorMessage(error)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => navigate('/auth')} className="w-full">
            Return to Login
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
