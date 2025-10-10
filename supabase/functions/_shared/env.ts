/**
 * Environment configuration and validation
 * Centralizes environment variable access with validation
 */

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  resendApiKey?: string;
  paystack?: {
    secretKey: string;
    publicKey?: string;
    baseUrl: string;
  };
  rateLimit?: {
    redis?: {
      url: string;
      token: string;
    };
  };
}

class Environment {
  private config: EnvironmentConfig | null = null;

  public getConfig(): EnvironmentConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  private loadConfig(): EnvironmentConfig {
    const requiredVars = {
      supabaseUrl: Deno.env.get("SUPABASE_URL"),
      supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY"),
      supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    };

    // Validate required environment variables
    for (const [key, value] of Object.entries(requiredVars)) {
      if (!value) {
        throw new Error(
          `Missing required environment variable: ${key.toUpperCase()}`,
        );
      }
    }

    const config: EnvironmentConfig = {
      ...requiredVars as Required<typeof requiredVars>,
      resendApiKey: Deno.env.get("RESEND_API_KEY"),
    };

    // Optional Paystack config
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (paystackSecret) {
      config.paystack = {
        secretKey: paystackSecret,
        publicKey: Deno.env.get("PAYSTACK_PUBLIC_KEY") || undefined,
        baseUrl: Deno.env.get("PAYSTACK_BASE_URL") || "https://api.paystack.co",
      };
    }

    // Optional rate limiting config
    const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    if (redisUrl && redisToken) {
      config.rateLimit = {
        redis: { url: redisUrl, token: redisToken },
      };
    }

    return config;
  }
}

export const env = new Environment();
