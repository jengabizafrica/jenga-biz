import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendRequest {
  email?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user's token to verify they're authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: ResendRequest = await req.json().catch(() => ({}));
    const email = body.email || user.email;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting check: max 3 resends per hour
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentActivity, error: activityError } = await serviceClient
      .from("user_activities")
      .select("id")
      .eq("user_id", user.id)
      .eq("activity_type", "resend_confirmation")
      .gte("created_at", oneHourAgo);

    if (activityError) {
      console.error("Error checking resend rate limit:", activityError);
    } else if (recentActivity && recentActivity.length >= 3) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Maximum 3 resend requests per hour.",
          retry_after: 3600 
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if email is already confirmed before generating new token
    const { data: profileData } = await serviceClient
      .from('profiles')
      .select('email_confirmed')
      .eq('id', user.id)
      .single();

    if (profileData?.email_confirmed) {
      return new Response(
        JSON.stringify({ 
          error: "Your email is already confirmed. Please try logging in." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the resend activity
    await serviceClient
      .from("user_activities")
      .insert({
        user_id: user.id,
        activity_type: "resend_confirmation",
        activity_data: { email }
      });

    // Generate confirmation link for existing unconfirmed user
    // Use magiclink type which works for both new and existing users
    const { data, error } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('APP_URL') || 'https://jengabiz.africa'}/confirm-email`
      }
    });

    if (error) {
      console.error("Error generating confirmation link:", error);
      
      // Check if email is already confirmed
      if (error.message?.includes('email_confirmed_at') || error.message?.includes('already confirmed')) {
        return new Response(
          JSON.stringify({ 
            error: "This email is already confirmed. Please try logging in." 
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Failed to generate confirmation link. Please try again later.",
          details: error.message 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract token data
    const tokenHash = data?.properties?.hashed_token;
    const token = data?.properties?.token;

    if (!tokenHash) {
      console.error("No token_hash in generated link data:", data);
      return new Response(
        JSON.stringify({ 
          error: "Failed to generate confirmation token" 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build server-side confirmation URL pointing to confirm-email edge function
    const siteUrl = Deno.env.get("SITE_CONFIRMATION_URL") || Deno.env.get("APP_URL") || "https://jengabiz.africa";
    const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-email`;
    const redirectTo = `${siteUrl}/confirm-email`;

    // Construct the confirmation URL (matches send-signup-confirmation pattern)
    const confirmationUrl = `${functionUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=signup&redirect_to=${encodeURIComponent(redirectTo)}`;

    console.log("Generated confirmation URL for resend");

    // Email template
    const expirationHours = 24;
    const subject = "Jenga Biz Africa - Confirm Your Email";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f97316; padding: 8px 20px 14px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <img src="https://diclwatocrixibjpajuf.supabase.co/storage/v1/object/sign/Assets/jenga-biz-logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yODEzZWU5Zi1mMWQ4LTQ5YzMtODQ4Yi0yMWY1ZmViMGFmN2MiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBc3NldHMvamVuZ2EtYml6LWxvZ28ucG5nIiwiaWF0IjoxNzU5OTQ1NzYwLCJleHAiOjIzNTkxMjk3NjB9.c6AY3QkcFeRAeWi64wSF0Mak7pGg9Sa2bwjiZdguLa4" alt="Jenga Biz" style="height:44px;display:inline-block;margin-bottom:6px;" />
          <h1 style="color: white; margin: 0; font-size: 18px;">Welcome Back to Jenga Biz Africa!</h1>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h2 style="color: #374151; margin-bottom: 20px;">Confirm Your Email Address</h2>
          
          <p style="color: #6b7280; margin-bottom: 25px; line-height: 1.6;">
            You requested a new confirmation email. Please click the button below to confirm your email address:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmationUrl}" style="background-color: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Confirm Email Address
            </a>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
              <strong>⏰ Important:</strong> This confirmation link will expire in <strong>${expirationHours} hours</strong> for security reasons.
            </p>
          </div>
          
          <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:
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
            If you didn't request this email, you can safely ignore it.
          </p>
          
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Best regards,<br>
            The Jenga Biz Africa Team
          </p>
        </div>
      </div>
    `;

    const textContent = `
Please confirm your email by visiting: ${confirmationUrl}

This link will expire in ${expirationHours} hours for security reasons.

If you didn't request this email, you can safely ignore it.

Best regards,
The Jenga Biz Africa Team
    `;

    // Get Brevo credentials
    const brevoKey = Deno.env.get("BREVO_API_KEY") || Deno.env.get("VITE_BREVO_API_KEY");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "jengabizafrica@gmail.com";

    if (!brevoKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "Email service not configured",
          message: "BREVO_API_KEY must be set in the function environment"
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send via Brevo
    try {
      const brevoPayload = {
        sender: { name: "Jenga Biz Africa", email: senderEmail },
        to: [{ email: email }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent,
      };

      console.log("Sending confirmation email via Brevo to:", email);

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
            details: brevoBody
          }),
          { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Brevo send success:", brevoBody);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Confirmation email has been resent. Please check your inbox and spam folder.",
          provider: "brevo",
          data: brevoBody
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );

    } catch (brevoError: any) {
      console.error("Error sending via Brevo:", brevoError);
      return new Response(
        JSON.stringify({ 
          success: false,
          provider: "brevo",
          error: String(brevoError)
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

  } catch (error: any) {
    console.error("Error in resend-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
