import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { Copy, Mail, Clock, CheckCircle, XCircle, Building2, Users } from 'lucide-react';

// Type definitions
interface UserRole {
  id: string;
  user_id: string;
  role: string;
  hub_id: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
  roles: UserRole[];
  account_type?: string | null;
}

interface InviteCode {
  id: string;
  code: string;
  invited_email: string;
  account_type: 'business' | 'organization';
  used_at: string | null;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}

export function InviteCodeManager({ hubId }: { hubId?: string | null } = {}) {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showRegistrationLinkModal, setShowRegistrationLinkModal] = useState(false);
  const [lastRegistrationLink, setLastRegistrationLink] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [inviteToDelete, setInviteToDelete] = useState<InviteCode | null>(null);
  const [newInvite, setNewInvite] = useState({
    email: '',
    accountType: 'business' as 'business' | 'organization'
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const { toast } = useToast();

  // Fetch user profile and roles
  const fetchUserProfile = useCallback(async (): Promise<void> => {
    setLoadingProfile(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) return;

      // Fetch profile and roles in parallel
      const [
        { data: profile, error: profileError },
        { data: roles, error: rolesError }
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id)
      ]);

      if (profileError) throw profileError;
      if (rolesError) throw rolesError;

      setUserProfile({
        ...profile,
        roles: roles || []
      });
    } catch (error) {
      console.error('Error in fetchUserProfile:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive",
      });
    } finally {
      setLoadingProfile(false);
    }
  }, [toast]);

  // Fetch invite codes
  const fetchInviteCodes = useCallback(async () => {
    setLoading(true);
    try {
      const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
      const getFunctionsBase = () => {
        const injected = (window as any).__SUPABASE_FUNCTIONS_URL__;
        if (injected) return injected;
        if (metaEnv.VITE_SUPABASE_FUNCTIONS_URL) return metaEnv.VITE_SUPABASE_FUNCTIONS_URL;
        const ref = metaEnv.VITE_SUPABASE_PROJECT_REF || metaEnv.VITE_SUPABASE_PROJECT_ID;
        if (ref) return `https://${ref}.functions.supabase.co`;
        const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || SUPABASE_URL || '';
        if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
        return window.location.origin;
      };
      const functionsBase = getFunctionsBase();

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // include hub filter when provided
      const query = hubId ? `?hub_id=${encodeURIComponent(hubId)}` : '';
      const resp = await fetch(`${functionsBase}/invite-codes${query}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || 'Failed to fetch invite codes');
      }

      const payload = await resp.json();
      // Edge Functions use a response envelope: { success: true, data: ... }
      // adapt to that shape and fall back to older shape if present
      setInviteCodes((payload?.data?.invites || payload?.invites || []) as InviteCode[]);
    } catch (error) {
      console.error('Error fetching invite codes:', error);
      toast({
        title: "Error",
        description: "Failed to load invite codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const generateInviteCode = async () => {
    if (!newInvite.email) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      // Create invite via Edge Function so server enforces RBAC and hub scoping
      const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
      const getFunctionsBase = () => {
        const injected = (window as any).__SUPABASE_FUNCTIONS_URL__;
        if (injected) return injected;
        if (metaEnv.VITE_SUPABASE_FUNCTIONS_URL) return metaEnv.VITE_SUPABASE_FUNCTIONS_URL;
        const ref = metaEnv.VITE_SUPABASE_PROJECT_REF || metaEnv.VITE_SUPABASE_PROJECT_ID;
        if (ref) return `https://${ref}.functions.supabase.co`;
        const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || SUPABASE_URL || '';
        if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
        return window.location.origin;
      };
      const functionsBase = getFunctionsBase();

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        invited_email: newInvite.email,
        account_type: newInvite.accountType,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        hub_id: hubId || null,
      };

      const res = await fetch(`${functionsBase}/invite-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || 'Failed to create invite');
      }

      const created = await res.json();
      // server wraps created resource in { success: true, data: { ... } }
      const code = created?.data?.code || created?.code || Math.random().toString(36).substring(2, 15);

      // Send email with link to register (one-click link) - best-effort
      try {
        const appUrl = window.location.origin;
        const registerUrl = `${appUrl}/register?invite_code=${encodeURIComponent(code)}&email=${encodeURIComponent(newInvite.email)}`;

        // Determine functions base: prefer injected env variables; fall back to Vite env or Netlify-style functions
        const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
        const getFunctionsBase = () => {
          // Prefer explicit runtime override (injected by hosting) or a Vite env
          const injected = (window as any).__SUPABASE_FUNCTIONS_URL__;
          if (injected) return injected;
          if (metaEnv.VITE_SUPABASE_FUNCTIONS_URL) return metaEnv.VITE_SUPABASE_FUNCTIONS_URL;

          // Prefer project ref/id envs (Vercel/Netlify style)
          const ref = metaEnv.VITE_SUPABASE_PROJECT_REF || metaEnv.VITE_SUPABASE_PROJECT_ID;
          if (ref) return `https://${ref}.functions.supabase.co`;

          // Fall back to the Supabase URL env and use the functions/v1 path
          const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || SUPABASE_URL || '';
          if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;

          // Last resort: current origin (development only)
          return window.location.origin;
        };
        const functionsBase = getFunctionsBase();

        // Improved email payload: include subject, plain text and html body
        const payload = {
          email: newInvite.email,
          confirmationUrl: registerUrl,
          subject: 'You were invited to join Jenga',
          text: `You have been invited to join Jenga. Click or paste this link to register: ${registerUrl}`,
          html: `<p>You have been invited to join <strong>Jenga</strong>.</p><p>Click the link below to complete registration:</p><p><a href="${registerUrl}">${registerUrl}</a></p><p>If you prefer, copy this invite code: <code>${code}</code></p>`
        };

        await fetch(`${functionsBase}/send-signup-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        // best-effort; don't block
        console.error('Failed to send invite email:', e);
      }
        const appUrl = window.location.origin;
        const registerUrl = `${appUrl}/register?invite_code=${encodeURIComponent(code)}&email=${encodeURIComponent(newInvite.email)}`;

        // show the registration link modal so admin can copy/send it immediately
        setLastRegistrationLink(registerUrl);
        setShowRegistrationLinkModal(true);

        toast({
          title: 'Invite code created!',
          description: `Invite code for ${newInvite.email} has been generated.`,
        });

      // Reset form and refresh list
      setNewInvite({ email: '', accountType: 'business' });
      await fetchInviteCodes();
    } catch (error) {
      console.error('Error generating invite code:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invite code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const target = inviteCodes.find(i => i.id === inviteId) || null;
    setInviteToDelete(target);
    setShowDeleteModal(true);
  };

  const confirmDeleteInvite = async () => {
    if (!inviteToDelete) return;
    try {
      const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
      const getFunctionsBase = () => {
        const injected = (window as any).__SUPABASE_FUNCTIONS_URL__;
        if (injected) return injected;
        if (metaEnv.VITE_SUPABASE_FUNCTIONS_URL) return metaEnv.VITE_SUPABASE_FUNCTIONS_URL;
        const ref = metaEnv.VITE_SUPABASE_PROJECT_REF || metaEnv.VITE_SUPABASE_PROJECT_ID;
        if (ref) return `https://${ref}.functions.supabase.co`;
        const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || '';
        if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
        return window.location.origin;
      };
      const functionsBase = getFunctionsBase();

      // Get the current session access token to forward
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await fetch(`${functionsBase}/invite-codes?id=${encodeURIComponent(inviteToDelete.id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || 'Delete failed');
      }

      toast({ title: 'Invite deleted', description: 'The invite code was removed.' });
      setShowDeleteModal(false);
      setInviteToDelete(null);
      await fetchInviteCodes();
    } catch (err) {
      console.error('Failed to delete invite:', err);
      toast({ title: 'Delete failed', description: 'Unable to delete invite code', variant: 'destructive' });
      setShowDeleteModal(false);
      setInviteToDelete(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Invite code copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const sendInviteEmail = async (invite: InviteCode) => {
    try {
      const appUrl = window.location.origin;
      const registerUrl = `${appUrl}/register?invite_code=${encodeURIComponent(invite.code)}&email=${encodeURIComponent(invite.invited_email)}`;
      const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
      const getFunctionsBase = () => {
        const injected = (window as any).__SUPABASE_FUNCTIONS_URL__;
        if (injected) return injected;
        if (metaEnv.VITE_SUPABASE_FUNCTIONS_URL) return metaEnv.VITE_SUPABASE_FUNCTIONS_URL;
        const ref = metaEnv.VITE_SUPABASE_PROJECT_REF || metaEnv.VITE_SUPABASE_PROJECT_ID;
        if (ref) return `https://${ref}.functions.supabase.co`;
        const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || '';
        if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
        return window.location.origin;
      };
      const functionsBase = getFunctionsBase();

      const payload = {
        email: invite.invited_email,
        confirmationUrl: registerUrl,
        subject: 'You were invited to join Jenga',
        text: `You have been invited to join Jenga. Register here: ${registerUrl}`,
        html: `<p>You have been invited to join <strong>Jenga</strong>.</p><p>Click the link below to complete registration:</p><p><a href="${registerUrl}">${registerUrl}</a></p><p>Invite code: <code>${invite.code}</code></p>`
      };

      const resp = await fetch(`${functionsBase}/send-signup-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) throw new Error('Email send failed');

      toast({ title: 'Email sent', description: `Invite sent to ${invite.invited_email}` });
    } catch (e) {
      console.error('Failed to send invite email:', e);
      toast({ title: 'Email failed', description: 'Could not send invite email', variant: 'destructive' });
    }
  };

  const getStatusBadge = (invite: InviteCode) => {
    if (invite.used_at) {
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle className="w-3 h-3" />
          Used
        </Badge>
      );
    }

    const isExpired = new Date(invite.expires_at) < new Date();
    if (isExpired) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Expired
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="gap-1">
        <Clock className="w-3 h-3" />
        Active
      </Badge>
    );
  };

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      await fetchUserProfile();
      await fetchInviteCodes();
    };
    loadData();
  }, [fetchUserProfile, fetchInviteCodes]);

  // Loading state
  if (loading || loadingProfile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Check if user can create invite codes
  const canCreateInvites = userProfile?.roles?.some(role => 
    ['admin', 'super_admin', 'hub_manager'].includes(role.role)
  ) || userProfile?.account_type === 'organization';

  if (!canCreateInvites) {
    return (
      <Alert>
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to manage invite codes. Only organizations and administrators can create invites.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create Invite Code</CardTitle>
              <CardDescription>
                Generate invite codes for new users to join your organization
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={newInvite.email}
                onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <Label>Account Type</Label>
              <RadioGroup 
                value={newInvite.accountType}
                onValueChange={(value: 'business' | 'organization') => 
                  setNewInvite({ ...newInvite, accountType: value })
                }
              >
                <div className="flex items-center space-x-2 p-2 rounded border hover:bg-accent/50">
                  <RadioGroupItem value="business" id="invite-business" />
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="invite-business">Business Account</Label>
                </div>
                {/* Only allow organization invites for global super_admins or actual organization accounts.
                    Hide the organization option for hub-scoped contexts and for users that are hub admins/managers. */}
                {(() => {
                  const isSuperAdmin = !!userProfile?.roles?.some(r => r.role === 'super_admin');
                  const isOrgAccount = userProfile?.account_type === 'organization';
                  const isHubScopedAdmin = !!userProfile?.roles?.some(r => ['hub_manager', 'admin'].includes(r.role));

                  // Visible only when not hub-scoped (no hubId), the user is NOT a hub admin/manager,
                  // and user is either super_admin or an organization account.
                  if (!hubId && !isHubScopedAdmin && (isSuperAdmin || isOrgAccount)) {
                    return (
                      <div className="flex items-center space-x-2 p-2 rounded border hover:bg-accent/50">
                        <RadioGroupItem value="organization" id="invite-organization" />
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="invite-organization">Organization Account</Label>
                      </div>
                    );
                  }
                  return null;
                })()}
              </RadioGroup>
            </div>

            <Button 
              onClick={generateInviteCode}
              disabled={creating}
              className="w-full"
            >
              {creating ? "Creating..." : "Generate Invite Code"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Delete confirmation modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Invite</DialogTitle>
          </DialogHeader>
          <div className="p-2">
            <p className="text-sm">Are you sure you want to delete this invite code? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setInviteToDelete(null); }}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDeleteInvite}>Delete</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registration link modal shown after creating an invite */}
      <Dialog open={showRegistrationLinkModal} onOpenChange={setShowRegistrationLinkModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-2">
            <p className="text-sm text-gray-600">Share this link with the invited user to allow one-click registration.</p>
            <div className="bg-slate-50 p-3 rounded border font-mono text-sm break-all">{lastRegistrationLink}</div>
            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  if (!lastRegistrationLink) return;
                  try {
                    await navigator.clipboard.writeText(lastRegistrationLink);
                    toast({ title: 'Copied', description: 'Registration link copied to clipboard' });
                  } catch (e) {
                    console.error('Failed to copy registration link', e);
                    toast({ title: 'Copy failed', description: 'Could not copy link', variant: 'destructive' });
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-2" /> Copy link
              </Button>

              <Button
                variant="ghost"
                onClick={() => setShowRegistrationLinkModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Invite Codes</CardTitle>
          <CardDescription>
            Manage and track your generated invite codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading invite codes...</div>
          ) : inviteCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No invite codes created yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteCodes.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.invited_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {invite.account_type === 'business' ? (
                          <><Building2 className="w-3 h-3 mr-1" />Business</>
                        ) : (
                          <><Users className="w-3 h-3 mr-1" />Organization</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {invite.code}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(invite)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(invite.code)}
                        disabled={!!invite.used_at}
                        title="Copy invite code"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const appUrl = window.location.origin;
                          const registerUrl = `${appUrl}/register?invite_code=${encodeURIComponent(invite.code)}&email=${encodeURIComponent(invite.invited_email)}`;
                          copyToClipboard(registerUrl);
                          toast({ title: 'Link copied', description: 'Registration link copied to clipboard' });
                        }}
                        disabled={!!invite.used_at}
                        title="Copy registration link"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendInviteEmail(invite)}
                        disabled={!!invite.used_at}
                        title="Send invite email"
                      >
                        <Mail className="w-4 h-4" />
                      </Button>
                      {/* Delete invite - shown to admins/hub managers */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteInvite(invite.id)}
                        title="Delete invite code"
                      >
                        <XCircle className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}