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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  inviteCode: string;
  confirmationUrl?: string;
  subject?: string;
  text?: string;
  html?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: InviteEmailRequest = await req.json();

    const isDev = (Deno.env.get('ENV') === 'development') || (Deno.env.get('DEV') === 'true');
    if (isDev) {
      try {
        console.log('send-invite-confirmation - incoming payload:', JSON.stringify(body));
      } catch {
        console.log('send-invite-confirmation - incoming payload (unserializable)');
      }
    }

    if (!body.inviteCode) {
      return new Response(JSON.stringify({ success: false, error: 'missing_invite_code', message: 'inviteCode is required for invite emails' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const email = body.email;
    let confirmationUrl = body.confirmationUrl || '';
    if (!confirmationUrl) {
      // Fallback: try to build a registration link from known env vars or default to root /register
      const confirmationBase = Deno.env.get('SITE_CONFIRMATION_URL') || Deno.env.get('VITE_REDIRECT_URL') || Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || '';
      if (confirmationBase) {
        const base = confirmationBase.replace(/\/$/, '');
        const params = new URLSearchParams();
  params.set('invite_code', body.inviteCode);
  if (body.email) params.set('email', body.email);
        confirmationUrl = `${base}?${params.toString()}`;
      } else {
        // default to app /register path
        const appOrigin = Deno.env.get('SITE_URL') || '';
        const params = new URLSearchParams();
  params.set('invite_code', body.inviteCode);
  if (body.email) params.set('email', body.email);
        confirmationUrl = appOrigin ? `${appOrigin.replace(/\/$/, '')}/register?${params.toString()}` : `/register?${params.toString()}`;
      }
    }

    function maskKey(k?: string | undefined) {
      if (!k) return null;
      try { return `${k.slice(0,4)}...(${k.length})`; } catch { return '***'; }
    }

    const brevoEnv = Deno.env.get('BREVO_API_KEY');
    const brevoVite = Deno.env.get('VITE_BREVO_API_KEY');
    let brevoKey = brevoEnv || brevoVite;

    if (!brevoKey && isDev) {
      const hdr = req.headers.get('x-brevo-api-key') || req.headers.get('x-debug-brevo-key') || undefined;
      if (hdr) {
        console.warn('send-invite-confirmation: using BREVO API key from request header (development only)');
        brevoKey = hdr;
      }
    }

    console.debug('send-invite-confirmation: brevoKey present=', !!brevoKey, 'sources=', { BREVO_API_KEY: !!brevoEnv, VITE_BREVO_API_KEY: !!brevoVite }, 'masked=', maskKey(brevoKey));

    if (!brevoKey) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
        brevoKey = Deno.env.get('BREVO_API_KEY') || Deno.env.get('VITE_BREVO_API_KEY');
        console.debug('send-invite-confirmation: retry read brevoKey present=', !!brevoKey, 'masked=', maskKey(brevoKey));
      } catch {
        // ignore
      }
    }

    if (!brevoKey) {
      console.error('BREVO_API_KEY is not configured for send-invite-confirmation');
      return new Response(JSON.stringify({ success: false, error: 'brevo_not_configured', message: 'BREVO_API_KEY must be set in the function environment' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Render invite template (invite-specific)
    const inviteCode = body.inviteCode;
    const renderedHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;background:#f3f4f6;padding:20px;margin:0;">
    <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e6e7ea;">
      <tr style="background:#111827"><td style="padding:14px;text-align:center;"><img src="https://diclwatocrixibjpajuf.supabase.co/storage/v1/object/sign/Assets/jenga-biz-logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yODEzZWU5Zi1mMWQ4LTQ5YzMtODQ4Yi0yMWY1ZmViMGFmN2MiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBc3NldHMvamVuZ2EtYml6LWxvZ28ucG5nIiwiaWF0IjoxNzU5OTQ1NzYwLCJleHAiOjIzNTkxMjk3NjB9.c6AY3QkcFeRAeWi64wSF0Mak7pGg9Sa2bwjiZdguLa4" alt="Jenga Biz" style="height:44px" /></td></tr>
      <tr><td style="padding:24px;">
        <h2 style="margin:0 0 12px 0;color:#111827;font-size:20px;">You have been invited</h2>
        <p style="color:#6b7280;margin:0 0 18px 0;line-height:1.6;">You were invited to create an account on Jenga Biz Africa.</p>
        <div style="background:#f9fafb;border:1px dashed #e6e7ea;padding:12px;border-radius:8px;margin-bottom:18px;">
          <strong style="display:block;color:#111827;margin-bottom:6px;">Invite code</strong>
          <div style="font-family:monospace;font-size:16px;color:#111827;">${inviteCode}</div>
          <p style="color:#6b7280;font-size:13px;margin:8px 0 0 0;">Open the app and enter this code during registration.</p>
        </div>
        <div style="text-align:center;margin:16px 0;"><a href="${confirmationUrl}" style="display:inline-block;background:#047857;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Accept the invite and register</a></div>
        <p style="color:#6b7280;font-size:13px;">If the button doesn't work, use this link:</p>
        <p style="background:#f9fafb;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;word-break:break-all;color:#111827;">${confirmationUrl}</p>
        <hr style="border:none;border-top:1px solid #eef2f6;margin:20px 0;" />
        <p style="color:#9ca3af;font-size:12px;margin:0;">If you weren't expecting this invite, ignore this message or contact your hub administrator.</p>
      </td></tr>
    </table>
  </body>
</html>`;

    const renderedText = `You have been invited\n\nInvite code: ${inviteCode}\n\nAccept the invite: ${confirmationUrl}\n`;

    const envSender = Deno.env.get('BREVO_SENDER_EMAIL');
    const defaultSender = 'jengabizafrica@gmail.com';
    let senderEmail = envSender || defaultSender;

    if (isDev) {
      const hdrSender = req.headers.get('x-sender-email') || undefined;
      if (hdrSender) senderEmail = hdrSender;
      if ((body as any).senderEmail) senderEmail = (body as any).senderEmail;
    }

  console.debug('send-invite-confirmation: using sender=', senderEmail);
  console.debug('send-invite-confirmation: confirmationUrl=', confirmationUrl, 'to=', email, 'inviteCode=', inviteCode);

    try {
      const brevoPayload = {
        sender: { name: 'Jenga Biz Africa', email: senderEmail },
        to: [{ email }],
        subject: body.subject || `You were invited to join ${Deno.env.get('SITE_NAME') || 'Jenga Biz'}`,
        htmlContent: renderedHtml,
        textContent: renderedText,
      };

      const brevoResp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify(brevoPayload),
      });

      const brevoBody = await brevoResp.json().catch(() => null);
      if (!brevoResp.ok) {
        console.error('Brevo send failed (invite):', brevoResp.status, brevoBody);
        return new Response(JSON.stringify({ success: false, provider: 'brevo', status: brevoResp.status, details: brevoBody }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      console.log('Brevo send-success (invite):', brevoBody);
      return new Response(JSON.stringify({ success: true, provider: 'brevo', data: brevoBody }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } catch (e: any) {
      console.error('Brevo send error (invite):', e);
      return new Response(JSON.stringify({ success: false, provider: 'brevo', error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
  } catch (error: any) {
    console.error('Error sending invite email:', error);
    return new Response(JSON.stringify({ error: error?.message || String(error), details: error?.response?.body || null }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};

serve(handler);
