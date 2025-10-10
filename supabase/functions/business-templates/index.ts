import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getUserFromRequest, requireSuperAdmin } from "../_shared/auth.ts";
import {
  errorResponse,
  handleCors,
  handleError,
  successResponse,
} from "../_shared/responses.ts";

// Local schemas (kept here to minimize shared changes)
const uuidSchema = z.string().uuid("Invalid UUID");

const templateCreateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  template_config: z.record(z.unknown()),
  is_active: z.boolean().default(true),
  version: z.number().int().min(1).default(1),
});

const templateUpdateSchema = templateCreateSchema.partial();

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCors();
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // parts example: ['business-templates']
    const resource = parts[1] || "";

    if (req.method === "GET" && resource === "health") {
      return successResponse({ status: "ok", service: "business-templates" });
    }

    // Public list of active templates
    if (req.method === "GET" && parts[1] === undefined) {
      return await listTemplates(req);
    }

    if (parts[1] === "templates" || parts[0] === "business-templates") {
      // Normalize to root resource behavior
      if (req.method === "POST") return await createTemplate(req);
      if (req.method === "PATCH") return await updateTemplate(req);
      if (req.method === "DELETE") return await deleteTemplate(req);
    }

    // Support explicit routes like /business-templates/templates
    if (req.method === "GET" && resource === "templates") {
      return await listTemplates();
    }

    return errorResponse("NOT_FOUND", "Endpoint not found", 404);
  } catch (error) {
    return handleError(error);
  }
};

// GET /business-templates or /business-templates/templates
async function listTemplates(req?: Request): Promise<Response> {
  // Publicly list active templates (optionally filter by subscription tier)
  const client = (await import("https://esm.sh/@supabase/supabase-js@2"))
    .createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

  let tier: string | null = null;
  if (req) {
    try {
      const url = new URL(req.url);
      tier = (url.searchParams.get("tier") || "").toLowerCase() || null;
      if (tier && !["free", "pro", "premium"].includes(tier)) {
        tier = null; // ignore unsupported values during dev
      }
    } catch (_) {
      tier = null;
    }
  }

  let ids: string[] | null = null;
  if (tier) {
    const { data: perms, error: perr } = await client
      .from("template_permissions")
      .select("template_id")
      .eq("subscription_tier", tier)
      .eq("is_active", true);
    if (!perr && perms) {
      ids = perms.map((p: any) => p.template_id).filter(Boolean);
    }
  }

  let query = client
    .from("business_templates")
    .select("*")
    .eq("is_active", true);

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return errorResponse("TEMPLATES_DB_ERROR", error.message, 400);
  }

  return successResponse(data || []);
}

// POST /business-templates (super_admin only)
async function createTemplate(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireSuperAdmin(user);

  const payload = templateCreateSchema.parse(await req.json());

  const { data, error } = await supabase
    .from("business_templates")
    .insert({
      name: payload.name,
      description: payload.description ?? null,
      category: payload.category ?? null,
      template_config: payload.template_config,
      is_active: payload.is_active,
      version: payload.version,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return errorResponse("TEMPLATES_DB_ERROR", error.message, 400);
  }

  return successResponse(data, 201);
}

// PATCH /business-templates?id=UUID (super_admin only)
async function updateTemplate(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireSuperAdmin(user);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("MISSING_ID", "Template id is required", 400);
  try {
    uuidSchema.parse(id);
  } catch {
    return errorResponse("INVALID_ID", "Invalid template id", 400);
  }

  const payload = templateUpdateSchema.parse(await req.json());

  const { data, error } = await supabase
    .from("business_templates")
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return errorResponse("TEMPLATES_DB_ERROR", error.message, 400);
  }

  return successResponse(data);
}

// DELETE /business-templates?id=UUID (soft delete: set is_active=false)
async function deleteTemplate(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireSuperAdmin(user);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const force = url.searchParams.get("force") === "true";
  if (!id) return errorResponse("MISSING_ID", "Template id is required", 400);
  try {
    uuidSchema.parse(id);
  } catch {
    return errorResponse("INVALID_ID", "Invalid template id", 400);
  }

  if (force) {
    // Permanent deletion using service role to bypass RLS and ensure full removal
    const service = getServiceRoleClient();
    // Remove any template_permissions referencing this template first
    try {
      const { error: permErr } = await service
        .from("template_permissions")
        .delete()
        .eq("template_id", id);
      if (permErr && (permErr as any).code !== "42P01") {
        return errorResponse("TEMPLATES_DB_ERROR", permErr.message, 400);
      }

      const { data, error } = await service
        .from("business_templates")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

      if (error) {
        return errorResponse("TEMPLATES_DB_ERROR", error.message, 400);
      }

      return successResponse({ id: data?.id, deleted: true });
    } catch (e: any) {
      return handleError(e);
    }
  }

  const { data, error } = await supabase
    .from("business_templates")
    .update({ is_active: false })
    .eq("id", id)
    .select("id, is_active")
    .single();

  if (error) {
    return errorResponse("TEMPLATES_DB_ERROR", error.message, 400);
  }

  return successResponse({ id: data?.id, is_active: data?.is_active });
}

serve(handler);
