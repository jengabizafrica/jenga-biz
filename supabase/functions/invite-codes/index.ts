import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { 
  getUserFromRequest, 
  requireAdmin, 
  requireSuperAdmin, 
  isAdmin,
  isHubManager,
  getServiceRoleClient,
  AuthError 
} from '../_shared/auth.ts';
import { 
  handleCors, 
  successResponse, 
  errorResponse, 
  handleError 
} from '../_shared/responses.ts';
import {
  validateBody,
  validateQuery,
  createInviteCodeSchema,
  validateInviteCodeQuerySchema,
  consumeInviteCodeSchema,
} from '../_shared/validation.ts';

// Utility to generate a random invite code
function generateInviteCode(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GET /invite-codes?hub_id=<uuid>&limit=&offset=
async function listInviteCodes(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireAdmin(user);

  const url = new URL(req.url);
  const hubId = url.searchParams.get('hub_id');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // If hubId provided, enforce that non-super_admins can only query their own hubs
  const isSuper = user.roles.includes('super_admin');
  if (hubId && !isSuper) {
    // Check requester roles for that hub
    const { data: requesterRoles, error: reqRolesErr } = await supabase
      .from('user_roles')
      .select('role, hub_id')
      .eq('user_id', user.id)
      .eq('hub_id', hubId);
    if (reqRolesErr) throw reqRolesErr;
    const allowed = (requesterRoles || []).some((r: any) => ['admin', 'hub_manager'].includes(r.role));
    if (!allowed) return errorResponse('FORBIDDEN', 'Not authorized to view invites for this hub', 403);
  }

  // Use service role client for schema probing and listing to bypass RLS and ensure server-side scoping
  let serviceClient;
  try {
    serviceClient = getServiceRoleClient();
  } catch (e) {
    console.error('Service role client unavailable for listing invites', e);
    return errorResponse('MISSING_SERVICE_ROLE', 'Service role key not configured for list operation', 500);
  }

  // Detect whether the invite_codes table has a hub_id column in this DB
  let hasHubIdColumn = true;
  try {
    // simple probe: attempt to select hub_id with a limit 1 using service client
    const probe = await serviceClient.from('invite_codes').select('hub_id').limit(1).maybeSingle();
    if ((probe as any).error) {
      throw (probe as any).error;
    }
  } catch (probeErr) {
    // If the probe failed due to missing column, we'll treat the table as org-only
    hasHubIdColumn = false;
  }

  // If no hubId provided:
  // - If requester is NOT super_admin: default to hubs the requester administers
  // - If requester IS super_admin: default to organization-level invites only (hub_id IS NULL)
  let hubFilter: string[] | null = null;
  let superDefaultToOrgs = false;
  if (!hubId) {
    if (!isSuper) {
      const { data: myHubRoles, error: myHubRolesErr } = await supabase
        .from('user_roles')
        .select('hub_id, role')
        .eq('user_id', user.id);
      if (myHubRolesErr) throw myHubRolesErr;
      const adminHubIds = (myHubRoles || []).filter((r: any) => ['admin', 'hub_manager'].includes(r.role) && r.hub_id).map((r: any) => r.hub_id).filter(Boolean);
      if (adminHubIds.length === 0) {
        return successResponse({ invites: [], meta: { total: 0, limit, offset } });
      }
      hubFilter = adminHubIds as string[];
    } else {
      // super admin with no hubId: default to organization invites only (hub_id IS NULL)
      superDefaultToOrgs = true;
    }
  }

  // Build query (use service client and .range for paging in this runtime)
  const start = offset;
  const end = offset + Math.max(0, limit - 1);
  let query = serviceClient.from('invite_codes').select('*').order('created_at', { ascending: false }).range(start, end);
  if (!hasHubIdColumn) {
    // Table has no hub_id column; only organization-level invites are possible
    // Respect request: if hubId was requested, it's not found -> forbidden
    if (hubId) {
      return errorResponse('BAD_REQUEST', 'This deployment does not support hub-scoped invites', 400);
    }
    // proceed to select all invites (considered org-level)
  } else {
    if (hubId) {
      query = query.eq('hub_id', hubId);
    } else if (hubFilter) {
      query = query.in('hub_id', hubFilter as any);
    } else if (superDefaultToOrgs) {
      query = query.is('hub_id', null);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return successResponse({ invites: data || [], meta: { total: (data || []).length, limit, offset } });
}

const handler = async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const method = req.method;

    if (method === 'GET' && path === 'health') {
      return successResponse({ status: 'ok', service: 'invite-codes' });
    }

    if (method === 'POST' && path === 'invite-codes') {
      return await createInviteCode(req);
    }

    if (method === 'GET' && path === 'invite-codes') {
      return await listInviteCodes(req);
    }

    if (method === 'DELETE' && path === 'invite-codes') {
      return await deleteInviteCode(req);
    }

    if (method === 'GET' && path === 'validate') {
      return await validateInviteCode(req);
    }

    if (method === 'POST' && path === 'consume') {
      return await consumeInviteCode(req);
    }

    return errorResponse('NOT_FOUND', 'Endpoint not found', 404);
  } catch (error) {
    return handleError(error);
  }
};

// POST /invite-codes
// Create an invite code. Super Admin can create both organization and business invites.
// Hub Manager/Admin can create only business (entrepreneur) invites tied to their hub context.
async function createInviteCode(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  // At minimum require hub_manager/admin or super_admin
  requireAdmin(user);

  const body = await validateBody(req, createInviteCodeSchema) as z.infer<typeof createInviteCodeSchema>;

  // Enforce RBAC: non-super-admins cannot create organization invites
  if (body.account_type === 'organization') {
    requireSuperAdmin(user);
  }

  // Determine inviter hub context if creator is hub_manager/admin
  let inviterHubId: string | null = null;
  if (isHubManager(user) || isAdmin(user)) {
    const { data: rolesRows, error: rolesErr } = await supabase
      .from('user_roles')
      .select('hub_id, role')
      .eq('user_id', user.id);
    if (rolesErr) throw rolesErr;
    const hubContext = (rolesRows || []).find(r => (r.role === 'hub_manager' || r.role === 'admin') && r.hub_id);
    inviterHubId = hubContext?.hub_id || null;
  }

  const code = generateInviteCode(12);
  const expiresAt = body.expires_at || new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(); // 14 days default

  // Only allow explicit hub_id when creator is super_admin. Otherwise, use inviterHubId (if any).
  const hubToPersist = user.roles.includes('super_admin') ? (body.hub_id || null) : inviterHubId;

  const insertPayload: any = {
    code,
    invited_email: body.invited_email,
    account_type: body.account_type,
    created_by: user.id,
    expires_at: expiresAt,
  };
  if (hubToPersist) insertPayload.hub_id = hubToPersist;

  const { data, error } = await supabase
    .from('invite_codes')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;

  return successResponse({
    ...data,
    hub_context: inviterHubId,
  }, 201);
}

// GET /invite-codes/validate?code=...
async function validateInviteCode(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { code } = validateQuery(url, validateInviteCodeQuerySchema) as z.infer<typeof validateInviteCodeQuerySchema>;

  // Publicly accessible validation
  const nowIso = new Date().toISOString();
  const { data, error } = await (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )
  .from('invite_codes')
  .select('*')
  .eq('code', code)
  .is('used_at', null)
  .gte('expires_at', nowIso)
  .maybeSingle();

  if (error) throw error;
  if (!data) {
    return successResponse({ valid: false });
  }

  return successResponse({
    valid: true,
    invite: {
      code: data.code,
      account_type: data.account_type,
      invited_email: data.invited_email,
      expires_at: data.expires_at,
    }
  });
}

// POST /invite-codes/consume
// Body: { code, user_id }
// Marks invite as used and, if created by an organization/hub admin, links the user to that hub as entrepreneur.
async function consumeInviteCode(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  const { code, user_id } = await validateBody(req, consumeInviteCodeSchema) as z.infer<typeof consumeInviteCodeSchema>;

  if (user.id !== user_id && !isAdmin(user)) {
    throw new AuthError('Not allowed to consume invite for another user', 403);
  }

  // Fetch invite
  const { data: invite, error: inviteErr } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .single();
  if (inviteErr) throw inviteErr;

  // Determine creator's hub context
  let creatorHubId: string | null = null;
  if (invite) {
    const { data: creatorRoles } = await supabase
      .from('user_roles')
      .select('hub_id, role')
      .eq('user_id', invite.created_by);
    const hubCtx = (creatorRoles || []).find(r => (r.role === 'hub_manager' || r.role === 'admin') && r.hub_id);
    creatorHubId = hubCtx?.hub_id || null;
  }

  // Mark invite as used
  const { error: updateErr } = await supabase
    .from('invite_codes')
    .update({ used_by: user_id, used_at: new Date().toISOString() })
    .eq('code', code);
  if (updateErr) throw updateErr;

  // If the invite is for a business account and there is a hub context, link user to hub as entrepreneur
  let linkedHubId: string | null = null;
  if (invite.account_type === 'business' && creatorHubId) {
    // Add user role entrepreneur with hub_id
    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id, role: 'entrepreneur', hub_id: creatorHubId });
    if (roleErr && roleErr.code !== '23505') { // ignore duplicate role
      throw roleErr;
    }
    linkedHubId = creatorHubId;
  }

  // Return assigned plan suggestion based on rules and attempt assignment when applicable
  let assignedPlan = linkedHubId ? 'premium' : 'free';
  let subscriptionAssigned = false;

  if (linkedHubId) {
    // Attempt to auto-assign Premium subscription using service role (bypass RLS)
    try {
      const serviceClient = getServiceRoleClient();
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // naive 30-day period

      // Look up an active "Premium" plan (case-insensitive)
      const { data: premiumPlan, error: planErr } = await serviceClient
        .from('subscription_plans')
        .select('id, name, is_active')
        .ilike('name', 'premium')
        .eq('is_active', true)
        .maybeSingle();

      if (planErr) {
        // If table missing, ignore; otherwise rethrow
        if ((planErr as any).code !== '42P01') throw planErr;
      }

      if (premiumPlan?.id) {
        // Check if user already has an active subscription
        const { data: existingSubs, error: subErr } = await serviceClient
          .from('user_subscriptions')
          .select('id, status, current_period_end')
          .eq('user_id', user_id)
          .eq('status', 'active')
          .gt('current_period_end', now.toISOString());

        if (subErr) {
          if ((subErr as any).code !== '42P01') throw subErr;
        }

        if (!existingSubs || existingSubs.length === 0) {
          const { error: assignErr } = await serviceClient
            .from('user_subscriptions')
            .insert({
              user_id,
              plan_id: premiumPlan.id,
              status: 'active',
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            });

          if (assignErr) {
            if ((assignErr as any).code !== '42P01') throw assignErr;
          } else {
            subscriptionAssigned = true;
          }
        } else {
          subscriptionAssigned = true; // already has an active subscription
        }
      }
    } catch (e) {
      // Log and continue without failing invite consumption
      console.error('Premium auto-assignment error:', e);
    }
  }

  return successResponse({
    consumed: true,
    linked_hub_id: linkedHubId,
    assigned_plan: assignedPlan,
    subscription_assigned: subscriptionAssigned,
  });
}

