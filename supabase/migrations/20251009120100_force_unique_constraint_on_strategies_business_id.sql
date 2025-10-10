DO $$
BEGIN
	-- Only attempt to add the UNIQUE constraint if the strategies table exists.
	-- If it doesn't exist (e.g. running against a fresh shadow DB), skip safely.
	IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'strategies') THEN
		-- Check whether the named constraint already exists to make this idempotent
		IF NOT EXISTS (
			SELECT 1
			FROM information_schema.table_constraints tc
			WHERE tc.table_schema = 'public'
				AND tc.table_name = 'strategies'
				AND tc.constraint_name = 'unique_business_strategy'
		) THEN
			-- Use EXECUTE to defer parse-time validation and fail loudly if duplicates exist
			EXECUTE 'ALTER TABLE public.strategies ADD CONSTRAINT unique_business_strategy UNIQUE (business_id)';
		ELSE
			RAISE NOTICE 'Constraint unique_business_strategy already exists on public.strategies; skipping.';
		END IF;
	ELSE
		RAISE NOTICE 'Skipping add unique constraint on public.strategies: table does not exist.';
	END IF;
END$$;

-- If the above fails due to duplicates, inspect duplicates and resolve before re-running.
