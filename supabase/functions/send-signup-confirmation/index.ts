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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupEmailRequest {
  email: string;
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
    const body: SignupEmailRequest = await req.json();

    // Log full payload in development to help debugging (best-effort)
    const isDev = (Deno.env.get('ENV') === 'development') || (Deno.env.get('DEV') === 'true');
    if (isDev) {
      try {
        console.log('send-signup-confirmation - incoming payload:', JSON.stringify(body));
      } catch (e) {
        console.log('send-signup-confirmation - incoming payload (unserializable)');
      }
    }

    const email = body.email;
    const confirmationUrl = body.confirmationUrl || '';
    const subject = body.subject || 'Welcome to Jenga Biz Africa - Confirm Your Email';
    const text = body.text || `Please confirm your email by visiting: ${confirmationUrl}`;
    const html = body.html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f97316; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Jenga Biz Africa!</h1>
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
    const brevoKey = Deno.env.get('BREVO_API_KEY') || Deno.env.get('VITE_BREVO_API_KEY');
    if (!brevoKey) {
      console.error('BREVO_API_KEY is not configured for send-signup-confirmation');
      return new Response(JSON.stringify({ success: false, error: 'brevo_not_configured', message: 'BREVO_API_KEY must be set in the function environment' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Server-side template rendering: prefer body.html; otherwise choose based on inviteCode presence
    const inviteCode = (body as any).inviteCode as string | undefined;
    let renderedHtml = html;
    let renderedText = text;

    if (!body.html) {
      if (inviteCode) {
        // Invite template
        renderedHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;background:#f3f4f6;padding:20px;margin:0;">
    <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e6e7ea;">
      <tr style="background:#111827"><td style="padding:14px;text-align:center;"><img src="https://diclwatocrixibjpajuf.supabase.co/storage/v1/object/public/public/jenga-biz-logo.png" alt="Jenga Biz" style="height:44px" /></td></tr>
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

        renderedText = `You have been invited

Invite code: ${inviteCode}

Accept the invite: ${confirmationUrl}
`;
      } else {
        // Confirmation template
        renderedHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial; background:#f3f4f6; padding:20px; margin:0;">
    <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e7ea;">
      <tr style="background:#111827;"><td style="padding:18px;text-align:center;"><img src="https://diclwatocrixibjpajuf.supabase.co/storage/v1/object/public/public/jenga-biz-logo.png" alt="Jenga Biz" style="height:44px;display:inline-block" /></td></tr>
      <tr><td style="padding:28px;"><h2 style="margin:0 0 12px 0;color:#111827;font-size:20px;">Confirm your signup</h2>
          <p style="color:#6b7280;margin:0 0 20px 0;line-height:1.6;">Thank you for joining Jenga Biz Africa. Click the button below to confirm your email and activate your account.</p>
          <div style="text-align:center;margin:22px 0;"><a href="${confirmationUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Confirm your email</a></div>
          <p style="color:#6b7280;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="background:#f9fafb;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;word-break:break-all;color:#111827;">${confirmationUrl}</p>
          <hr style="border:none;border-top:1px solid #eef2f6;margin:20px 0;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">If you didn't request this, you can ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`;

        renderedText = `Confirm your signup

Follow this link to confirm your user:
${confirmationUrl}
`;
      }
    }

    // Send via Brevo
    try {
      const brevoPayload = {
        sender: { name: 'Jenga Biz Africa', email: 'support@jengabiz.africa' },
        to: [{ email }],
        subject,
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
        console.error('Brevo send failed:', brevoResp.status, brevoBody);
        return new Response(JSON.stringify({ success: false, provider: 'brevo', status: brevoResp.status, details: brevoBody }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      console.log('Brevo send-success:', brevoBody);
      return new Response(JSON.stringify({ success: true, provider: 'brevo', data: brevoBody }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } catch (e: any) {
      console.error('Brevo send error:', e);
      return new Response(JSON.stringify({ success: false, provider: 'brevo', error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
  } catch (error: any) {
    console.error('Error sending signup confirmation email:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || String(error),
        details: error?.response?.body || null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);