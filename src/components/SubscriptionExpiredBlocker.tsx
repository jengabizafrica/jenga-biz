import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Crown, LogOut } from 'lucide-react';

interface SubscriptionExpiredBlockerProps {
  children: React.ReactNode;
}

export function SubscriptionExpiredBlocker({ children }: SubscriptionExpiredBlockerProps) {
  const { plan, status, currentPeriodEnd } = useSubscriptionStatus();
  const demoMode = sessionStorage.getItem('demo_mode') === 'true';
  const navigate = useNavigate();

  // Demo mode: no blocking
  if (demoMode) {
    return <>{children}</>;
  }

  // Check if Free tier expired
  const planFeatures = plan?.features as any;
  const isFreeTier = planFeatures?.tier === 'free' || plan?.name?.toLowerCase() === 'free';
  const hasExpired = currentPeriodEnd && new Date(currentPeriodEnd) < new Date();

  if (isFreeTier && hasExpired && status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-primary/20">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Trial Expired</CardTitle>
            <CardDescription className="text-base">
              Your 14-day free trial has expired. Upgrade to continue building your business with Jenga Biz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm">What you'll get with a paid plan:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Unlimited access to all features</li>
                <li>• Advanced AI-powered insights</li>
                <li>• Priority support</li>
                <li>• Unlimited downloads & exports</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => navigate('/pricing')} 
              className="w-full"
              size="lg"
            >
              <Crown className="h-4 w-4 mr-2" />
              View Pricing Plans
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => supabase.auth.signOut()} 
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
