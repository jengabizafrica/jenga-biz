import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, ExternalLink } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  available_cycles?: string[];
}

interface RecentSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  paystack_subscription_id?: string | null;
  plan?: { name: string };
  profiles?: { email: string };
}

export function PaystackTesting() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [testEmail, setTestEmail] = useState<string>('');
  const [callbackUrl, setCallbackUrl] = useState<string>(`${window.location.origin}/billing-success`);
  const [isInitiating, setIsInitiating] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [recentSubscriptions, setRecentSubscriptions] = useState<RecentSubscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  useEffect(() => {
    loadPlans();
    loadRecentSubscriptions();
  }, []);

  const loadPlans = async () => {
    try {
      const list = await apiClient.listPlans();
      setPlans(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription plans',
        variant: 'destructive',
      });
    }
  };

  const loadRecentSubscriptions = async () => {
    try {
      setLoadingSubscriptions(true);
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          plan:subscription_plans(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch user emails separately
      const enrichedData = await Promise.all(
        (data || []).map(async (sub) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', sub.user_id)
            .single();
          return {
            ...sub,
            profiles: profile,
          };
        })
      );

      setRecentSubscriptions(enrichedData as any);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recent subscriptions',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const initiateTestPayment = async () => {
    if (!selectedPlanId || !testEmail) {
      toast({
        title: 'Validation Error',
        description: 'Please select a plan and enter a test email',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsInitiating(true);
      const response = await apiClient.initiatePaystack(selectedPlanId, callbackUrl);
      
      if (response?.authorization_url) {
        setPaymentUrl(response.authorization_url);
        setReference(response.reference || '');
        toast({
          title: 'Payment URL Generated',
          description: 'Test payment URL has been created successfully',
        });
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      toast({
        title: 'Payment Error',
        description: error?.error?.message || 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setIsInitiating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Payment URL copied to clipboard',
    });
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const availableCycles = selectedPlan?.available_cycles || ['monthly'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paystack Integration Testing</CardTitle>
        <CardDescription>
          Test subscription payment flows and Paystack integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Test Payment Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Initiate Test Payment</h3>
            
            {/* Plan Selector */}
            <div>
              <Label>Select Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.currency} {plan.price}/{plan.billing_cycle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Billing Cycle Selector */}
            <div>
              <Label>Billing Cycle</Label>
              <Select value={billingCycle} onValueChange={setBillingCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCycles.map(cycle => (
                    <SelectItem key={cycle} value={cycle}>
                      <span className="capitalize">{cycle}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Email Input */}
            <div>
              <Label>Test User Email</Label>
              <Input 
                type="email"
                value={testEmail} 
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>

            {/* Callback URL */}
            <div>
              <Label>Callback URL</Label>
              <Input 
                value={callbackUrl} 
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder={`${window.location.origin}/billing-success`}
              />
            </div>

            {/* Initiate Button */}
            <Button 
              onClick={initiateTestPayment}
              disabled={!selectedPlanId || !testEmail || isInitiating}
              className="w-full"
            >
              {isInitiating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initiating...
                </>
              ) : (
                'Initiate Test Payment'
              )}
            </Button>

            {/* Payment URL Display */}
            {paymentUrl && (
              <Alert>
                <AlertTitle>Payment URL Generated</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="break-all text-xs font-mono bg-muted p-2 rounded">{paymentUrl}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => window.open(paymentUrl, '_blank')}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(paymentUrl)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy URL
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Reference Display */}
            {reference && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                <strong>Transaction Reference:</strong> <span className="font-mono">{reference}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Recent Subscriptions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Subscriptions</h3>
              <Button size="sm" variant="outline" onClick={loadRecentSubscriptions} disabled={loadingSubscriptions}>
                {loadingSubscriptions ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period Start</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No subscriptions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentSubscriptions.map(sub => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {(sub.profiles as any)?.email || 'N/A'}
                        </TableCell>
                        <TableCell>{(sub.plan as any)?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{sub.current_period_start ? new Date(sub.current_period_start).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="text-xs font-mono">{sub.paystack_subscription_id || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <Separator />

          {/* Webhook Info Section */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Webhook Configuration</h3>
            <div className="bg-muted p-4 rounded-md space-y-2">
              <p className="text-sm font-medium">Webhook URL:</p>
              <code className="text-xs break-all block bg-background p-2 rounded border">
                {`https://diclwatocrixibjpajuf.supabase.co/functions/v1/subscriptions/paystack/webhook`}
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Configure this URL in your Paystack Dashboard → Settings → Webhooks
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
