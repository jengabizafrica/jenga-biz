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

    // Log the resend activity
    await serviceClient
      .from("user_activities")
      .insert({
        user_id: user.id,
        activity_type: "resend_confirmation",
        activity_data: { email }
      });

    // Generate new confirmation token using service role
    const { data, error } = await serviceClient.auth.admin.generateLink({
      type: 'signup',
      email: email,
    });

    if (error) {
      console.error("Error generating confirmation link:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate confirmation link" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // The confirmation email will be sent automatically by Supabase webhook
    // to the send-signup-confirmation edge function

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Confirmation email has been resent. Please check your inbox."
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error in resend-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
