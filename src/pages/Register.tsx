import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/lib/api-client';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [inviteCode, setInviteCode] = useState('');
  const [inviteValidated, setInviteValidated] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState<'business'|'organization'>('business');
  const [inviteLocked, setInviteLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('invite_code') || searchParams.get('invite') || '';
    const em = searchParams.get('email') || '';
    // If the auth redirect included tokens (access_token + refresh_token), set the session
    // and show the welcome toast. This covers the case where server returned a session
    // and redirected back to the client with tokens in the URL.
    (async () => {
      try {
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');
        if (accessToken && refreshToken && (type === 'signup' || type === 'recovery' || type === 'signup_invite')) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken } as any);
          if (!error) {
            toast({ title: 'Welcome', description: 'You are signed in.' });
            // Clean up URL params and redirect to home
            navigate('/');
            return;
          } else {
            console.error('Register: failed to set session from URL tokens', error);
          }
        }
      } catch (e) {
        console.error('Register: error handling URL session tokens', e);
      }
    })();
    if (code) {
      setInviteCode(code);
      setInviteLocked(true);
      // validate
      (async () => {
        try {
            const res = await apiClient.validateInviteCode(code);
            setInviteValidated(!!res?.valid);
            if (res?.invite?.invited_email) setEmail(res.invite.invited_email);
            if (res?.invite?.account_type) setAccountType(res.invite.account_type as any);
            if (!res?.valid) {
              // helpful debug info for environments where validation seems inconsistent
              // avoid logging any tokens or headers; only log the validated payload
              console.debug('[invite-validate] validation returned false payload:', res);
            }
          } catch (e: any) {
            setInviteValidated(false);
            // log the error details to help debugging (do not expose secrets)
            console.error('[invite-validate] error while validating invite code:', { message: e?.message || e, raw: e?.error?.raw || e?.error || null });
          }
      })();
    }
    if (em) setEmail(em);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // If there's an invite code, prefer the server atomic signup route which performs
      // auth creation (admin REST API) and consumes the invite server-side. This ensures
      // the invite is marked used and server-side sends/role assignments run even when
      // the client does not receive an access token on signup.
      let signUpData: any = null;
      let signUpError: any = null;

      if (inviteCode) {
        try {
          // Compute functions base like other client code does
          const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
          const getFunctionsBase = () => {
            const injected = (window as any).__SUPABASE_FUNCTIONS_URL__;
            if (injected) return injected.replace(/\/$/, '');
            if (metaEnv.VITE_SUPABASE_FUNCTIONS_URL) return metaEnv.VITE_SUPABASE_FUNCTIONS_URL.replace(/\/$/, '');
            const ref = metaEnv.VITE_SUPABASE_PROJECT_REF || metaEnv.VITE_SUPABASE_PROJECT_ID;
            if (ref) return `https://${ref}.functions.supabase.co`;
            const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || '';
            if (supabaseUrl) return supabaseUrl.replace(/\/$/, '').replace('.supabase.co', '.functions.supabase.co');
            return window.location.origin;
          };
          const functionsBase = getFunctionsBase();

          const anonKey = (metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || metaEnv.VITE_SUPABASE_ANON_KEY || (window as any).VITE_SUPABASE_PUBLISHABLE_KEY || '');
          const resp = await fetch(`${functionsBase}/user-management/invite-signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
            body: JSON.stringify({ email, password, full_name: fullName, account_type: accountType, invite_code: inviteCode }),
          });

          const body = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            signUpError = body?.error || new Error(body?.message || `Invite signup failed: ${resp.status}`);
          } else {
            signUpData = body;
          }
        } catch (e) {
          signUpError = e;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, account_type: accountType } }
        } as any);
        signUpData = data;
        signUpError = error;
      }

      if (signUpError) {
        toast({ title: 'Signup failed', description: signUpError.message || String(signUpError), variant: 'destructive' });
        setLoading(false);
        return;
      }

      // After signUp we attempt to consume the invite using the invite-codes Edge Function
      try {
        // Supabase may or may not create a session immediately depending on confirmation settings.
        // Prefer the response from signUp which includes the newly created user id if available.
        // Fallback to supabase.auth.getUser() when signUp did create a session.
        // The goal is to always call consumeInviteCode with the created user's id so the server
        // can mark the invite used and trigger server-side confirmation sends.
        let createdUserId: string | null = null;

        // Prefer id from the signUp response when present (works when no session is created yet)
        if (signUpData && (signUpData as any).user && (signUpData as any).user.id) {
          createdUserId = (signUpData as any).user.id;
        }

        // If not present in signUp response, try to read the current session user
        if (!createdUserId) {
          try {
            const maybe = await supabase.auth.getUser();
            if (maybe?.data?.user?.id) createdUserId = maybe.data.user.id;
          } catch (_err) {
            // ignore - we'll try other ways to obtain the id
          }
        }

        // If no session user, attempt to use the signUp response via the GoTrue client which may
        // expose the last signed up user via getUser or the signUp response. We'll attempt to read
        // the `user` property returned by signUp via the `auth` state in the client (some SDK versions
        // populate it synchronously). As a final fallback, attempt to decode the last redirect parameters
        // or skip consume if no id is available.
        // NOTE: This is defensive — the important change is that when signUp returns a created user id,
        // we will use it to call consumeInviteCode.

        if (!createdUserId && (window as any).__supabase_last_signup_user_id) {
          createdUserId = (window as any).__supabase_last_signup_user_id;
        }

        // If we still don't have a user id, try reading the session again after a short delay
        if (!createdUserId) {
          try {
            const retry = await supabase.auth.getUser();
            if (retry?.data?.user?.id) createdUserId = retry.data.user.id;
          } catch (_e) {
            // ignore
          }
        }

        if (createdUserId && inviteCode) {
          // If signUp returned a session with an access_token, use it to call the functions endpoint
          // directly with an Authorization header. This covers the case where the SDK hasn't
          // persisted the session yet but we do have a valid token to authenticate the call.
          const accessToken = (signUpData as any)?.session?.access_token;
          if (accessToken) {
            try {
              // Compute functions base like other client code does
              const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
              const getFunctionsBase = () => {
                const injected = (window as any).__SUPABASE_FUNCTIONS_URL__;
                if (injected) return injected.replace(/\/$/, '');
                if (metaEnv.VITE_SUPABASE_FUNCTIONS_URL) return metaEnv.VITE_SUPABASE_FUNCTIONS_URL.replace(/\/$/, '');
                const ref = metaEnv.VITE_SUPABASE_PROJECT_REF || metaEnv.VITE_SUPABASE_PROJECT_ID;
                if (ref) return `https://${ref}.functions.supabase.co`;
                const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || '';
                if (supabaseUrl) return supabaseUrl.replace(/\/$/, '').replace('.supabase.co', '.functions.supabase.co');
                return window.location.origin;
              };
              const functionsBase = getFunctionsBase();
              const resp = await fetch(`${functionsBase}/invite-codes/consume`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ code: inviteCode, user_id: createdUserId }),
              });

              if (!resp.ok) {
                const body = await resp.text().catch(() => '');
                console.error('consumeInvite (with token) failed', resp.status, body);
              }
            } catch (e) {
              console.error('consumeInvite (with token) error', e);
            }
          } else {
            // fallback to apiClient which will use the current session if available
            try {
              await apiClient.consumeInviteCode(inviteCode, createdUserId);
            } catch (e) {
              console.error('consumeInvite error (fallback)', e);
            }
          }
        } else {
          // If we couldn't determine the created user's id, log for diagnostics but don't block UX.
          console.debug('consumeInvite skipped: no user id available after signup', { inviteCode, createdUserId });
        }
      } catch (e) {
        // log but don't block the UX
        console.error('consumeInvite error', e);
      }

      // If the server returned a response for the invite-signup flow, it will
      // include `created: true` and a `token_exchanged` boolean indicating whether
      // the server was able to exchange credentials for a session. Respect that
      // and set the client session when provided.
      try {
        if (inviteCode && signUpData) {
          const created = (signUpData as any).created;
          const tokenExchanged = (signUpData as any).token_exchanged;
          const serverSession = (signUpData as any).session || null;

          if (created && tokenExchanged && serverSession && serverSession.access_token) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: serverSession.access_token,
              refresh_token: serverSession.refresh_token,
            } as any);

            if (setSessionError) {
              console.error('Failed to set session from server response:', setSessionError);
              toast({ title: 'Account created', description: 'Please check your email to confirm.' });
              navigate('/');
            } else {
              toast({ title: `Welcome ${fullName || ''}`, description: 'You are signed in.' });
              navigate('/');
            }
          } else if (created && tokenExchanged === false) {
            // Server created account but could not exchange tokens — instruct user to sign in
            toast({ title: 'Account created', description: 'Please sign in to access your account.' });
            navigate('/');
          } else if (created) {
            // Created but unknown token_exchanged state — fallback to generic message
            toast({ title: 'Account created', description: 'Please check your email to confirm.' });
            navigate('/');
          }
        } else {
          // Non-invite flow uses the client SDK's signup behavior
          const serverSession = (signUpData && (signUpData as any).data && (signUpData as any).data.session) || (signUpData && (signUpData as any).session);
          if (serverSession && serverSession.access_token) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: serverSession.access_token,
              refresh_token: serverSession.refresh_token,
            } as any);

            if (setSessionError) {
              console.error('Failed to set session from client signup response:', setSessionError);
              toast({ title: 'Account created', description: 'Please check your email to confirm.' });
              navigate('/');
            } else {
              toast({ title: `Welcome ${fullName || ''}`, description: 'You are signed in.' });
              navigate('/');
            }
          } else {
            toast({ title: 'Account created', description: 'Please check your email to confirm.' });
            navigate('/');
          }
        }
      } catch (e) {
        console.error('Error processing server session', e);
        toast({ title: 'Account created', description: 'Please check your email to confirm.' });
        navigate('/');
      }
    } catch (e: any) {
      toast({ title: 'Signup error', description: e.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Register using an invite code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <Input id="accountType" value={accountType} readOnly />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invite Code</Label>
              <div className="flex items-center gap-2">
                <Input id="inviteCode" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} readOnly={inviteLocked} />
                {inviteLocked ? (
                  <Button variant="outline" size="sm" onClick={() => setInviteLocked(false)}>Edit</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={async () => {
                    // validate current code
                    try {
                      const res = await apiClient.validateInviteCode(inviteCode);
                      setInviteValidated(!!res?.valid);
                      if (res?.invite?.invited_email) setEmail(res.invite.invited_email);
                      if (res?.invite?.account_type) setAccountType(res.invite.account_type as any);
                      setInviteLocked(res?.valid === true);
                      if (!res?.valid) toast({ title: 'Invalid invite', description: 'Invite code is invalid or expired', variant: 'destructive' });
                    } catch (e) {
                      setInviteValidated(false);
                      toast({ title: 'Validation failed', description: 'Could not validate invite code', variant: 'destructive' });
                    }
                  }}>Validate</Button>
                )}
              </div>
              {inviteValidated === false && (
                <Alert>
                  <AlertDescription>Invite code is invalid or expired.</AlertDescription>
                </Alert>
              )}
              {inviteValidated === true && (
                <Alert>
                  <AlertDescription>Invite code validated</AlertDescription>
                </Alert>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
