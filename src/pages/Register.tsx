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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, account_type: accountType, invite_code: inviteCode || undefined } }
      } as any);

      if (error) {
        toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // After signUp we attempt to consume the invite using the invite-codes Edge Function
      try {
        // fetch current user id
        const { data: { user } } = await supabase.auth.getUser();
        if (user && inviteCode) {
          await apiClient.consumeInviteCode(inviteCode, user.id);
        }
      } catch (e) {
        // log but don't block the UX
        console.error('consumeInvite error', e);
      }

      toast({ title: 'Account created', description: 'Please check your email to confirm.' });
      navigate('/');
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
