import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Custom email confirmation endpoint using PKCE/server flow
 * Handles token_hash from confirmation emails and returns session
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") || "signup";

    if (!tokenHash) {
      return new Response(
        JSON.stringify({ error: "Missing token_hash parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, supabaseAnonKey);

    // Verify OTP using token_hash
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    });

    if (error) {
      console.error("Email confirmation error:", error);
      return new Response(
        JSON.stringify({ 
          error: error.message,
          code: error.status || 400
        }),
        {
          status: error.status || 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!data.session) {
      return new Response(
        JSON.stringify({ error: "No session returned from verification" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update profile email_confirmed status
    if (data.user?.id) {
      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await serviceClient
        .from("profiles")
        .update({
          email_confirmed: true,
          email_confirmed_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
    }

    // Return session data for client-side storage
    return new Response(
      JSON.stringify({
        success: true,
        session: data.session,
        user: data.user,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in confirm-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
