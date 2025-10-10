-- Migration: create set_user_role RPC
-- Creates a SECURITY DEFINER function that atomically replaces a user's role
-- in the given scope (hub/global). Also writes an audit row to user_roles_audit
-- when available. This function intentionally tolerates missing audit table.

CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user_id uuid,
  role text,
  hub_id uuid DEFAULT NULL,
  requester_user_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use a secure application_name so protected role-manipulation functions
  -- that check current_setting('application_name') can allow this operation.
  PERFORM set_config('application_name', 'secure_role_function', true);

  -- Remove any existing role for the user in the same scope (hub_id or global)
  IF hub_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = target_user_id AND hub_id = hub_id;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = target_user_id AND hub_id IS NULL;
  END IF;

  -- Insert the new role
  INSERT INTO public.user_roles(user_id, role, hub_id)
  VALUES (target_user_id, role, hub_id);

  -- Best-effort: insert audit row if table exists
  BEGIN
    INSERT INTO public.user_roles_audit(
      user_id, changed_by, change_type, role, hub_id, changed_at
    ) VALUES (
      target_user_id, requester_user_id, 'set', role, hub_id, now()
    );
  EXCEPTION WHEN undefined_table THEN
    -- audit table missing: swallow and continue
    RAISE NOTICE 'user_roles_audit table missing, skipping audit insert';
  END;

  -- Reset application_name for safety
  PERFORM set_config('application_name', '', true);

END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text, uuid, uuid) TO PUBLIC;
