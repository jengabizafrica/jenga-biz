// deno-lint-ignore-file no-explicit-any no-import-prefix
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";
import { getUserFromRequest, requireAdmin, getServiceRoleClient } from "../_shared/auth.ts";
import { env as envModule } from "../_shared/env.ts";
import { validateBody } from "../_shared/validation.ts";

// Payload schema for hub creation
const hubSchema = z.object({
  name: z.string().min(2),
  country: z.string().min(2),
  region: z.string().optional(),
  contact_email: z.string().email(),
  slug: z.string().optional(),
});

// Simple success/error helpers
function successResponse(data: any, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleCreateHub(req: Request) {
  try {
    const { user, supabase: userClient } = await getUserFromRequest(req);
    requireAdmin(user);

    const body = await validateBody(req, hubSchema) as any;
    console.debug('hub-management: incoming payload', { user_id: user.id, payload: body });

    // Generate a slug if not provided
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Use the service role client for DB writes
    const service = getServiceRoleClient();

    // Begin a transaction-like sequence. Supabase JS doesn't expose explicit BEGIN/COMMIT for RPC
    // so perform sequential calls; rely on DB RPCs for atomic operations when available.

    // 1) Create hub row
    const hubPayload: any = {
      name: body.name,
      country: body.country,
      region: body.region || null,
      contact_email: body.contact_email,
      slug,
    };

    const { data: hubData, error: hubErr } = await service
      .from('hubs')
      .insert(hubPayload)
      .select()
      .single();

    if (hubErr) {
      // handle unique violation on slug gracefully
      if ((hubErr as any).code === '23505') {
        return errorResponse('HUB_EXISTS', 'A hub with that slug or name already exists', 409);
      }
      console.error('Failed to create hub:', hubErr);
      return errorResponse('HUB_CREATE_FAILED', 'Failed to create hub', 500);
    }

    const hubId = hubData.id;
  console.debug('hub-management: created hub', { hubId, hubData });

    // 2) Update profile of requester to set organization_name and hub_id
    const profileUpdate: any = {
      organization_name: body.name,
      hub_id: hubId,
    };

    const { error: profileErr } = await service
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id);

    if (profileErr) {
      console.error('Failed to update profile with hub_id:', profileErr);
      // Attempt to cleanup created hub
      try {
        await service.from('hubs').delete().eq('id', hubId);
      } catch (_) {}
      return errorResponse('PROFILE_UPDATE_FAILED', 'Failed to link profile to hub', 500);
    }
  console.debug('hub-management: profile updated for user', { userId: user.id, hubId });

    // 3) Update requester user_roles rows to set hub_id where role indicates admin/hub_manager
    try {
      // Try to use a secure RPC to update roles if available (preferred). Otherwise perform an update.
      // We expect a RPC `service_update_user_roles_hub` possibly present; if not, fallback.
      let rpcAvailable = true;
      try {
        const { data: rpcResp, error: rpcErr } = await service.rpc('service_update_user_roles_hub', { requester_user_id: user.id, hub_id: hubId });
        if (rpcErr) {
          rpcAvailable = false;
          console.debug('service_update_user_roles_hub RPC not available or failed, will fallback', rpcErr);
        }
      } catch (e) {
        rpcAvailable = false;
      }

      if (!rpcAvailable) {
        // fallback: update user_roles rows for this user where role in ('admin','hub_manager') and hub_id is null
        const { error: urErr } = await service
          .from('user_roles')
          .update({ hub_id: hubId })
          .in('role', ['admin', 'hub_manager'])
          .eq('user_id', user.id)
          .is('hub_id', null);
        if (urErr) {
          console.error('Failed to update user_roles hub_id fallback:', urErr);
          // non-fatal: continue but log
        }
        else {
          console.debug('hub-management: user_roles updated (fallback) for user', { userId: user.id, hubId });
        }
      }
    } catch (e) {
      console.error('Error updating user_roles hub_id:', e);
    }

    // 4) Update hubs.admin_user_id for convenience
    try {
      const { error: hubAdminErr } = await service
        .from('hubs')
        .update({ admin_user_id: user.id })
        .eq('id', hubId);
      if (hubAdminErr) {
        console.error('Failed to set hubs.admin_user_id:', hubAdminErr);
      }
      else {
        console.debug('hub-management: hubs.admin_user_id set', { hubId, admin: user.id });
      }
    } catch (e) {
      console.error('Error setting hubs.admin_user_id:', e);
    }

    // 5) Insert default app_settings / metadata rows if table exists
    try {
      const { error: settingsErr } = await service
        .from('hub_settings')
        .insert({ hub_id: hubId, key: 'default_plan', value: 'free' as any })
        .select();
      if (settingsErr) {
        // ignore errors if table doesn't exist
        if ((settingsErr as any).code !== '42P01') {
          console.error('Failed to insert default hub settings:', settingsErr);
        }
      }
      else {
        console.debug('hub-management: inserted default hub settings', { hubId });
      }
    } catch (e) {
      console.debug('Skipping hub_settings insert (table may not exist):', e);
    }

    return successResponse({ hub: hubData });
  } catch (e) {
    console.error('Unhandled error in create hub:', e);
    return errorResponse('UNEXPECTED_ERROR', 'Unexpected error creating hub', 500);
  }
}

const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname.endsWith('/create')) {
      console.debug('hub-management: routing to create', { url: req.url });
      return await handleCreateHub(req);
    }

    return new Response('Not Found', { status: 404 });
  } catch (e) {
    console.error('hub-management error:', e);
    return new Response('Internal Server Error', { status: 500 });
  }
};

serve(handler);
