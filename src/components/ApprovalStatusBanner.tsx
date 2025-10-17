import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, X } from 'lucide-react';
import { useApprovalStatus } from '@/hooks/useApprovalStatus';
import { Button } from '@/components/ui/button';

interface ApprovalStatusBannerProps {
  className?: string;
}

/**
 * Banner component that shows approval status for organization users.
 * Shows different states: pending approval, approved (once), rejected, etc.
 */
export function ApprovalStatusBanner({ className = '' }: ApprovalStatusBannerProps) {
  const { hasPendingApproval, isOrganization, loading } = useApprovalStatus();
  const [showApprovalMessage, setShowApprovalMessage] = useState(false);

  useEffect(() => {
    // Only check for approved message if organization and not pending
    if (isOrganization && !hasPendingApproval && !loading) {
      const hasSeenApproval = localStorage.getItem('approval_message_seen');
      if (!hasSeenApproval) {
        setShowApprovalMessage(true);
      }
    }
  }, [isOrganization, hasPendingApproval, loading]);

  const handleDismissApproval = () => {
    localStorage.setItem('approval_message_seen', 'true');
    setShowApprovalMessage(false);
  };

  // Don't show anything if not an organization or still loading
  if (loading || !isOrganization) {
    return null;
  }

  // If organization user has pending approval
  if (hasPendingApproval) {
    return (
      <Alert className={`border-orange-200 bg-orange-50 ${className}`}>
        <Clock className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>Approval Pending:</strong> Your ecosystem enabler account is under review. 
          You'll have full access once a super admin approves your request. 
          You can still update your profile and browse available features.
        </AlertDescription>
      </Alert>
    );
  }

  // If organization user is approved (show once)
  if (showApprovalMessage) {
    return (
      <Alert className={`border-green-200 bg-green-50 relative ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 pr-8">
          <strong>Account Approved:</strong> Your ecosystem enabler account is active. 
          Welcome to Jenga Biz Africa!
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={handleDismissApproval}
        >
          <X className="h-4 w-4" />
        </Button>
      </Alert>
    );
  }

  return null;
}