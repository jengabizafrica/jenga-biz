import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * Handles email confirmation redirects from confirm-email edge function
 * Shows toast notifications and redirects to appropriate page
 */
export default function EmailConfirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const confirmationError = searchParams.get('confirmation_error');
  const confirmationSuccess = searchParams.get('confirmation_success');
  const email = searchParams.get('email');

  useEffect(() => {
    if (confirmationSuccess) {
      toast.success('Email Confirmed!', {
        description: 'Your email has been successfully verified.',
      });
      navigate('/dashboard', { replace: true });
    } else if (confirmationError) {
      handleConfirmationError(confirmationError, email);
    } else {
      // No confirmation status - redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [confirmationError, confirmationSuccess, email]);

  const handleConfirmationError = (errorCode: string, userEmail: string | null) => {
    let title = 'Confirmation Failed';
    let description = 'Please try again or contact support.';
    
    switch (errorCode) {
      case 'expired':
        title = 'Confirmation Link Expired';
        description = 'Your confirmation link has expired. Click below to get a new one.';
        break;
      case 'missing_token':
        title = 'Invalid Link';
        description = 'The confirmation link is invalid or incomplete.';
        break;
      case 'failed':
        title = 'Confirmation Failed';
        description = 'We couldn\'t verify your email. Please request a new link.';
        break;
    }

    toast.error(title, {
      description,
      duration: 8000,
      action: userEmail ? {
        label: 'Resend Email',
        onClick: () => handleResendConfirmation(userEmail),
      } : undefined,
    });

    // Redirect to dashboard after showing toast
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 500);
  };

  const handleResendConfirmation = async (userEmail: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in first to resend confirmation email');
        navigate('/auth');
        return;
      }

      const { error } = await supabase.functions.invoke('resend-confirmation', {
        body: { email: userEmail },
      });

      if (error) {
        if (error.message?.includes('Rate limit')) {
          toast.error('Too Many Requests', {
            description: 'Maximum 3 resend requests per hour. Please try again later.',
          });
        } else {
          throw error;
        }
      } else {
        toast.success('Confirmation Email Sent!', {
          description: 'Please check your inbox for the new confirmation email.',
        });
      }
    } catch (error: any) {
      console.error('Error resending confirmation:', error);
      toast.error('Failed to Resend', {
        description: error.message || 'Please try again later.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Processing confirmation...</p>
      </div>
    </div>
  );
}
