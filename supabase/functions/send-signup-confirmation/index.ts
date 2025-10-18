// The function runs on Deno in Supabase Edge Functions. In the editor/node TS environment
// the remote Deno std import and global `Deno` symbol are not known, so silence TS
// checks here to keep the repo typecheckable locally.
// @ts-ignore: Deno std import for runtime (ignored by Node tsc)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Helper: verify Supabase webhook signature using HMAC-SHA256
// Supabase sends headers `webhook-signature` (format may include t=<ts>,v1=<hex>) and `webhook-timestamp`.
async function verifyWebhook(bodyText: string, headersObj: Record<string, string | undefined>, secret: string, dumpEnabled = false): Promise<boolean> {
  const sigHeader = headersObj["webhook-signature"] || headersObj["Webhook-Signature"];
  let timestamp = headersObj["webhook-timestamp"] || headersObj["Webhook-Timestamp"];
  if (!sigHeader) return false;

  // Try to extract v1=signature from header, or use header directly
  let sigHex: string | null = null;
  const v1Match = /v1=([0-9a-fA-F]+)/.exec(sigHeader);
  if (v1Match) sigHex = v1Match[1];
  else {
    // fallback: header might be raw hex or include t=...; try to extract t= and v1= pairs
    const rawMatch = /([0-9a-fA-F]{64})/.exec(sigHeader);
    if (rawMatch) sigHex = rawMatch[1];
  }

  if (!timestamp) {
    const tMatch = /t=([^,]+)/.exec(sigHeader);
    if (tMatch) timestamp = tMatch[1];
  }

  if (!timestamp || !sigHex) return false;

  const data = `${timestamp}.${bodyText}`;
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  const sigArray = new Uint8Array(sig);
  const hex = Array.from(sigArray).map(b => b.toString(16).padStart(2, '0')).join('');
  if (dumpEnabled) {
    try {
      console.debug('[send-signup-confirmation] verifyWebhook debug - provided_sig=', sigHex, 'computed_sig=', hex, 'timestamp=', timestamp, 'secret=', secret);
    } catch (e) {
      // ignore logging errors
    }
  }
  return hex === sigHex.toLowerCase();
}


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
    // Read request text early so we can verify webhook signature if present.
    // NOTE: We avoid logging header values or the secret itself to prevent leaks.
    let body: SignupEmailRequest;
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  console.debug("send-signup-confirmation: hookSecret present=", !!hookSecret);
  // Debug dump gate: set DUMP_SECRETS_FOR_DEBUG=true in function env to enable temporary secret dumping
  const dumpSecrets = (Deno.env.get("DUMP_SECRETS_FOR_DEBUG") || "").toLowerCase() === "true";

    // Short-circuit health probe before consuming the body
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      const brevoEnv = Deno.env.get("BREVO_API_KEY");
      const sender = Deno.env.get("BREVO_SENDER_EMAIL") || "unset";
      return new Response(
        JSON.stringify({
          ok: true,
          brevo_present: !!brevoEnv,
          brevo_masked: (brevoEnv ? `${brevoEnv.slice(0,4)}...(${brevoEnv.length})` : null),
          sender,
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const bodyText = await req.text();
    // Build a simple headers object for verification libraries
    const headersObj = Object.fromEntries(req.headers);

    // Log header keys only and whether an Authorization header is present (boolean)
    try {
      console.debug(
        "send-signup-confirmation: incoming header keys=",
        Array.from(req.headers.keys()),
        "auth present=", !!headersObj["authorization"],
      );
    } catch (e) {
      // ignore logging errors
    }

    if (dumpSecrets) {
      try {
        console.warn('[send-signup-confirmation] DUMP_SECRETS_FOR_DEBUG is ENABLED - dumping sensitive values FOR DEBUGGING ONLY');
        console.warn('[send-signup-confirmation] hookSecret=', hookSecret);
        console.warn('[send-signup-confirmation] raw bodyText=', bodyText);
        console.warn('[send-signup-confirmation] request headers=', headersObj);
      } catch (e) {
        // ignore
      }
    }

    // Attempt signature verification when hook secret and signature headers exist
    let raw: any = null;
    if (hookSecret) {
      const sig = headersObj["webhook-signature"] || headersObj["Webhook-Signature"];
      const ts = headersObj["webhook-timestamp"] || headersObj["Webhook-Timestamp"];
      if (sig && ts) {
        // use the raw secret (strip v1,whsec_ prefix if present)
        const rawSecret = hookSecret.startsWith("v1,whsec_") ? hookSecret.substring(9) : hookSecret;
        try {
          let verifiedByLib = false;
          // Prefer runtime import of the official helper if available (matches docs example).
          try {
            // @ts-ignore: dynamic runtime import of a remote ESM for verification (optional)
            const mod = await import('https://esm.sh/standardwebhooks@1.0.0');
            const WebhookLib = (mod && (mod.Webhook || mod.default || mod)) as any;
            if (WebhookLib) {
              try {
                const wh = new WebhookLib(rawSecret);
                const verified = wh.verify(bodyText || '', headersObj);
                // If verify returns an object (payload), use it directly
                if (verified && typeof verified === 'object') {
                  raw = verified;
                } else if (verified === true) {
                  raw = JSON.parse(bodyText || '{}');
                }
                verifiedByLib = true;
                if (dumpSecrets) console.debug('[send-signup-confirmation] verified using standardwebhooks');
              } catch (inner) {
                if (dumpSecrets) console.warn('[send-signup-confirmation] standardwebhooks verify threw:', inner);
                // fallthrough to inline verification
              }
            }
          } catch (impErr) {
            if (dumpSecrets) console.warn('[send-signup-confirmation] failed to import standardwebhooks, falling back to inline verify:', String(impErr));
          }

          if (!verifiedByLib) {
            const ok = await verifyWebhook(bodyText || '', headersObj as Record<string,string|undefined>, rawSecret as string, dumpSecrets);
            if (!ok) throw new Error('signature_mismatch');
            raw = JSON.parse(bodyText || '{}');
            if (dumpSecrets) console.debug("send-signup-confirmation: webhook signature verified (inline HMAC)");
          }
        } catch (e: any) {
          console.error("[send-signup-confirmation] Webhook signature verification failed:", e?.message || e);
          return new Response(
            JSON.stringify({ error: "unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } else {
        // Fallback to Authorization bearer token check if no signature headers present
        const authHeader = headersObj["authorization"] || headersObj["Authorization"];
        if (!authHeader) {
          console.error("[send-signup-confirmation] Missing Authorization header");
          return new Response(
            JSON.stringify({ error: "unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const token = String(authHeader).replace(/^Bearer\s+/i, '');
        const normalizeSecret = (secret: string) => secret.startsWith('v1,whsec_') ? secret.substring(9) : secret;
        const normalizedToken = normalizeSecret(token);
        const normalizedSecret = normalizeSecret(hookSecret);
        if (token !== hookSecret && normalizedToken !== normalizedSecret) {
          console.error("[send-signup-confirmation] Invalid Authorization bearer token");
          return new Response(
            JSON.stringify({ error: "unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        // parse bodyText into raw for later processing
        try {
          raw = JSON.parse(bodyText || '{}');
        } catch (e: any) {
          console.error("[send-signup-confirmation] Failed to parse JSON body:", e?.message || e);
          return new Response(
            JSON.stringify({ error: "invalid_json" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    } else {
      console.warn("[send-signup-confirmation] SEND_EMAIL_HOOK_SECRET not configured; accepting request (development mode)");
      try {
        raw = JSON.parse(bodyText || '{}');
      } catch (e: any) {
        console.error("[send-signup-confirmation] Failed to parse JSON body:", e?.message || e);
        return new Response(
          JSON.stringify({ error: "invalid_json" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Now `raw` contains the parsed payload (either from signature verification or parsed bodyText)
    try {
      const ed = raw?.email_data || raw?.email || null;
      body = {
        email: raw?.user?.email || raw?.email?.recipient || raw?.email || "",
        token_hash: ed?.token_hash ?? raw?.token_hash,
        token: ed?.token ?? raw?.token,
        email_action_type: ed?.email_action_type ?? raw?.email_action_type,
        redirect_to: ed?.redirect_to ?? raw?.redirect_to,
        confirmationUrl: raw?.confirmationUrl,
        subject: raw?.subject,
        text: raw?.text,
        html: raw?.html,
      };
    } catch (e: any) {
      console.error("[send-signup-confirmation] Failed to parse JSON body:", e?.message || e);
      return new Response(
        JSON.stringify({ error: "invalid_json" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
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
    
    // Normalize base URL to origin to avoid path prefixes causing 404s
    const rawSite = Deno.env.get("SITE_CONFIRMATION_URL") || Deno.env.get("APP_URL") || "https://jengabiz.africa";
    const siteOrigin = new URL(rawSite).origin;
    
    // Build server-side confirmation URL pointing to edge function
    const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-email`;
    // Always redirect to /confirm-email page (ignore body.redirect_to to prevent 404s)
    const redirectTo = `${siteOrigin}/confirm-email`;
    
    let confirmationUrl: string;
    if (tokenHash) {
      confirmationUrl = `${functionUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=signup&redirect_to=${encodeURIComponent(redirectTo)}`;
    } else if (body.confirmationUrl) {
      confirmationUrl = body.confirmationUrl;
    } else {
      confirmationUrl = `${functionUrl}?redirect_to=${encodeURIComponent(redirectTo)}`;
    }

    // Calculate expiration time (24 hours from now as per your setting)
    const expirationHours = 24;
    const expirationMinutes = expirationHours * 60;

    const subject = body.subject ||
      "Welcome to Jenga Biz Africa - Confirm Your Email";
    const text = body.text ||
      `Please confirm your email by visiting: ${confirmationUrl}\n\nThis link will expire in ${expirationHours} hours for security reasons.`;
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
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                <strong>⏰ Important:</strong> This confirmation link will expire in <strong>${expirationHours} hours</strong> for security reasons. Please confirm your email soon.
              </p>
            </div>
            
            <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
              If the button doesn't work, you can also copy and paste this link into your browser:
            </p>
            
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px; color: #374151;">
              ${confirmationUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
              <p style="color: #1e40af; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">
                Having trouble?
              </p>
              <p style="color: #3b82f6; margin: 0; font-size: 13px; line-height: 1.5;">
                If your link expires, simply log in to your account and request a new confirmation email from your dashboard.
              </p>
            </div>
            
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

    if (dumpSecrets) {
      try {
        console.warn('[send-signup-confirmation] DUMP_SECRETS - brevoKey (masked)=', maskKey(brevoKey), 'brevoKey(full)=', brevoKey);
        console.warn('[send-signup-confirmation] DUMP_SECRETS - env sources=', { BREVO_API_KEY: brevoEnv, VITE_BREVO_API_KEY: brevoVite });
      } catch (e) {
        // ignore
      }
    }

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
