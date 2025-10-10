-- Add a service-safe RPC to add a user role with audit
-- This function is SECURITY DEFINER and intended to be callable by the service-role client.

CREATE OR REPLACE FUNCTION public.service_add_user_role(
  target_user_id uuid,
  new_role public.user_role,
  requester_user_id uuid DEFAULT NULL,
  requester_ip inet DEFAULT NULL,
  requester_user_agent text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert role if not exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Insert an audit record if an audit table exists (best-effort)
  -- (Assumes a user_roles_audit table or similar — if not present this will be ignored)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles_audit') THEN
      INSERT INTO public.user_roles_audit (user_id, role, changed_by, requester_ip, requester_user_agent, created_at)
      VALUES (target_user_id, new_role, requester_user_id, requester_ip, requester_user_agent, now());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- don't fail the main action if audit table is missing or insert fails
    RAISE NOTICE 'service_add_user_role: audit insert failed: %', SQLERRM;
  END;

  RETURN TRUE;
END
$$;

-- Grant execute to anon/service-role if needed (service-role client should already have permission)
GRANT EXECUTE ON FUNCTION public.service_add_user_role(uuid, public.user_role, uuid, inet, text) TO PUBLIC;
