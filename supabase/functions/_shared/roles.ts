import { getServiceRoleClient } from "./auth.ts";

export type CreatorRole = { role: string; hub_id?: string };

/**
 * Fetch roles for a user and return both the role rows and a helper to detect hub context
 */
export async function fetchUserRoles(
  userId: string,
): Promise<{ roles: CreatorRole[] }> {
  const service = getServiceRoleClient();
  try {
    const { data } = await service
      .from("user_roles")
      .select("role, hub_id")
      .eq("user_id", userId);

    return { roles: (data || []) as CreatorRole[] };
  } catch (e) {
    // Bubble up the error to caller to decide how to handle it; callers may choose
    // to assume no roles if the query fails.
    throw e;
  }
}

export function isSuperAdminFromRoles(roles: CreatorRole[] | null | undefined) {
  return (roles || []).some((r) => r.role === "super_admin");
}

export function findHubContextFromRoles(
  roles: CreatorRole[] | null | undefined,
) {
  return (roles || []).find((r) =>
    (r.role === "hub_manager" || r.role === "admin") && r.hub_id
  );
}
