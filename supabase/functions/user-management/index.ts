// deno-lint-ignore-file no-explicit-any no-import-prefix no-unused-vars prefer-const
/**
 * User Management Edge Function
 * Handles all user-related operations with proper authorization and validation
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  AuthError,
  getServiceRoleClient,
  getUserFromRequest,
  isAdmin,
  isHubManager,
  requireAdmin,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  fetchUserRoles,
  findHubContextFromRoles,
  isSuperAdminFromRoles,
} from "../_shared/roles.ts";
import {
  consumeInviteCodeSchema,
  // invite schemas
  createInviteCodeSchema,
  getUsersQuerySchema,
  sanitizeString,
  updateProfileSchema,
  updateUserRoleSchema,
  validateBody,
  validateInviteCodeQuerySchema,
  validateQuery,
} from "../_shared/validation.ts";
import {
  errorResponse,
  handleCors,
  handleError,
  noContentResponse,
  paginatedResponse,
  successResponse,
} from "../_shared/responses.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCors();
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    const method = req.method;

    // Route handling
    if (method === "GET" && path === "me") {
      return await getUserProfile(req);
    }

    if (method === "PATCH" && path === "me") {
      return await updateUserProfile(req);
    }

    if (method === "GET" && path === "user-management") {
      return await getUsers(req);
    }

    // Invite code endpoints under /user-management/invite*
    if (
      method === "POST" && path === "invite-codes" ||
      (method === "POST" && path === "invite")
    ) {
      return await createInvite(req);
    }

    // Atomic signup + consume endpoint
    if (method === "POST" && path === "invite-signup") {
      return await inviteSignupAndConsume(req);
    }

    if (
      method === "GET" && (path === "invite-codes" || path === "invite") &&
      url.pathname.endsWith("/validate")
    ) {
      return await validateInvite(req);
    }

    if (
      method === "POST" && (path === "invite-codes" || path === "invite") &&
      url.pathname.endsWith("/consume")
    ) {
      return await consumeInvite(req);
    }

    if (method === "POST" && path === "roles") {
      return await updateUserRole(req);
    }

    if (method === "PATCH" && url.searchParams.has("userId")) {
      return await adminUpdateUser(req);
    }

    if (method === "DELETE" && url.searchParams.has("userId")) {
      return await deactivateUser(req);
    }

    if (method === "GET" && path === "health") {
      return successResponse({ status: "ok", service: "user-management" });
    }

    return errorResponse("NOT_FOUND", "Endpoint not found", 404);
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Get current user profile and roles
 * GET /user-management/me
 */
async function getUserProfile(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);

  // Get full profile data
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  return successResponse({
    id: user.id,
    email: user.email,
    roles: user.roles,
    ...profile,
  });
}

// --- Invite handlers (mirrors invite-codes/index.ts but available under user-management)
// POST /user-management/invite or POST /user-management/invite-codes
async function createInvite(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  // At minimum require hub_manager/admin or super_admin
  requireAdmin(user);

  const body = await validateBody(req, createInviteCodeSchema) as any;

  // Enforce RBAC: non-super-admins cannot create organization invites
  if (body.account_type === "organization") {
    requireSuperAdmin(user);
  }

  // Determine inviter hub context if creator is hub_manager/admin
  let inviterHubId: string | null = null;
  if (isHubManager(user) || isAdmin(user)) {
    const { data: rolesRows, error: rolesErr } = await supabase
      .from("user_roles")
      .select("hub_id, role")
      .eq("user_id", user.id);
    if (rolesErr) throw rolesErr;
    const hubContext = (rolesRows || []).find((r: any) =>
      (r.role === "hub_manager" || r.role === "admin") && r.hub_id
    );
    inviterHubId = hubContext?.hub_id || null;
  }

  const code = (Math.random().toString(36).substring(2, 8) + "-" +
    Math.random().toString(36).substring(2, 8)).toUpperCase();
  const expiresAt = body.expires_at ||
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(); // 14 days default

  // Only allow explicit hub_id when creator is super_admin. Otherwise, use inviterHubId (if any).
  const hubToPersist = user.roles.includes("super_admin")
    ? (body.hub_id || null)
    : inviterHubId;

  const insertPayload: any = {
    code,
    invited_email: body.invited_email,
    account_type: body.account_type,
    created_by: user.id,
    expires_at: expiresAt,
  };
  if (hubToPersist) insertPayload.hub_id = hubToPersist;

  const { data, error } = await supabase
    .from("invite_codes")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;

  return successResponse({ ...data, hub_context: inviterHubId }, 201);
}