serve(handler);

// DELETE /invite-codes?id=<uuid>
async function deleteInviteCode(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  // require at least admin privileges
  requireAdmin(user);

  const url = new URL(req.url);
  const schema = z.object({ id: z.string().uuid() });
  const { id } = validateQuery(url, schema) as { id: string };

  // Fetch the invite
  const { data: invite, error: inviteErr } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (inviteErr) throw inviteErr;
  if (!invite) return errorResponse('NOT_FOUND', 'Invite not found', 404);

  // Determine the hub context of the invite creator (if any)
  let creatorHubId: string | null = null;
  try {
    const { data: creatorRoles } = await supabase
      .from('user_roles')
      .select('hub_id, role')
      .eq('user_id', invite.created_by);
    const hubCtx = (creatorRoles || []).find((r: any) => (r.role === 'hub_manager' || r.role === 'admin') && r.hub_id);
    creatorHubId = hubCtx?.hub_id || null;
  } catch (e) {
    // ignore and continue; creatorHubId will be null
    console.error('Error fetching creator roles for invite deletion', e);
  }

  // Authorization: allow if super admin OR if current user is admin/hub_manager for the same hub
  let allowed = false;
  try {
    // If super admin, allow
    try {
      requireSuperAdmin(user);
      allowed = true;
    } catch (_err) {
      // not super admin
    }

    if (!allowed) {
      // if invite tied to a hub, check current user's roles for same hub
      if (creatorHubId) {
        const { data: myRoles, error: myRolesErr } = await supabase
          .from('user_roles')
          .select('hub_id, role')
          .eq('user_id', user.id);
        if (myRolesErr) throw myRolesErr;
        const hasHubAdmin = (myRoles || []).some((r: any) => (r.role === 'hub_manager' || r.role === 'admin') && r.hub_id === creatorHubId);
        if (hasHubAdmin) allowed = true;
      }
    }
  } catch (e) {
    console.error('Error evaluating delete authorization', e);
    return errorResponse('FORBIDDEN', 'Not authorized to delete this invite', 403);
  }

  if (!allowed) {
    return errorResponse('FORBIDDEN', 'Not authorized to delete this invite', 403);
  }

  // Perform hard deletion using the service-role client to bypass RLS and ensure the function can delete invites
  try {
    const serviceClient = getServiceRoleClient();

    const { error: delErr } = await serviceClient
      .from('invite_codes')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('Service client delete error for invite:', delErr);
      return errorResponse('DELETE_FAILED', 'Failed to delete invite code', 500);
    }

    return successResponse({ deleted: true });
  } catch (e) {
    console.error('Failed to delete invite using service role client:', e);
    return errorResponse('DELETE_FAILED', 'Failed to delete invite code', 500);
  }
}
