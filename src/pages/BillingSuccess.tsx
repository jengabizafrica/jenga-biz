import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const status = searchParams.get('status');
        
        // If Paystack redirected with explicit failure, go to error page
        if (status !== 'success') {
          navigate('/billing/error?reason=payment_failed');
          return;
        }

        // Give webhook a moment to process
        await new Promise(r => setTimeout(r, 1500));
        
        // Verify subscription is active
        const subscription = await apiClient.getMySubscription();
        
        if (subscription && subscription.status === 'active') {
          setMessage('Payment confirmed! Your subscription is now active.');
          setVerifying(false);
          
          // Auto-redirect to dashboard after 2 seconds
          setTimeout(() => navigate('/dashboard'), 2000);
        } else {
          // Fallback: poll once more
          await new Promise(r => setTimeout(r, 2000));
          const sub2 = await apiClient.getMySubscription();
          
          if (sub2 && sub2.status === 'active') {
            setMessage('Payment confirmed! Your subscription is now active.');
            setVerifying(false);
            setTimeout(() => navigate('/dashboard'), 2000);
          } else {
            // Webhook might be delayed
            navigate('/billing/error?reason=verification_pending');
          }
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
        navigate('/billing/error?reason=verification_error');
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          {verifying ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          )}
          <CardTitle>Payment Successful</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
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
