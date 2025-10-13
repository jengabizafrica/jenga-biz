import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoles, UserRole } from '@/hooks/useRoles';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[]; // if omitted, any authenticated user
  requireSubscription?: boolean; // if true, requires active subscription
  allowedSubscriptionTiers?: string[]; // specific subscription tiers allowed
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles, 
  requireSubscription = false,
  allowedSubscriptionTiers 
}) => {
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();
  const { hasActiveSubscription, plan, isLoading: subscriptionLoading } = useSubscriptionStatus();

  if (loading || rolesLoading || (requireSubscription && subscriptionLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  // Check role-based access
  if (allowedRoles) {
    const isAllowed = roles.includes('super_admin') || roles.some(r => allowedRoles.includes(r));
    if (!isAllowed) return <Navigate to="/" replace />;
  }

  // Check subscription-based access
  if (requireSubscription) {
    if (!hasActiveSubscription) {
      return <Navigate to="/pricing" replace />;
    }

    if (allowedSubscriptionTiers && plan) {
      const userTier = plan.name?.toLowerCase();
      const isTierAllowed = allowedSubscriptionTiers.some(tier => 
        tier.toLowerCase() === userTier
      );
      if (!isTierAllowed) {
        return <Navigate to="/pricing" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
