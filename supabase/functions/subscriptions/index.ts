import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  getServiceRoleClient,
  getUserFromRequest,
  requireAdmin,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  errorResponse,
  handleCors,
  handleError,
  successResponse,
} from "../_shared/responses.ts";
import {
  assignSubscriptionSchema,
  paystackInitiateSchema,
  subscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  uuidSchema,
  validateBody,
  validateQuery,
} from "../_shared/validation.ts";
import { env } from "../_shared/env.ts";

/**
 * Subscriptions Edge Function
 * Provides REST API for subscription plans and user subscriptions
 * Note: Requires DB tables `subscription_plans` and `user_subscriptions`.
 * If tables are missing, endpoints will return informative errors.
 */

// Helpers
function notImplemented(feature: string): Response {
  return errorResponse(
    "NOT_IMPLEMENTED",
    `${feature} is not implemented yet`,
    501,
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCors();
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // pathParts example: ['subscriptions', 'plans']
    const resource = pathParts[1] || "";

    if (req.method === "GET" && resource === "health") {
      return successResponse({ status: "ok", service: "subscriptions" });
    }

    if (resource === "plans") {
      if (req.method === "GET") return await listPlans(req);
      if (req.method === "POST") return await createPlan(req);
      if (req.method === "PATCH") return await updatePlan(req);
      if (req.method === "DELETE") return await deletePlan(req);
    }

    if (resource === "assign") {
      if (req.method === "POST") return await assignPlan(req);
    }

    if (resource === "me") {
      if (req.method === "GET") return await getMySubscription(req);
    }

    if (resource === "paystack") {
      if (req.method === "POST") {
        const subpath = pathParts[2] || "";
        if (subpath === "initiate") return await initiatePaystack(req);
        if (subpath === "webhook") return await paystackWebhook(req);
      }
    }

    return errorResponse("NOT_FOUND", "Endpoint not found", 404);
  } catch (error) {
    return handleError(error);
  }
};

// GET /subscriptions/plans
async function listPlans(req: Request): Promise<Response> {
  // Publicly list active plans
  const client = (await import("https://esm.sh/@supabase/supabase-js@2"))
    .createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

  const { data, error } = await client
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    // If table missing or other error, inform caller cleanly
    return errorResponse("SUBSCRIPTION_DB_ERROR", error.message, 400);
  }

  return successResponse(data || []);
}

// POST /subscriptions/plans
async function createPlan(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  // Keep plan management super admin only for now
  requireSuperAdmin(user);

  const payload = await validateBody(req, subscriptionPlanSchema) as z.infer<
    typeof subscriptionPlanSchema
  >;

  const { data, error } = await supabase
    .from("subscription_plans")
    .insert({
      name: payload.name,
      description: payload.description ?? null,
      price: payload.price,
      currency: payload.currency,
      billing_cycle: payload.billing_cycle,
      features: payload.features,
      is_active: payload.is_active,
    })
    .select("*")
    .single();

  if (error) {
    return errorResponse("SUBSCRIPTION_DB_ERROR", error.message, 400);
  }

  return successResponse(data, 201);
}

// PATCH /subscriptions/plans?id=UUID
async function updatePlan(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireSuperAdmin(user);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("MISSING_ID", "Plan id is required", 400);
  try {
    uuidSchema.parse(id);
  } catch {
    return errorResponse("INVALID_ID", "Invalid plan id", 400);
  }

  const payload = await validateBody(
    req,
    updateSubscriptionPlanSchema,
  ) as z.infer<typeof updateSubscriptionPlanSchema>;

  const { data, error } = await supabase
    .from("subscription_plans")
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return errorResponse("SUBSCRIPTION_DB_ERROR", error.message, 400);
  }

  return successResponse(data);
}

// DELETE /subscriptions/plans?id=UUID (soft delete: set is_active=false)
async function deletePlan(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  requireSuperAdmin(user);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("MISSING_ID", "Plan id is required", 400);
  try {
    uuidSchema.parse(id);
  } catch {
    return errorResponse("INVALID_ID", "Invalid plan id", 400);
  }

  const { data, error } = await supabase
    .from("subscription_plans")
    .update({ is_active: false })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return errorResponse("SUBSCRIPTION_DB_ERROR", error.message, 400);
  }

  return successResponse({ id: data?.id, is_active: data?.is_active });
}

