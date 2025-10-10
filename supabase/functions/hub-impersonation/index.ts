import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AuthError,
  getUserFromRequest,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/responses.ts";
import { env } from "../_shared/env.ts";

interface ImpersonationRequest {
  action: "start" | "stop";
  hubId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Debug: log whether Authorization header is present to help diagnose CORS/preflight issues
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.debug(
        "hub-impersonation: Authorization header missing on request",
      );
    }

    const { user, supabase } = await getUserFromRequest(req);
    const config = env.getConfig();

    if (req.method === "POST") {
      const { action, hubId }: ImpersonationRequest = await req.json();

      if (action === "start") {
        // Require super admin for impersonation
        requireSuperAdmin(user);

        if (!hubId) {
          return new Response(
            JSON.stringify({ error: "Hub ID is required for impersonation" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Start impersonation using RPC
        const { data, error } = await supabase.rpc("start_impersonation", {
          target_hub_id: hubId,
        });

        if (error) {
          console.error("Impersonation start error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Impersonation started successfully",
            data,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else if (action === "stop") {
        // Stop impersonation
        const { data, error } = await supabase.rpc("stop_impersonation");

        if (error) {
          console.error("Impersonation stop error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Impersonation stopped successfully",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "GET") {
      // Get current impersonation status
      const { data: sessions, error } = await supabase
        .from("impersonation_sessions")
        .select(`
          target_hub_id,
          expires_at,
          hubs:target_hub_id (
            id,
            name,
            slug,
            country
          )
        `)
        .eq("super_admin_id", user.id)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.error("Error fetching impersonation status:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          isImpersonating: !!sessions,
          session: sessions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Hub impersonation error:", error);
    const status = (error instanceof AuthError && error.status)
      ? error.status
      : 500;
    const payload: any = { error: error?.message || String(error) };
    if (error?.code) payload.code = error.code;
    return new Response(
      JSON.stringify(payload),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
