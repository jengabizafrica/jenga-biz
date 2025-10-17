// The function runs on Deno in Supabase Edge Functions. In the editor/node TS environment
// the remote Deno std import and global `Deno` symbol are not known, so silence TS
// checks here to keep the repo typecheckable locally.
// @ts-ignore: Deno std import for runtime (ignored by Node tsc)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Provide a fallback declaration so TypeScript in the editor doesn't error on `Deno`.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignupEmailRequest {
  email: string;
  token_hash?: string;
  token?: string;
  email_action_type?: string;
  redirect_to?: string;
  confirmationUrl?: string;
  subject?: string;
  text?: string;
  html?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: SignupEmailRequest;
    
    // Verify webhook signature if SEND_EMAIL_HOOK_SECRET is configured AND signature is provided
    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    const signature = req.headers.get("webhook-signature");
    
    if (hookSecret && signature) {
      // Strip v1,whsec_ prefix if present
      const actualSecret = hookSecret.startsWith("v1,whsec_") 
        ? hookSecret.substring(9) 
        : hookSecret;

      // Read payload for verification
      const payload = await req.text();
      
      // Verify signature using HMAC
      const expectedSig = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(actualSecret + payload)
      );
      const expectedSigHex = Array.from(new Uint8Array(expectedSig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (!signature.includes(expectedSigHex)) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Parse body after successful verification
      body = JSON.parse(payload);
      console.log("Webhook signature verified successfully");
    } else {
      // No signature verification - accept as auth hook or development mode
      if (!signature && hookSecret) {
        console.warn("SEND_EMAIL_HOOK_SECRET configured but no signature provided - accepting as Supabase auth hook");
      } else if (!hookSecret) {
        console.warn("SEND_EMAIL_HOOK_SECRET not configured, skipping webhook verification");
      }
      body = await req.json();
    }

    // Log full payload in development to help debugging (best-effort)
    const isDev = (Deno.env.get("ENV") === "development") ||
      (Deno.env.get("DEV") === "true");
    if (isDev) {
      try {
        console.log(
          "send-signup-confirmation - incoming payload:",
          JSON.stringify(body),
        );
      } catch (e) {
        console.log(
          "send-signup-confirmation - incoming payload (unserializable)",
        );
      }
    }

    const email = body.email;
    const tokenHash = body.token_hash;
    const token = body.token;
    const siteUrl = Deno.env.get("SITE_CONFIRMATION_URL") || "https://jengabiz.africa";
    
    // Build server-side confirmation URL pointing to edge function
    const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-email`;
    const redirectTo = body.redirect_to || `${siteUrl}/dashboard`;
    
    let confirmationUrl: string;
    if (tokenHash) {
      confirmationUrl = `${functionUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=signup&redirect_to=${encodeURIComponent(redirectTo)}`;
    } else if (body.confirmationUrl) {
      confirmationUrl = body.confirmationUrl;
    } else {
      confirmationUrl = `${functionUrl}?redirect_to=${encodeURIComponent(redirectTo)}`;
    }

    const subject = body.subject ||
      "Welcome to Jenga Biz Africa - Confirm Your Email";
    const text = body.text ||
      `Please confirm your email by visiting: ${confirmationUrl}`;
    const html = body.html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f97316; padding: 8px 20px 14px 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <img src="https://diclwatocrixibjpajuf.supabase.co/storage/v1/object/sign/Assets/jenga-biz-logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yODEzZWU5Zi1mMWQ4LTQ5YzMtODQ4Yi0yMWY1ZmViMGFmN2MiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBc3NldHMvamVuZ2EtYml6LWxvZ28ucG5nIiwiaWF0IjoxNzU5OTQ1NzYwLCJleHAiOjIzNTkxMjk3NjB9.c6AY3QkcFeRAeWi64wSF0Mak7pGg9Sa2bwjiZdguLa4" alt="Jenga Biz" style="height:44px;display:inline-block;margin-bottom:6px;" />
              <h1 style="color: white; margin: 0; font-size: 18px;">Welcome to Jenga Biz Africa!</h1>
            </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <h2 style="color: #374151; margin-bottom: 20px;">Confirm Your Email Address</h2>
            
            <p style="color: #6b7280; margin-bottom: 25px; line-height: 1.6;">
              Thank you for joining Jenga Biz Africa! We're excited to help you build your business strategy.
            </p>
            
            <p style="color: #6b7280; margin-bottom: 25px; line-height: 1.6;">
              Please click the button below to confirm your email address and activate your account:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationUrl}" style="background-color: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Confirm Email Address
              </a>
            </div>
            
            <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
              If the button doesn't work, you can also copy and paste this link into your browser:
            </p>
            
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px; color: #374151;">
              ${confirmationUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 10px;">
              If you didn't create an account with Jenga Biz Africa, you can safely ignore this email.
            </p>
            
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Best regards,<br>
              The Jenga Biz Africa Team
            </p>
          </div>
        </div>
      `;

    // BREVO-only mode: require BREVO_API_KEY in function env
    // Add defensive logging and a dev-only header override to help diagnose intermittent missing-secret errors.
    function maskKey(k?: string | undefined) {
      if (!k) return null;
      try {
        return `${k.slice(0, 4)}...(${k.length})`;
      } catch {
        return "***";
      }
    }

    // Health endpoint (GET /health) to surface masked env presence without sending mail
    if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
      const brevoEnv = Deno.env.get("BREVO_API_KEY");
      const sender = Deno.env.get("BREVO_SENDER_EMAIL") || "unset";
      return new Response(
        JSON.stringify({
          ok: true,
          brevo_present: !!brevoEnv,
          brevo_masked: maskKey(brevoEnv) || null,
          sender,
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const brevoEnv = Deno.env.get("BREVO_API_KEY");
    const brevoVite = Deno.env.get("VITE_BREVO_API_KEY");
    let brevoKey = brevoEnv || brevoVite;

    // In development ONLY, allow an override from a request header to help debug deployed functions locally.
    if (!brevoKey && isDev) {
      const hdr = req.headers.get("x-brevo-api-key") ||
        req.headers.get("x-debug-brevo-key") || undefined;
      if (hdr) {
        console.warn(
          "send-signup-confirmation: using BREVO API key from request header (development only)",
        );
        brevoKey = hdr;
      }
    }

    console.debug(
      "send-signup-confirmation: brevoKey present=",
      !!brevoKey,
      "sources=",
      { BREVO_API_KEY: !!brevoEnv, VITE_BREVO_API_KEY: !!brevoVite },
      "masked=",
      maskKey(brevoKey),
    );

    // Quick retry: attempt to re-read env once after a short delay in case of transient env propagation
    if (!brevoKey) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
        brevoKey = Deno.env.get("BREVO_API_KEY") ||
          Deno.env.get("VITE_BREVO_API_KEY");
        console.debug(
          "send-signup-confirmation: retry read brevoKey present=",
          !!brevoKey,
          "masked=",
          maskKey(brevoKey),
        );
      } catch (e) {
        // ignore
      }
    }

    if (!brevoKey) {
      console.error(
        "BREVO_API_KEY is not configured for send-signup-confirmation",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "brevo_not_configured",
          message: "BREVO_API_KEY must be set in the function environment",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // This function is strictly for self-registration confirmation emails.
    // Invite-specific emails are handled by `send-invite-confirmation`.
    const inviteCode = (body as any).inviteCode as string | undefined;
    if (inviteCode) {
      console.warn(
        "send-signup-confirmation invoked with inviteCode; invite sends should use send-invite-confirmation. Ignoring inviteCode and sending confirmation template.",
      );
    }
    const renderedHtml = html;
    const renderedText = text;

    // Determine sender email (env override preferred). In production this must be a verified sender in Brevo.
    const envSender = Deno.env.get("BREVO_SENDER_EMAIL");
    const defaultSender = "jengabizafrica@gmail.com";
    let senderEmail = envSender || defaultSender;

    // Allow a dev-only override via request header or body for testing
    if (isDev) {
      const hdrSender = req.headers.get("x-sender-email") || undefined;
      if (hdrSender) senderEmail = hdrSender;
      if ((body as any).senderEmail) senderEmail = (body as any).senderEmail;
    }

    console.debug("send-signup-confirmation: using sender=", senderEmail);

    // Send via Brevo
    try {
      const brevoPayload = {
        sender: { name: "Jenga Biz Africa", email: senderEmail },
        to: [{ email }],
        subject,
        htmlContent: renderedHtml,
        textContent: renderedText,
      };

      const brevoResp = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify(brevoPayload),
      });

      const brevoBody = await brevoResp.json().catch(() => null);
      if (!brevoResp.ok) {
        console.error("Brevo send failed:", brevoResp.status, brevoBody);
        return new Response(
          JSON.stringify({
            success: false,
            provider: "brevo",
            status: brevoResp.status,
            details: brevoBody,
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      console.log("Brevo send-success:", brevoBody);
      return new Response(
        JSON.stringify({ success: true, provider: "brevo", data: brevoBody }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (e: any) {
      console.error("Brevo send error:", e);
      return new Response(
        JSON.stringify({ success: false, provider: "brevo", error: String(e) }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }
  } catch (error: any) {
    console.error("Error sending signup confirmation email:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || String(error),
        details: error?.response?.body || null,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