// POST /subscriptions/assign
async function assignPlan(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  // Admin or super admin required to assign
  requireAdmin(user);

  const { user_id, plan_id } = await validateBody(
    req,
    assignSubscriptionSchema,
  ) as z.infer<typeof assignSubscriptionSchema>;

  // Upsert a user_subscriptions record (simple model)
  const { data, error } = await supabase
    .from("user_subscriptions")
    .insert({
      user_id,
      plan_id,
      status: "active",
      current_period_start: new Date().toISOString(),
      // naive monthly period end; real billing will update via webhook
      current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
        .toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return errorResponse("SUBSCRIPTION_DB_ERROR", error.message, 400);
  }

  return successResponse(data, 201);
}

// GET /subscriptions/me
async function getMySubscription(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);

  const { data, error } = await supabase
    .from("user_subscriptions")
    .select(`*, plan:subscription_plans(*)`)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .maybeSingle();

  if (error) {
    return errorResponse("SUBSCRIPTION_DB_ERROR", error.message, 400);
  }

  return successResponse(data);
}

serve(handler);

// Helper to compute HMAC SHA512 hex
async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = Array.from(new Uint8Array(sig));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /subscriptions/paystack/initiate
async function initiatePaystack(req: Request): Promise<Response> {
  const cfg = env.getConfig();
  if (!cfg.paystack?.secretKey) {
    return errorResponse(
      "PAYSTACK_NOT_CONFIGURED",
      "Paystack is not configured on the server",
      500,
    );
  }

  const { user } = await getUserFromRequest(req);
  const { plan_id, callback_url } = await validateBody(
    req,
    paystackInitiateSchema,
  ) as z.infer<typeof paystackInitiateSchema>;

  // Fetch plan (public client ok)
  const client = (await import("https://esm.sh/@supabase/supabase-js@2"))
    .createClient(
      cfg.supabaseUrl,
      cfg.supabaseAnonKey,
    );

  const { data: plan, error: planErr } = await client
    .from("subscription_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("is_active", true)
    .maybeSingle();

  if (planErr) {
    return errorResponse("SUBSCRIPTION_DB_ERROR", planErr.message, 400);
  }
  if (!plan) {
    return errorResponse(
      "PLAN_NOT_FOUND",
      "Subscription plan not found or inactive",
      404,
    );
  }

  const amountMinor = Math.round(Number(plan.price) * 100);
  const currency = plan.currency || "KES";

  const initBody = {
    email: user.email,
    amount: amountMinor,
    currency,
    callback_url: callback_url,
    metadata: {
      user_id: user.id,
      plan_id,
      source: "jenga-biz",
    },
  } as Record<string, unknown>;

  // Remove undefined fields
  if (!callback_url) delete initBody.callback_url;

  const res = await fetch(`${cfg.paystack.baseUrl}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.paystack.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(initBody),
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok || !payload.status) {
    const message = payload?.message ||
      "Failed to initialize Paystack transaction";
    return errorResponse("PAYSTACK_INIT_FAILED", message, 400, payload);
  }

  return successResponse({
    authorization_url: payload.data.authorization_url,
    access_code: payload.data.access_code,
    reference: payload.data.reference,
  }, 201);
}

// POST /subscriptions/paystack/webhook
async function paystackWebhook(req: Request): Promise<Response> {
  const cfg = env.getConfig();
  if (!cfg.paystack?.secretKey) {
    return errorResponse(
      "PAYSTACK_NOT_CONFIGURED",
      "Paystack is not configured on the server",
      500,
    );
  }

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  const expected = await hmacSha512Hex(cfg.paystack.secretKey, raw);
  if (!signature || signature !== expected) {
    return errorResponse(
      "INVALID_SIGNATURE",
      "Signature verification failed",
      401,
    );
  }

  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return errorResponse("INVALID_JSON", "Invalid webhook payload", 400);
  }

  // Handle only successful charges for now
  if (evt?.event === "charge.success" && evt?.data?.status === "success") {
    const metadata = evt?.data?.metadata || {};
    const user_id: string | undefined = metadata.user_id;
    const plan_id: string | undefined = metadata.plan_id;

    if (user_id && plan_id) {
      const service = getServiceRoleClient();
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Ensure plan is active
      const { data: plan, error: planErr } = await service
        .from("subscription_plans")
        .select("id, is_active")
        .eq("id", plan_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!planErr && plan) {
        // Check if user already has an active subscription for this plan
        const { data: existing, error: selErr } = await service
          .from("user_subscriptions")
          .select("id")
          .eq("user_id", user_id)
          .eq("plan_id", plan_id)
          .eq("status", "active")
          .gt("current_period_end", now.toISOString());

        if (!selErr && (!existing || existing.length === 0)) {
          await service.from("user_subscriptions").insert({
            user_id,
            plan_id,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          });
        }
      }
    }
  }

  // Always return 200 to acknowledge receipt
  return successResponse({ received: true }, 200);
}
