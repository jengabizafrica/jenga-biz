import React from 'react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGateProps {
  children: React.ReactNode;
  requiredTier: 'free' | 'essential' | 'pro';
  feature: string;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export function SubscriptionGate({ 
  children, 
  requiredTier, 
  feature, 
  fallback,
  showUpgradePrompt = true 
}: SubscriptionGateProps) {
  const { 
    status: subscriptionStatus, 
    isLoading, 
    canAccessFeature, 
    plan: subscriptionPlan 
  } = useSubscriptionStatus();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Check if user has access to the required tier
  // TEMPORARY: All features are accessible, but we keep the logic for future use
  // TEMPORARY: All features are accessible, but we keep the logic for future use
  const hasAccess = canAccessFeature(requiredTier);
  
  // Log access in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SubscriptionGate] Checking access to '${requiredTier}' tier`, {
      hasAccess,
      currentPlan: subscriptionPlan?.name || 'none',
      subscriptionStatus
    });
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade prompt if enabled
  if (showUpgradePrompt) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg text-orange-800">
              {feature} - Premium Feature
            </CardTitle>
          </div>
          <CardDescription className="text-orange-700">
            This feature is available with a {requiredTier} subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-orange-300 text-orange-700">
                Current: {subscriptionPlan?.name || 'Free'}
              </Badge>
              <ArrowRight className="h-4 w-4 text-orange-600" />
              <Badge className="bg-orange-600 text-white">
                {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
              </Badge>
            </div>
            <Button 
              onClick={() => navigate('/pricing')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Return nothing if no fallback and upgrade prompt is disabled
  return null;
}

// Convenience components for common use cases
export function EssentialFeature({ children, feature, fallback }: Omit<SubscriptionGateProps, 'requiredTier'>) {
  return (
    <SubscriptionGate requiredTier="essential" feature={feature} fallback={fallback}>
      {children}
    </SubscriptionGate>
  );
}

export function ProFeature({ children, feature, fallback }: Omit<SubscriptionGateProps, 'requiredTier'>) {
  return (
    <SubscriptionGate requiredTier="pro" feature={feature} fallback={fallback}>
      {children}
    </SubscriptionGate>
  );
}
