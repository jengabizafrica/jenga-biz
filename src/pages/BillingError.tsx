import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, AlertCircle } from 'lucide-react';

export default function BillingError() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const reason = searchParams.get('reason') || 'unknown';
  
  const errorMessages: Record<string, { title: string; message: string }> = {
    payment_failed: {
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please try again or contact support if the issue persists.'
    },
    payment_cancelled: {
      title: 'Payment Cancelled',
      message: 'You cancelled the payment process. No charges were made.'
    },
    verification_pending: {
      title: 'Verification Pending',
      message: 'We received your payment but are still verifying it. Your subscription should activate within a few minutes. Check your email for confirmation.'
    },
    verification_error: {
      title: 'Verification Error',
      message: 'We encountered an error verifying your payment. If you were charged, please contact support with your transaction reference.'
    },
    unknown: {
      title: 'Payment Issue',
      message: 'We encountered an unexpected issue with your payment. Please contact support for assistance.'
    }
  };
  
  const { title, message } = errorMessages[reason] || errorMessages.unknown;
  const isWarning = reason === 'verification_pending';

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          {isWarning ? (
            <AlertCircle className="h-6 w-6 text-yellow-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/pricing')}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
