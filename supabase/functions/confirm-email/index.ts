import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Server-side email confirmation endpoint with HttpOnly cookies
 * Handles token_hash verification and sets secure session cookies
 * Redirects to APP_URL after successful confirmation
 */
const handler = async (req: Request): Promise<Response> => {
  const appUrl = Deno.env.get("APP_URL") || "https://jengabiz.africa";
  
  try {
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") || "signup";
    const redirectTo = url.searchParams.get("redirect_to");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!tokenHash) {
      // Redirect to app with error parameter instead of blocking
      const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : `${appUrl}/dashboard`;
      return Response.redirect(`${finalRedirect}?confirmation_error=missing_token`, 302);
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
      
      // Redirect to app with error parameter - never block access
      const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : `${appUrl}/dashboard`;
      const errorCode = error?.message?.includes("expired") ? "expired" : "failed";
      return Response.redirect(`${finalRedirect}?confirmation_error=${errorCode}&email=${encodeURIComponent(data?.user?.email || '')}`, 302);
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

    // Redirect to app with session tokens in URL hash (secure)
    const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : `${appUrl}`;
    
    console.log("Redirecting to:", `${finalRedirect}?confirmation_success=true`);
    
    // Pass tokens in URL hash (not query params) for security
    // Client will read these and call setSession()
    const redirectUrl = `${finalRedirect}?confirmation_success=true#access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token)}&expires_in=${data.session.expires_in}&token_type=bearer`;
    
    return Response.redirect(redirectUrl, 302);

  } catch (error: any) {
    console.error("Error in confirm-email function:", error);
    // Always redirect to app, never show error page
    const finalRedirect = `${appUrl}/dashboard`;
    return Response.redirect(`${finalRedirect}?confirmation_error=unexpected`, 302);
  }
};

serve(handler);
