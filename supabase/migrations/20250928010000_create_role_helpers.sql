-- Create helper functions for role checks used by RLS policies
DO $$
BEGIN
  -- Ensure the user_role enum exists (idempotent) so helper functions can reference it
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    EXECUTE '
      CREATE TYPE public.user_role AS ENUM (''entrepreneur'', ''hub_manager'', ''admin'', ''super_admin'');
    ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE $func$
      CREATE FUNCTION public.has_role(p_user_id uuid, p_role public.user_role)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        -- If the user_roles table doesn't exist yet (fresh DB during migrations), return false
        IF to_regclass('public.user_roles') IS NULL THEN
          RETURN false;
        END IF;
        RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role);
      END;
      $body$;
    $func$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_super_admin') THEN
    EXECUTE $func$
      CREATE FUNCTION public.is_super_admin(p_user_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        RETURN public.has_role(p_user_id, 'super_admin'::user_role);
      END;
      $body$;
    $func$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_or_hub_manager') THEN
    EXECUTE $func$
      CREATE FUNCTION public.is_admin_or_hub_manager(p_user_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        RETURN (public.has_role(p_user_id, 'admin'::user_role) OR public.has_role(p_user_id, 'hub_manager'::user_role) OR public.is_super_admin(p_user_id));
      END;
      $body$;
    $func$;
  END IF;
END
$$;
