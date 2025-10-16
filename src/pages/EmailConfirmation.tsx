import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get('token_hash');
        const type = url.searchParams.get('type') || 'signup';

        if (!tokenHash) {
          setStatus('error');
          setMessage('Invalid confirmation link. Missing token.');
          return;
        }

        // Call our custom confirm-email edge function
        const confirmUrl = `https://diclwatocrixibjpajuf.supabase.co/functions/v1/confirm-email?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;
        
        const response = await fetch(confirmUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          setStatus('error');
          setMessage(result.error || 'Email confirmation failed. Please try again.');
          return;
        }

        // Set the session from the response
        if (result.session) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });

          if (sessionError) {
            console.error('Error setting session:', sessionError);
            setStatus('error');
            setMessage('Failed to establish session. Please try logging in.');
            return;
          }

          setStatus('success');
          setMessage('Email confirmed successfully! Redirecting to dashboard...');
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        } else {
          setStatus('success');
          setMessage('Email confirmed! You can now log in.');
          setTimeout(() => {
            navigate('/');
          }, 2000);
        }
      } catch (error) {
        console.error('Email confirmation error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    confirmEmail();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
            {status === 'loading' && 'Confirming Email...'}
            {status === 'success' && 'Email Confirmed'}
            {status === 'error' && 'Confirmation Failed'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'error' && (
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
