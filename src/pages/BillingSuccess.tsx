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
        const reference = searchParams.get('reference');
        
        // Edge function already verified - just confirm with reference
        if (!reference) {
          navigate('/billing/error?reason=no_reference');
          return;
        }

        setMessage('Confirming your subscription...');
        
        // Brief delay for webhook processing
        await new Promise(r => setTimeout(r, 2000));
        
        const subscription = await apiClient.getMySubscription();
        
        if (subscription && subscription.status === 'active') {
          setMessage('Payment successful! Your subscription is now active.');
          setVerifying(false);
          setTimeout(() => navigate('/dashboard'), 1500);
        } else {
          // One retry
          await new Promise(r => setTimeout(r, 1500));
          const sub = await apiClient.getMySubscription();
          if (sub && sub.status === 'active') {
            setMessage('Payment successful! Your subscription is now active.');
            setVerifying(false);
            setTimeout(() => navigate('/dashboard'), 1500);
          } else {
            navigate('/billing/error?reason=pending_activation');
          }
        }
      } catch (error) {
        console.error('Verification error:', error);
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