// GET /user-management/invite/validate?code=...
async function validateInvite(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { code } = validateQuery(url, validateInviteCodeQuerySchema) as any;

  // Public validation via anon client
  const { data, error } =
    await (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    )
      .from("invite_codes")
      .select("*")
      .eq("code", code)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
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
    },
  });
}

// POST /user-management/invite/consume
async function consumeInvite(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  const { code, user_id } = await validateBody(
    req,
    consumeInviteCodeSchema,
  ) as any;

  if (user.id !== user_id && !isAdmin(user)) {
    throw new AuthError("Not allowed to consume invite for another user", 403);
  }

  // Fetch invite
  const { data: invite, error: inviteErr } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .gte("expires_at", new Date().toISOString())
    .single();
  if (inviteErr) throw inviteErr;

  // Determine creator's hub context
  let creatorHubId: string | null = null;
  if (invite) {
    const { data: creatorRoles } = await supabase
      .from("user_roles")
      .select("hub_id, role")
      .eq("user_id", invite.created_by);
    const hubCtx = (creatorRoles || []).find((r: any) =>
      (r.role === "hub_manager" || r.role === "admin") && r.hub_id
    );
    creatorHubId = hubCtx?.hub_id || null;
  }

  // Mark invite as used
  const { error: updateErr } = await supabase
    .from("invite_codes")
    .update({ used_by: user_id, used_at: new Date().toISOString() })
    .eq("code", code);
  if (updateErr) throw updateErr;

  // If the invite is for a business account and there is a hub context, link user to hub as entrepreneur
  let linkedHubId: string | null = null;
  if (invite.account_type === "business" && creatorHubId) {
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id, role: "entrepreneur", hub_id: creatorHubId });
    if (roleErr && roleErr.code !== "23505") { // ignore duplicate role
      throw roleErr;
    }
    linkedHubId = creatorHubId;
  }

  // Attempt to auto-assign Premium subscription using service role
  let assignedPlan = linkedHubId ? "premium" : "free";
  let subscriptionAssigned = false;
  if (linkedHubId) {
    try {
      const serviceClient = getServiceRoleClient();
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data: premiumPlan, error: planErr } = await serviceClient
        .from("subscription_plans")
        .select("id, name, is_active")
        .ilike("name", "premium")
        .eq("is_active", true)
        .maybeSingle();

      if (planErr) {
        if ((planErr as any).code !== "42P01") throw planErr;
      }

      if (premiumPlan?.id) {
        const { data: existingSubs, error: subErr } = await serviceClient
          .from("user_subscriptions")
          .select("id, status, current_period_end")
          .eq("user_id", user_id)
          .eq("status", "active")
          .gt("current_period_end", now.toISOString());

        if (subErr) {
          if ((subErr as any).code !== "42P01") throw subErr;
        }

        if (!existingSubs || existingSubs.length === 0) {
          const { error: assignErr } = await serviceClient
            .from("user_subscriptions")
            .insert({
              user_id,
              plan_id: premiumPlan.id,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            });

          if (assignErr) {
            if ((assignErr as any).code !== "42P01") throw assignErr;
          } else {
            subscriptionAssigned = true;
          }
        } else {
          subscriptionAssigned = true;
        }
      }
    } catch (e) {
      console.error("Premium auto-assignment error:", e);
    }
  }

  return successResponse({
    consumed: true,
    linked_hub_id: linkedHubId,
    assigned_plan: assignedPlan,
    subscription_assigned: subscriptionAssigned,
  });
}

