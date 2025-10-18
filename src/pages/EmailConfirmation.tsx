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
    const handleConfirmation = async () => {
      // Parse session tokens from URL hash
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (confirmationSuccess && accessToken && refreshToken) {
        try {
          // Set the session using tokens from hash
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Error setting session:', sessionError);
            toast.error('Session Error', {
              description: 'Could not establish session. Please log in manually.',
            });
            setTimeout(() => navigate('/', { replace: true }), 2000);
            return;
          }

          toast.success('Email Confirmed!', {
            description: 'Your email has been verified and you are now logged in.',
            duration: 5000,
          });

          // Navigate to dashboard after successful session setup
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 2000);
        } catch (err) {
          console.error('Unexpected error during confirmation:', err);
          toast.error('Unexpected Error', {
            description: 'Please try logging in manually.',
          });
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      } else if (confirmationSuccess) {
        // Success but no tokens in hash (shouldn't happen)
        toast.success('Email Confirmed!', {
          description: 'Your email has been verified.',
          duration: 5000,
        });
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
      } else if (confirmationError) {
        handleConfirmationError(confirmationError, email);
      } else {
        // No confirmation status - redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    };

    handleConfirmation();
  }, [confirmationError, confirmationSuccess, email, navigate]);

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

    // Delay redirect to allow user to see and interact with the toast
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 3000);
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
