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
    console.log("=== Resend confirmation request started ===");
    
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
      console.log("Unauthorized: no valid user");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("User authenticated:", user.id, user.email);

    const body: ResendRequest = await req.json().catch(() => ({}));
    const email = body.email || user.email;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if email is already confirmed before generating new token
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profileData } = await serviceClient
      .from('profiles')
      .select('email_confirmed')
      .eq('id', user.id)
      .single();

    console.log("Email confirmation status:", profileData?.email_confirmed);

    if (profileData?.email_confirmed) {
      console.log("Email already confirmed, rejecting resend");
      return new Response(
        JSON.stringify({ 
          error: "Your email is already confirmed. Please try logging in." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the resend activity
    console.log("Logging resend activity for user:", user.id);
    await serviceClient
      .from("user_activities")
      .insert({
        user_id: user.id,
        activity_type: "resend_confirmation",
        activity_data: { email }
      });

    // Normalize URL to origin to avoid path prefixes causing 404s
    const appRaw = Deno.env.get('APP_URL') || 'https://jengabiz.africa';
    const appRawFixed = appRaw.replace(/^https\/\//, 'https://').replace(/^http\/\//, 'http://');
    console.log("APP_URL raw:", appRaw, "→ fixed:", appRawFixed);
    const appOrigin = new URL(appRawFixed).origin;
    
    // Use signInWithOtp for existing users - sends magic link without trying to create account
    const { data, error } = await serviceClient.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false,  // Don't create new users, only send to existing ones
        emailRedirectTo: `${appOrigin}/confirm-email`
      }
    });

    if (error) {
      console.error("Error sending magic link:", error);
      
      // Handle rate limiting
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        return new Response(
          JSON.stringify({ 
            error: "Too many requests. Please wait a few minutes before trying again." 
          }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
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
          error: "Failed to send confirmation email. Please try again later.",
          details: error.message 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Successfully sent magic link via signInWithOtp");

    // signInWithOtp automatically sends the magic link through Supabase's system

    // Return success - Supabase has already sent the magic link
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Confirmation email has been resent. Please check your inbox and spam folder.",
        provider: "supabase"
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
