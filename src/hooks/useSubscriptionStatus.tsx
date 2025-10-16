import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

export interface SubscriptionStatus {
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    features: Record<string, any>;
  } | null;
  status: 'active' | 'inactive' | 'expired' | 'loading';
  currentPeriodEnd: string | null;
  isLoading: boolean;
}

export function useSubscriptionStatus() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    plan: null,
    status: 'loading',
    currentPeriodEnd: null,
    isLoading: true,
  });

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setSubscription({
          plan: null,
          status: 'inactive',
          currentPeriodEnd: null,
          isLoading: false,
        });
        return;
      }

      setSubscription(prev => ({ ...prev, isLoading: true }));
      
      try {
        const sub = await apiClient.getMySubscription();
        if (sub && sub.status === 'active') {
          setSubscription({
            plan: sub.plan,
            status: 'active',
            currentPeriodEnd: sub.current_period_end,
            isLoading: false,
          });
        } else {
          setSubscription({
            plan: null,
            status: 'inactive',
            currentPeriodEnd: null,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Failed to load subscription status:', error);
        setSubscription({
          plan: null,
          status: 'inactive',
          currentPeriodEnd: null,
          isLoading: false,
        });
      }
    };

    load();
  }, [user?.id]);

  // Helper functions for feature gating
  const hasActiveSubscription = subscription.status === 'active';
  const isPremium = subscription.plan?.name?.toLowerCase() === 'premium';
  const isPro = subscription.plan?.name?.toLowerCase() === 'pro';
  const isFree = !hasActiveSubscription || subscription.plan?.name?.toLowerCase() === 'free';

  const canAccessFeature = useCallback((requiredTier: 'free' | 'essential' | 'pro') => {
    // Check maintenance mode first - bypasses all gating
    const maintenanceMode = sessionStorage.getItem('maintenance_mode') === 'true';
    if (maintenanceMode) {
      console.log('[Subscription] Maintenance mode active - bypassing subscription check');
      return true;
    }

    const planName = subscription.plan?.name?.toLowerCase() || '';
    
    // Free tier: base access
    if (requiredTier === 'free') return true;
    
    // Check trial period for Free tier
    if (planName === 'free' && subscription.currentPeriodEnd) {
      const trialEnd = new Date(subscription.currentPeriodEnd);
      const isInTrial = trialEnd > new Date();
      if (isInTrial) {
        console.log('[Subscription] Free tier in trial period - full access');
        return true;
      }
    }
    
    // Essential tier requirements
    if (requiredTier === 'essential') {
      return planName === 'essential' || planName === 'pro' || hasActiveSubscription;
    }
    
    // Pro tier requirements
    if (requiredTier === 'pro') {
      return planName === 'pro' || hasActiveSubscription;
    }
    
    // Log access in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Subscription] Feature '${requiredTier}' access:`, {
        hasAccess: false,
        subscriptionStatus: subscription.status,
        plan: subscription.plan?.name || 'none'
      });
    }
    
    return false;
  }, [subscription, hasActiveSubscription]);

  return {
    ...subscription,
    hasActiveSubscription,
    isPremium,
    isPro,
    isFree,
    canAccessFeature,
  };
}
