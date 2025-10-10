/**
 * Authentication and authorization helpers
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { env } from "./env.ts";

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}

export interface AuthContext {
  user: AuthenticatedUser;
  supabase: ReturnType<typeof createClient>;
}

/**
 * Extract user from Authorization header and validate
 */
export async function getUserFromRequest(
  request: Request,
): Promise<AuthContext> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", 401);
  }

  const token = authHeader.substring(7);
  const config = env.getConfig();

  // Create supabase client with user token for RLS
  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  );

  // Get user from token
  const { data: { user }, error: userError } = await supabase.auth.getUser(
    token,
  );

  if (userError || !user) {
    throw new AuthError("Invalid or expired token", 401);
  }

  // Get user roles
  const { data: userRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("Error fetching user roles:", rolesError);
  }

  const roles = userRoles?.map((r) => r.role) || [];

  return {
    user: {
      id: user.id,
      email: user.email || "",
      roles,
    },
    supabase,
  };
}

/**
 * Create service role client for admin operations
 */
export function getServiceRoleClient() {
  const config = env.getConfig();

  return createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

/**
 * Authorization helpers
 */
export function hasRole(user: AuthenticatedUser, role: string): boolean {
  return user.roles.includes(role);
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return hasRole(user, "admin") || hasRole(user, "super_admin");
}

export function isSuperAdmin(user: AuthenticatedUser): boolean {
  return hasRole(user, "super_admin");
}

export function isHubManager(user: AuthenticatedUser): boolean {
  return hasRole(user, "hub_manager") || isAdmin(user);
}

export function requireRole(user: AuthenticatedUser, role: string): void {
  if (!hasRole(user, role)) {
    throw new AuthError(`Requires ${role} role`, 403);
  }
}

export function requireAdmin(user: AuthenticatedUser): void {
  if (!isAdmin(user)) {
    throw new AuthError("Requires admin privileges", 403);
  }
}

export function requireSuperAdmin(user: AuthenticatedUser): void {
  if (!isSuperAdmin(user)) {
    throw new AuthError("Requires super admin privileges", 403);
  }
}

/**
 * Custom authentication error
 */
export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
    this.name = "AuthError";
  }
}