// POST /user-management/invite-signup
// Body: { email, password, full_name, account_type, invite_code }
async function inviteSignupAndConsume(req: Request): Promise<Response> {
  // This endpoint performs an atomic-ish signup: it creates the auth user using the service role
  // admin REST API, then consumes the invite and creates profile/roles using the service client.
  // If any DB step fails, it attempts to delete the created auth user to avoid orphan accounts.

  const body = await validateBody(
    req,
    (await import("../_shared/validation.ts")).signupSchema,
  ) as any;

  // Validate invite code first using anon client
  const { data: invite, error: inviteErr } =
    await (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
      .from("invite_codes")
      .select("*")
      .eq("code", body.invite_code)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

  if (inviteErr) throw inviteErr;
  if (!invite) {
    return errorResponse(
      "INVALID_INVITE",
      "Invite code is invalid or expired",
      400,
    );
  }

  // Create auth user via Admin REST API
  const { env: envModule } = await import("../_shared/env.ts");
  const config = envModule.getConfig();
  const adminCreateUrl = `${config.supabaseUrl}/auth/v1/admin/users`;

  // Determine whether the invite creator is a super_admin or admin so we can decide
  // whether to auto-confirm the created auth user. Do this before creating the auth user
  // to avoid a later PATCH and to remove race conditions. Also cache the creator's
  // roles/hub context so we can reuse it later in this flow (fewer DB calls).
  let creatorIsSuper = false;
  let creatorIsAdmin = false; // includes global or hub-scoped admin roles
  let cachedCreatorRoles: Array<{ role: string; hub_id?: string }> | null = null;
  try {
    const fetched = await fetchUserRoles((invite as any).created_by);
    cachedCreatorRoles = fetched.roles;
    creatorIsSuper = isSuperAdminFromRoles(cachedCreatorRoles);
    creatorIsAdmin = (cachedCreatorRoles || []).some((r: any) => r.role === 'admin');
  } catch (e) {
    console.debug(
      "Failed to determine invite creator roles before auth create, assuming not super_admin/admin",
      e,
    );
    cachedCreatorRoles = null;
  }

  let createdAuthUserId: string | null = null;
  try {
    // Admin create: add a short timeout so this function doesn't hang if the auth
    // endpoint is slow or non-responsive.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(adminCreateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.supabaseServiceRoleKey}`,
        "apikey": config.supabaseServiceRoleKey,
        "x-api-key": config.supabaseServiceRoleKey,
      },
        body: JSON.stringify({
        email: body.email,
        password: body.password,
        // Auto-confirm the email when the invite was created by a super_admin or an admin
        // so the invited user can sign in immediately. For other invite creators, keep email
        // unconfirmed to preserve the verification flow.
        email_confirm: !!(creatorIsSuper || creatorIsAdmin),
        user_metadata: {
          full_name: body.full_name,
          account_type: body.account_type,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const respBody = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Admin user create failed:", resp.status, respBody);
      return errorResponse(
        "AUTH_CREATE_FAILED",
        "Failed to create auth user",
        500,
      );
    }

    createdAuthUserId = respBody?.id || null;
    if (!createdAuthUserId) {
      console.error("Admin user create returned no id:", respBody);
      return errorResponse(
        "AUTH_CREATE_FAILED",
        "Auth user create succeeded but no id returned",
        500,
      );
    }
    // Log admin-create response for debugging and visibility
    try {
      console.debug("Admin user created via admin REST API", {
        id: createdAuthUserId,
        respBody,
      });
    } catch (e) {
      // ignore
    }
    // Best-effort: trigger Supabase to send verification email for this user using admin endpoint.
    // Some Supabase installations support a send_verification admin endpoint. Attempt the call
    // with a short timeout and surface detailed debug logging. Do NOT fail signup if this fails.
    try {
      const denoAny: any = (globalThis as any)["Deno"];
      const allowSend = !!(denoAny && denoAny.env &&
        denoAny.env.get("ALLOW_SEND_VERIFICATION") === "true");
      if (!allowSend) {
        console.debug(
          'send_verification admin endpoint call skipped (ALLOW_SEND_VERIFICATION not set to "true")',
        );
      } else {
        const sendVerifyUrl =
          `${config.supabaseUrl}/auth/v1/admin/users/${createdAuthUserId}/send_verification`;
        // Abort after 3 seconds to avoid blocking the signup flow on slow network
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        let sendResp: Response | null = null;
        try {
          sendResp = await fetch(sendVerifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${config.supabaseServiceRoleKey}`,
              "apikey": config.supabaseServiceRoleKey,
              "x-api-key": config.supabaseServiceRoleKey,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!sendResp) {
          console.debug(
            "send_verification admin endpoint did not return a response (null)",
          );
        } else {
          const sendBody = await sendResp.text().catch(() => "");
          if (!sendResp.ok) {
            // 404/405 likely means endpoint isn't available on this Supabase deployment
            console.debug("send_verification admin endpoint returned non-ok", {
              status: sendResp.status,
              body: sendBody,
            });
          } else {
            console.debug("Triggered send_verification for created user", {
              id: createdAuthUserId,
            });
          }
        }
      }
    } catch (e) {
      // AbortError or network error - keep signup flow happy but log for debugging
      console.debug(
        "send_verification admin endpoint not available, timed out, or failed",
        e,
      );
    }
  } catch (e) {
    console.error("Admin user create error:", e);
    return errorResponse("AUTH_CREATE_ERROR", "Error creating auth user", 500);
  }

  // Use service role client to create profile, roles, consume invite
  const service = getServiceRoleClient();
  try {
    // Begin DB ops
    // We already determined creatorIsSuper before creating the auth user and set
    // email_confirm accordingly in the create call to avoid extra admin PATCHes.

    // Mark invite as used and set used_by
    const { error: markErr } = await service
      .from("invite_codes")
      .update({ used_at: new Date().toISOString(), used_by: createdAuthUserId })
      .eq("code", body.invite_code);
    if (markErr) throw markErr;

    // The DB trigger `public.handle_new_user()` creates a profile and an initial
    // role automatically when the auth user is created via Admin REST API. To avoid
    // duplicates and races, do not INSERT profiles unconditionally here.
    // - If the invite creator is a super_admin: the trigger already created the
    //   profile and default role; we skip profile INSERT entirely.
    // - If the invite creator is an admin (hub-scoped), update the profile to
    //   set hub-related fields (idempotent UPDATE). This avoids duplicate-insert
    //   errors while allowing us to set hub linkage.
    // If the invite creator is a super_admin we skip profile updates (DB trigger handled it).
    // If the creator is an admin (but not super_admin), attempt to update the profile to set
    // hub-related fields based on the creator's admin hub context. We intentionally do not
    // treat hub_manager roles here — only admin role should trigger hub linkage updates.
    if (creatorIsSuper) {
      // Skip profile update; trigger already created it.
    } else if (creatorIsAdmin) {
      try {
        const adminHubCtx = (cachedCreatorRoles || []).find((r: any) => r.role === 'admin' && r.hub_id);
        const profileUpdate: Record<string, unknown> = {
          email: body.email,
          full_name: body.full_name,
          account_type: body.account_type,
        };
        if (adminHubCtx?.hub_id) {
          (profileUpdate as any).hub_id = adminHubCtx.hub_id;
        }

        const { error: profileErr } = await service
          .from("profiles")
          .update(profileUpdate)
          .eq("id", createdAuthUserId);

        if (profileErr) {
          throw profileErr;
        }
      } catch (e) {
        throw e;
      }
    } else {
      // Neither super nor admin: leave profile as created by trigger and don't modify hub linkage.
    }

    // If the invite has hub context and it's a business invite, the DB trigger
    // already creates the 'entrepreneur' role for the new user. Do NOT insert
    // the role directly. If we need to adjust the role (replace/augment) use RPCs.
    if ((invite as any)?.account_type === "business") {
      // Optionally ensure profile.hub_id was set earlier (admin path updated it).
      // No direct role INSERTs here to respect database protections.
    }

    // If the invite is for an organization and the invite creator was a super_admin,
    // auto-assign a global 'admin' role to the new user. This mirrors the behavior in
    // the invite-codes consume flow so org invites created by super_admin produce admin users.
    if ((invite as any)?.account_type === "organization") {
      try {
        // Attempt to call the atomic role-replace RPC `set_user_role` which should
        // be created in the database. Provide hub_id when applicable (admin hub context),
        // otherwise null for a global admin assignment. If the RPC is missing or fails,
        // fall back to the existing `service_add_user_role` RPC behavior.
        let rpcErr: any = null;
        try {
          const adminHubCtx = (cachedCreatorRoles || []).find((r: any) => r.role === 'admin' && r.hub_id);
          const hubArg = adminHubCtx?.hub_id || null;
          const { data: setResp, error: setErr } = await service.rpc(
            "set_user_role",
            {
              target_user_id: createdAuthUserId,
              role: "admin",
              hub_id: hubArg,
              requester_user_id: (invite as any).created_by,
            },
          );
          rpcErr = setErr;
          if (!setErr) {
            console.debug("set_user_role RPC succeeded", { user: createdAuthUserId, hub: hubArg });
          }
        } catch (err) {
          rpcErr = err;
          console.debug("set_user_role RPC not available or failed, will fallback", err);
        }

        if (rpcErr) {
          try {
            const { data: rpcData, error: rpcErr2 } = await service.rpc(
              "service_add_user_role",
              {
                target_user_id: createdAuthUserId,
                new_role: "admin",
                requester_user_id: (invite as any).created_by,
                requester_ip: null,
                requester_user_agent: null,
              },
            );

            if (rpcErr2) {
              if ((rpcErr2 as any).code !== "23505") {
                console.error("service_add_user_role RPC failed:", rpcErr2);
                throw rpcErr2;
              } else {
                console.debug("service_add_user_role: role already exists (ignored)");
              }
            }
          } catch (e) {
            console.error("Error auto-assigning admin role for org invite (fallback):", e);
          }
        }
      } catch (e) {
        console.error("Error auto-assigning admin role for org invite:", e);
      }
    }

    // If invite was created by super_admin, and we've auto-confirmed the user, create a session
    // and return it so the frontend can sign in and show a welcome toast.
    if (creatorIsSuper) {
      try {
        const tokenUrl = `${config.supabaseUrl}/auth/v1/token?grant_type=password`;
        const tokenPayload = {
          email: body.email,
          password: body.password,
          gotrue_meta_security: {},
        };

        const tokenResp = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": config.supabaseAnonKey,
          },
          body: JSON.stringify(tokenPayload),
        });

        let tokenBody: any = null;
        try {
          tokenBody = await tokenResp.json().catch(async () => {
            // fallback to text if body isn't JSON
            try {
              return await tokenResp.text();
            } catch {
              return null;
            }
          });
        } catch (e) {
          tokenBody = null;
        }

        if (tokenResp.ok && tokenBody) {
          console.debug("Token exchange succeeded for created user", {
            user: createdAuthUserId,
            invite_code: (invite as any).code,
            creator: (invite as any).created_by,
          });
          return successResponse({
            userId: createdAuthUserId,
            created: true,
            token_exchanged: true,
            session: tokenBody,
            message: `Welcome ${body.full_name || ""}`,
          });
        } else {
          // Log failure and return created:true so frontend can show 'confirm your email / sign in' toast
          console.error("Failed to obtain session for created user after auto-confirm", {
            status: tokenResp?.status,
            body: tokenBody,
            user: createdAuthUserId,
            invite_code: (invite as any).code,
            creator: (invite as any).created_by,
            creatorIsSuper,
          });
          return successResponse({
            userId: createdAuthUserId,
            created: true,
            token_exchanged: false,
            message: 'Account created; sign in to continue',
          });
        }
      } catch (e) {
        console.error("Error obtaining session for user after signup:", e);
      }
    }

    // Fallback: if we did not detect creatorIsSuper earlier (maybe role fetch failed),
    // attempt one more time using the service client. If the creator *is* super_admin,
    // try to set email_confirm via admin PATCH and obtain a session. This attempts to
    // correct the case where the pre-create role check failed but the creator is actually super_admin.
    if (!creatorIsSuper) {
      try {
        const { data: recheckRoles } = await service
          .from('user_roles')
          .select('role')
          .eq('user_id', (invite as any).created_by);
        const recheckIsSuper = (recheckRoles || []).some((r: any) => r.role === 'super_admin');
        if (recheckIsSuper && createdAuthUserId) {
          // Attempt to mark user confirmed via admin PATCH (best-effort)
          try {
            const patchUrl = `${config.supabaseUrl}/auth/v1/admin/users/${createdAuthUserId}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            await fetch(patchUrl, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.supabaseServiceRoleKey}`,
                'apikey': config.supabaseServiceRoleKey,
                'x-api-key': config.supabaseServiceRoleKey,
              },
              body: JSON.stringify({ email_confirm: true }),
              signal: controller.signal,
            }).finally(() => clearTimeout(timeout));
          } catch (e) {
            console.debug('Admin PATCH to set email_confirm failed (fallback)', e);
          }

          // Try to get a session
          try {
            const tokenUrl = `${config.supabaseUrl}/auth/v1/token?grant_type=password`;
            const tokenPayload = {
              email: body.email,
              password: body.password,
              gotrue_meta_security: {},
            };

            const tokenResp = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': config.supabaseAnonKey },
              body: JSON.stringify(tokenPayload),
            });

            let tokenBody: any = null;
            try {
              tokenBody = await tokenResp.json().catch(async () => {
                try {
                  return await tokenResp.text();
                } catch {
                  return null;
                }
              });
            } catch (e) {
              tokenBody = null;
            }
            if (tokenResp.ok && tokenBody) {
              console.debug('Fallback token exchange succeeded', { user: createdAuthUserId, invite_code: (invite as any).code });
              return successResponse({ userId: createdAuthUserId, created: true, token_exchanged: true, session: tokenBody, message: `Welcome ${body.full_name || ''}` });
            } else {
              console.error('Fallback: failed to obtain session for created user after admin PATCH', { status: tokenResp?.status, body: tokenBody, user: createdAuthUserId, invite_code: (invite as any).code });
              return successResponse({ userId: createdAuthUserId, created: true, token_exchanged: false, message: 'Account created; sign in to continue' });
            }
          } catch (e) {
            console.error('Fallback: Error obtaining session after recheck:', e);
          }
        }
      } catch (e) {
        // ignore fallback errors - main flow already returned above if it succeeded
        console.debug('Fallback re-check for creatorIsSuper failed', e);
      }
    }

    // We intentionally do NOT send a custom confirmation email here. By creating the
    // user with `email_confirm: false`, Supabase will send the canonical verification
    // email containing the correct `/auth/v1/verify?token=...&type=signup&redirect_to=...`
    // link. Sending our own link risks using the wrong domain or missing the token.

    return successResponse({ userId: createdAuthUserId, created: true });
  } catch (dbErr) {
    console.error(
      "DB ops after auth create failed, attempting rollback:",
      dbErr,
    );
    // Only attempt to delete the created auth user when createdAuthUserId is present
    // and the error is not a duplicate-profile (we already handled duplicates above).
    try {
      if (createdAuthUserId) {
        const deleteUrl =
          `${config.supabaseUrl}/auth/v1/admin/users/${createdAuthUserId}`;
        await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.supabaseServiceRoleKey}`,
            "apikey": config.supabaseServiceRoleKey,
            "x-api-key": config.supabaseServiceRoleKey,
          },
        });
      }
    } catch (delErr) {
      console.error("Failed to rollback auth user after DB failure:", delErr);
    }

    return handleError(dbErr);
  }
}

/**
 * Update current user's profile
 * PATCH /user-management/me
 */
async function updateUserProfile(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  const updates = await validateBody(req, updateProfileSchema) as z.infer<
    typeof updateProfileSchema
  >;

  // Sanitize string inputs
  const sanitizedUpdates = {
    ...updates,
    ...(updates.full_name && { full_name: sanitizeString(updates.full_name) }),
    ...(updates.organization_name &&
      { organization_name: sanitizeString(updates.organization_name) }),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(sanitizedUpdates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return successResponse(data);
}

/**
 * Get users list (admin only)
 * GET /user-management
 */
async function getUsers(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireAdmin(user);

  const url = new URL(req.url);
  const query = validateQuery(url, getUsersQuerySchema) as z.infer<
    typeof getUsersQuerySchema
  >;
  const { page, limit, search, role, accountType, hubId } = query;

  const offset = (page - 1) * limit;

  // Build query for profiles only
  let dbQuery = supabase
    .from("profiles")
    .select(`
      id, 
      email, 
      full_name, 
      account_type, 
      country, 
      organization_name, 
      created_at
    `);

  // Hub scoping behavior:
  // - If hubId query param provided: enforce RBAC for that hub (existing behavior)
  // - If hubId NOT provided and requester is NOT super_admin: default to scoping to the hubs the requester manages
  //   * If requester manages no hubs, return an empty paginated response (safer than exposing global list)
  if (hubId) {
    // If not super_admin, ensure requester has a role tied to the hub
    const isSuper = user.roles.includes("super_admin");
    if (!isSuper) {
      // Check requester user_roles for the target hub
      const { data: requesterRoles, error: requesterRolesErr } = await supabase
        .from("user_roles")
        .select("role, hub_id")
        .eq("user_id", user.id)
        .eq("hub_id", hubId);
      if (requesterRolesErr) throw requesterRolesErr;
      const allowed = (requesterRoles || []).some((r: any) =>
        ["admin", "hub_manager"].includes(r.role)
      );
      if (!allowed) {
        throw new AuthError("Not authorized to view users for this hub", 403);
      }
    }

    // Restrict profiles to users who have roles in this hub
    dbQuery = supabase
      .from("profiles")
      .select(`
        id, 
        email, 
        full_name, 
        account_type, 
        country, 
        organization_name, 
        created_at
      `)
      .in(
        "id",
        supabase.from("user_roles").select("user_id").eq("hub_id", hubId),
      ) as any;
  } else {
    // No hubId provided. If requester is super_admin, allow global listing (no change).
    const isSuper = user.roles.includes("super_admin");
    if (!isSuper) {
      // Determine hubs the requester administers
      const { data: myHubRoles, error: myHubRolesErr } = await supabase
        .from("user_roles")
        .select("hub_id, role")
        .eq("user_id", user.id);
      if (myHubRolesErr) throw myHubRolesErr;

      const adminHubIds = (myHubRoles || [])
        .filter((r: any) =>
          ["admin", "hub_manager"].includes(r.role) && r.hub_id
        )
        .map((r: any) => r.hub_id)
        .filter(Boolean);

      if (adminHubIds.length === 0) {
        // Return empty paginated response
        return paginatedResponse([], { page, limit, total: 0 });
      }

      // Restrict to users who have roles in any of the adminHubIds
      dbQuery = supabase
        .from("profiles")
        .select(`
          id, 
          email, 
          full_name, 
          account_type, 
          country, 
          organization_name, 
          created_at
        `)
        .in(
          "id",
          supabase.from("user_roles").select("user_id").in(
            "hub_id",
            adminHubIds,
          ),
        ) as any;
    }
    // else super admin -> leave dbQuery as global profiles select
  }

  // Apply filters
  if (search) {
    const searchTerm = `%${search.toLowerCase()}%`;
    dbQuery = dbQuery.or(
      `email.ilike.${searchTerm},full_name.ilike.${searchTerm}`,
    );
  }

  if (accountType) {
    dbQuery = dbQuery.eq("account_type", accountType);
  }

  // Get total count
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  // Get paginated data
  const { data: profiles, error } = await dbQuery
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // Fetch all user_roles for the returned profiles
  const userIds = profiles?.map((profile: any) => profile.id) || [];
  let rolesMap: Record<string, string[]> = {};
  if (userIds.length > 0) {
    let rolesQuery = supabase
      .from("user_roles")
      .select("user_id, role");
    if (role) {
      rolesQuery = rolesQuery.eq("role", role);
    }
    const { data: rolesData, error: rolesError } = await rolesQuery.in(
      "user_id",
      userIds,
    );
    if (rolesError) {
      throw rolesError;
    }
    // Build a map of user_id to roles
    for (const r of rolesData || []) {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    }
  }

  // Transform data to match frontend expectations
  const users = profiles?.map((profile: any) => ({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    account_type: profile.account_type,
    country: profile.country,
    organization_name: profile.organization_name,
    created_at: profile.created_at,
    roles: rolesMap[profile.id] || [],
  })) || [];

  return paginatedResponse(users, {
    page,
    limit,
    total: count || 0,
  });
}

/**
 * Update user role (admin only)
 * POST /user-management/roles
 */
async function updateUserRole(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireAdmin(user);

  const { userId, role, action, hub_id } = await validateBody(
    req,
    updateUserRoleSchema,
  ) as z.infer<typeof updateUserRoleSchema>;

  // Super admin role changes require super admin privileges
  if (role === "super_admin") {
    requireSuperAdmin(user);
  }

  // If hub-scoped role change, enforce that requester is allowed to modify roles for that hub
  if (hub_id && (role === "hub_manager" || role === "entrepreneur")) {
    const isSuper = user.roles.includes("super_admin");
    if (!isSuper) {
      // Check that requester has admin/hub_manager role for the target hub
      const { data: requesterHubRoles, error: reqHubErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("hub_id", hub_id);
      if (reqHubErr) throw reqHubErr;
      const allowed = (requesterHubRoles || []).some((r: any) =>
        ["admin", "hub_manager"].includes(r.role)
      );
      if (!allowed) {
        throw new AuthError("Not authorized to assign roles for this hub", 403);
      }
    }
  }

  // Use the secure RPC functions from the database
  const rpcFunction = action === "add"
    ? "add_user_role_with_audit"
    : "remove_user_role_with_audit";
  // Include optional hub_id for hub-scoped roles
  const rpcParams: Record<string, unknown> = action === "add"
    ? {
      target_user_id: userId,
      new_role: role,
      requester_ip: null,
      requester_user_agent: req.headers.get("user-agent"),
    }
    : {
      target_user_id: userId,
      old_role: role,
      requester_ip: null,
      requester_user_agent: req.headers.get("user-agent"),
    };

  if (hub_id && (role === "hub_manager" || role === "entrepreneur")) {
    rpcParams["hub_id"] = hub_id;
  }

  const { data, error } = await supabase.rpc(rpcFunction, rpcParams);

  if (error) {
    throw error;
  }

  if (!data) {
    return errorResponse(
      "ROLE_UNCHANGED",
      action === "add"
        ? "User already has this role"
        : "User does not have this role",
      200,
    );
  }

  return successResponse({
    userId,
    role,
    action,
    message: `User role ${action === "add" ? "added" : "removed"} successfully`,
  });
}

/**
 * Admin update user (super admin only)
 * PATCH /user-management?userId=uuid
 */
async function adminUpdateUser(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireSuperAdmin(user);

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return errorResponse("MISSING_USER_ID", "User ID is required", 400);
  }

  const updates = await validateBody(req, updateProfileSchema) as z.infer<
    typeof updateProfileSchema
  >;

  // Sanitize string inputs
  const sanitizedUpdates = {
    ...updates,
    ...(updates.full_name && { full_name: sanitizeString(updates.full_name) }),
    ...(updates.organization_name &&
      { organization_name: sanitizeString(updates.organization_name) }),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(sanitizedUpdates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return successResponse(data);
}

/**
 * Deactivate user (super admin only)
 * DELETE /user-management?userId=uuid
 */
async function deactivateUser(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireSuperAdmin(user);

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const hard = url.searchParams.get("hard") === "true";

  if (!userId) {
    return errorResponse("MISSING_USER_ID", "User ID is required", 400);
  }

  // Remove all roles first
  const { error: rolesError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (rolesError) {
    throw rolesError;
  }

  // Mark account as deactivated
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ account_type: "deactivated" })
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  if (hard) {
    // Perform permanent deletion using service role client
    try {
      const service = getServiceRoleClient();

      // First, attempt to delete the auth user using the Admin REST API as a reliable fallback.
      // This uses the service role key and the project's Supabase URL.
      try {
        const { env: envModule } = await import("../_shared/env.ts");
        const config = envModule.getConfig();
        const adminUrl = `${config.supabaseUrl}/auth/v1/admin/users/${userId}`;

        // Retry loop: 3 attempts with exponential backoff (100ms, 300ms, 900ms)
        const maxAttempts = 3;
        let attempt = 0;
        let lastErr: any = null;

        while (attempt < maxAttempts) {
          attempt += 1;
          try {
            const resp = await fetch(adminUrl, {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                // Provide both Authorization and apikey headers - some edge routes expect apikey
                "Authorization": `Bearer ${config.supabaseServiceRoleKey}`,
                "apikey": config.supabaseServiceRoleKey,
                "x-api-key": config.supabaseServiceRoleKey,
              },
            });

            // Read response body for logs (always capture) before checking status
            const body = await resp.text();
            if (resp.ok) {
              // success
              lastErr = null;
              break;
            }

            // Non-ok response, capture body for logging
            lastErr = {
              status: resp.status,
              statusText: resp.statusText,
              body,
            };
            console.error(
              `Admin REST delete attempt ${attempt} failed:`,
              lastErr,
            );
          } catch (e) {
            lastErr = e;
            console.error(`Admin REST delete attempt ${attempt} error:`, e);
          }

          // Backoff before next attempt
          if (attempt < maxAttempts) {
            const backoffMs = 100 * Math.pow(3, attempt - 1); // 100, 300, 900
            await new Promise((res) => setTimeout(res, backoffMs));
          }
        }

        if (lastErr) {
          console.error(
            "Admin REST delete final error after retries:",
            lastErr,
          );
          // Return structured error including a short hint for debugging (don't leak secrets)
          return errorResponse(
            "AUTH_DELETE_FAILED",
            `Failed to delete auth user after ${maxAttempts} attempts`,
            500,
          );
        }
      } catch (e) {
        console.error("Admin REST delete error:", e);
        return errorResponse(
          "AUTH_DELETE_ERROR",
          "Error deleting auth user via admin REST API",
          500,
        );
      }

      // If we reach here, auth user was deleted successfully. Now delete related DB rows.
      await service.from("user_roles").delete().eq("user_id", userId);
      await service.from("profiles").delete().eq("id", userId);
      // Try remove user subscriptions if table exists
      try {
        await service.from("user_subscriptions").delete().eq("user_id", userId);
      } catch (_) {
        // ignore if table missing
      }

      return successResponse({ userId, deleted: true });
    } catch (e: any) {
      return handleError(e);
    }
  }

  return successResponse({
    userId,
    message: "User deactivated successfully",
  });
}

serve(handler);
