import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Shield } from 'lucide-react';

interface ApprovalBlockerProps {
  children: React.ReactNode;
}

/**
 * Component that blocks organization users from interacting until approved
 */
export function ApprovalBlocker({ children }: ApprovalBlockerProps) {
  const { user, signOut } = useAuth();
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [isOrganization, setIsOrganization] = useState(false);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user) {
        setCheckingApproval(false);
        return;
      }

      try {
        // Check if user is organization
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', user.id)
          .maybeSingle();

        const isOrg = profile?.account_type === 'organization';
        setIsOrganization(isOrg);

        if (!isOrg) {
          // Not an organization, allow access
          setCheckingApproval(false);
          return;
        }

        // Check if organization has pending approval
        const { data: pendingApproval } = await supabase
          .from('pending_approvals')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        setIsPending(!!pendingApproval);
        setCheckingApproval(false);
      } catch (error) {
        console.error('Error checking approval status:', error);
        setCheckingApproval(false);
      }
    };

    checkApprovalStatus();
  }, [user]);

  if (checkingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Block organization users with pending approval
  if (isOrganization && isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Pending Approval
            </CardTitle>
            <CardDescription>
              Your organization account is awaiting approval from our team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-orange-900">
                    Account Under Review
                  </p>
                  <p className="text-sm text-orange-700">
                    Our administrators will review your registration shortly. You'll receive an email once your account is approved.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This typically takes 1-2 business days. If you have questions, please contact support.
            </p>
            <Button onClick={() => signOut()} variant="outline" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
