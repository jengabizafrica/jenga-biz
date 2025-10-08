-- Update role functions to accept hub_id and allow hub-scoped role management
DO $$
BEGIN
  -- Replace add_user_role_with_audit to accept optional hub_id
  EXECUTE $func$
  CREATE OR REPLACE FUNCTION public.add_user_role_with_audit(
    target_user_id uuid,
    new_role public.user_role,
    hub_id uuid DEFAULT NULL,
    requester_ip inet DEFAULT NULL,
    requester_user_agent text DEFAULT NULL
  )
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public
  AS $body$
  DECLARE
    current_user_id uuid;
  BEGIN
    current_user_id := auth.uid();

    -- Super admins can always assign roles
    IF public.is_super_admin(current_user_id) THEN
      NULL; -- allowed
    ELSE
      -- For non-super-admins we only allow assigning hub-scoped roles when hub_id is provided
      IF hub_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: only super admins can assign global roles';
      END IF;

      -- Ensure requester has admin/hub_manager role for this hub
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = current_user_id
          AND ur.hub_id = hub_id
          AND ur.role IN ('admin','hub_manager')
      ) THEN
        RAISE EXCEPTION 'Access denied: not authorized for this hub';
      END IF;
    END IF;

    INSERT INTO public.user_roles (user_id, role, hub_id, assigned_by)
    VALUES (target_user_id, new_role, hub_id, current_user_id)
    ON CONFLICT (user_id, role, hub_id) DO NOTHING;

    RETURN FOUND;
  END;
  $body$;
  $func$;

  -- Replace remove_user_role_with_audit to accept optional hub_id
  EXECUTE $func$
  CREATE OR REPLACE FUNCTION public.remove_user_role_with_audit(
    target_user_id uuid,
    old_role public.user_role,
    hub_id uuid DEFAULT NULL,
    requester_ip inet DEFAULT NULL,
    requester_user_agent text DEFAULT NULL
  )
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public
  AS $body$
  DECLARE
    requester_id uuid;
  BEGIN
    requester_id := auth.uid();

    -- If hub_id is NULL, this is a global role removal; only super_admins may do that
    IF hub_id IS NULL THEN
      IF NOT public.is_super_admin(requester_id) THEN
        RAISE EXCEPTION 'Access denied: only super admins can remove global roles';
      END IF;
    ELSE
      -- If hub_id provided, allow removal if requester is super_admin or admin/hub_manager for that hub
      IF NOT public.is_super_admin(requester_id) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = requester_id
            AND ur.hub_id = hub_id
            AND ur.role IN ('admin','hub_manager')
        ) THEN
          RAISE EXCEPTION 'Access denied: not authorized to remove roles for this hub';
        END IF;
      END IF;
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = target_user_id
      AND role = old_role
      AND (hub_id IS NULL AND hub_id IS NULL OR hub_id = hub_id);

    RETURN true;
  END;
  $body$;
  $func$;
END
$$;
