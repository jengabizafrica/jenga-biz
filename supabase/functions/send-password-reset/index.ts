import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  resetUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, resetUrl }: EmailRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "Jenga Biz Africa <support@jengabiz.africa>",
      to: [to],
      subject: "Reset Your Password - Jenga Biz Africa",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f97316; margin: 0;">Jenga Biz Africa</h1>
            <p style="color: #666; margin: 5px 0;">Build Your Business Strategy for the African Market</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            <p>We received a request to reset your password for your Jenga Biz Africa account.</p>
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #f97316, #eab308); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        display: inline-block;">
                Reset My Password
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If the button above doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #f97316; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <strong>Important:</strong> This link will expire in 1 hour for security reasons.
            </p>
          </div>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
            <p style="margin: 0; color: #856404;">
              <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. 
              Your password will remain unchanged.
            </p>
          </div>
          
          <div style="text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p>This email was sent by Jenga Biz Africa</p>
            <p>© 2024 Jenga Biz Africa. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
