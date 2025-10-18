import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Server-side email confirmation endpoint with HttpOnly cookies
 * Handles token_hash verification and sets secure session cookies
 * Redirects to APP_URL after successful confirmation
 */
const handler = async (req: Request): Promise<Response> => {
  // Normalize base URL to origin to avoid path prefixes causing 404s
  const appRaw = Deno.env.get("APP_URL") || "https://jengabiz.africa";
  // Fix common URL mistakes (missing colon)
  const appRawFixed = appRaw.replace(/^https\/\//, 'https://').replace(/^http\/\//, 'http://');
  console.log("APP_URL raw:", appRaw, "→ fixed:", appRawFixed);
  const appOrigin = new URL(appRawFixed).origin;
  
  try {
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") || "signup";
    const redirectTo = url.searchParams.get("redirect_to");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!tokenHash) {
      // Redirect to /confirm-email with error parameter
      return Response.redirect(`${appOrigin}/confirm-email?confirmation_error=missing_token`, 302);
    }

    // Create client for verification
    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Try verifying with provided type first
    console.log(`Attempting verification with type: ${type}`);
    let verifyResult = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    });

    // If expired/invalid and type mismatch suspected, try alternate type
    if (verifyResult.error && verifyResult.error.message?.includes('expired')) {
      const alternateType = type === 'signup' ? 'magiclink' : 'signup';
      console.log(`Primary type '${type}' failed, retrying with '${alternateType}'`);
      
      verifyResult = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: alternateType as any,
      });
      
      if (!verifyResult.error) {
        console.log(`✓ Verification succeeded with alternate type: ${alternateType}`);
      }
    }

    const { data, error } = verifyResult;

    if (error || !data.session) {
      console.error("Email confirmation error:", error);
      
      // Redirect to /confirm-email with error parameter
      const errorCode = error?.message?.includes("expired") ? "expired" : "failed";
      return Response.redirect(`${appOrigin}/confirm-email?confirmation_error=${errorCode}&email=${encodeURIComponent(data?.user?.email || '')}`, 302);
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

    // Redirect to /confirm-email with session tokens in URL hash (secure)
    console.log("Redirecting to:", `${appOrigin}/confirm-email?confirmation_success=true`);
    
    // Pass tokens in URL hash (not query params) for security
    // Client will read these and call setSession()
    const redirectUrl = `${appOrigin}/confirm-email?confirmation_success=true#access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token)}&expires_in=${data.session.expires_in}&token_type=bearer`;
    
    return Response.redirect(redirectUrl, 302);

  } catch (error: any) {
    console.error("Error in confirm-email function:", error);
    // Always redirect to /confirm-email with error
    return Response.redirect(`${appOrigin}/confirm-email?confirmation_error=unexpected`, 302);
  }
};

serve(handler);
