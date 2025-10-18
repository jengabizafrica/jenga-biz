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
    // Check demo mode first - Free tier features with no expiration
    const demoMode = sessionStorage.getItem('demo_mode') === 'true';
    if (demoMode) {
      console.log('[Subscription] Demo mode active - Free tier features without expiration');
      // In demo mode, only Free tier features are accessible (limits still enforced)
      return requiredTier === 'free';
    }

    const planName = subscription.plan?.name?.toLowerCase() || '';
    
    // Free tier: base access
    if (requiredTier === 'free') return true;
    
    // Normal mode: Check trial period for Free tier
    if (planName === 'free' && subscription.currentPeriodEnd) {
      const trialEnd = new Date(subscription.currentPeriodEnd);
      const isInTrial = trialEnd > new Date();
      if (isInTrial) {
        console.log('[Subscription] Free tier in 14-day trial - full access');
        return true; // Full access during trial
      } else {
        console.log('[Subscription] Free tier trial expired - limited to Free features only');
        // After trial expires, deny all access (user must upgrade or will see blocker)
        return false;
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
