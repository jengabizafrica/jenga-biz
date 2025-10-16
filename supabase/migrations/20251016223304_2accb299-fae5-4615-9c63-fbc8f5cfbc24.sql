-- Create RPC function for setting system settings
CREATE OR REPLACE FUNCTION set_system_setting(
  p_key text,
  p_value text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  old_value text;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is super admin
  IF NOT public.is_super_admin(current_user_id) THEN
    RAISE EXCEPTION 'Access denied: only super admins can modify settings';
  END IF;
  
  -- Get old value for audit
  SELECT value INTO old_value 
  FROM public.app_settings 
  WHERE key = p_key;
  
  -- Upsert the setting
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (p_key, p_value, now())
  ON CONFLICT (key)
  DO UPDATE SET
    value = p_value,
    updated_at = now();
  
  -- Create audit record
  INSERT INTO public.settings_audit (
    setting_key,
    old_value,
    new_value,
    changed_by
  ) VALUES (
    p_key,
    old_value,
    p_value,
    current_user_id
  );
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION set_system_setting(text, text, text) IS 
'Set a system setting with super admin check and audit trail';
