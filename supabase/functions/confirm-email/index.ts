import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Server-side email confirmation endpoint with HttpOnly cookies
 * Handles token_hash verification and sets secure session cookies
 * Redirects to APP_URL after successful confirmation
 */
const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") || "signup";
    const redirectTo = url.searchParams.get("redirect_to");
    
    const appUrl = Deno.env.get("APP_URL") || "https://jengabiz.africa";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!tokenHash) {
      // Redirect to error page
      return Response.redirect(`${appUrl}/auth?error=missing_token`, 302);
    }

    // Create client for verification
    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Verify OTP using token_hash (server-side with service role)
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    });

    if (error || !data.session) {
      console.error("Email confirmation error:", error);
      const errorMsg = encodeURIComponent(error?.message || "Confirmation failed");
      return Response.redirect(`${appUrl}/auth?error=${errorMsg}`, 302);
    }

    // Update profile email_confirmed status
    if (data.user?.id) {
      await client
        .from("profiles")
        .update({
          email_confirmed: true,
          email_confirmed_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
    }

    // Set HttpOnly cookies for session
    const cookieDomain = new URL(appUrl).hostname;
    const isProduction = !appUrl.includes("localhost");
    
    const accessTokenCookie = `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${data.session.expires_in}${isProduction ? "; Secure" : ""}; Domain=${cookieDomain}`;
    const refreshTokenCookie = `sb-refresh-token=${data.session.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${isProduction ? "; Secure" : ""}; Domain=${cookieDomain}`;

    // Redirect to app with session established
    const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : `${appUrl}/dashboard`;
    
    return new Response(null, {
      status: 302,
      headers: {
        "Location": finalRedirect,
        "Set-Cookie": [accessTokenCookie, refreshTokenCookie].join(", "),
      },
    });

  } catch (error: any) {
    console.error("Error in confirm-email function:", error);
    const appUrl = Deno.env.get("APP_URL") || "https://jengabiz.africa";
    const errorMsg = encodeURIComponent("Unexpected error occurred");
    return Response.redirect(`${appUrl}/auth?error=${errorMsg}`, 302);
  }
};

serve(handler);
