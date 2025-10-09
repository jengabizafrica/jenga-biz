-- Make new_role nullable in role_change_audit for any removal of role
DO $$
BEGIN
	IF to_regclass('public.role_change_audit') IS NOT NULL THEN
		ALTER TABLE public.role_change_audit
		ALTER COLUMN new_role DROP NOT NULL;
	ELSE
		RAISE NOTICE 'Skipping ALTER: role_change_audit does not exist yet';
	END IF;
END
$$;
