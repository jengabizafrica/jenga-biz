-- Migration: Add UNIQUE constraint on strategies.business_id with pre-check for duplicates
-- Generated: 2025-10-05

DO $$
BEGIN
  -- Skip if the strategies table doesn't exist yet (safe for shadow DB runs)
  IF to_regclass('public.strategies') IS NULL THEN
    RAISE NOTICE 'Skipping unique constraint on strategies.business_id: public.strategies does not exist yet.';
    RETURN;
  END IF;

  DECLARE
    dup_count integer;
    dup_list text;
  BEGIN
    -- Count business_id occurrences excluding NULLs
    SELECT count(*) INTO dup_count
    FROM (
      SELECT business_id
      FROM public.strategies
      WHERE business_id IS NOT NULL
      GROUP BY business_id
      HAVING count(*) > 1
    ) t;

    IF dup_count > 0 THEN
      -- Build a sample list of offending business_ids
      SELECT string_agg(business_id::text, ', ' ORDER BY business_id) INTO dup_list
      FROM (
        SELECT business_id
        FROM public.strategies
        WHERE business_id IS NOT NULL
        GROUP BY business_id
        HAVING count(*) > 1
        LIMIT 50
      ) t;

      RAISE EXCEPTION 'Cannot add UNIQUE constraint on strategies.business_id: found % duplicate business_id groups. Sample business_ids: %', dup_count, COALESCE(dup_list, 'none');
    END IF;

    -- If no duplicates, add unique constraint if it doesn't exist (check by constraint name)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.strategies'::regclass AND c.contype = 'u' AND c.conname = 'unique_business_strategy'
    ) THEN
      ALTER TABLE public.strategies
      ADD CONSTRAINT unique_business_strategy UNIQUE (business_id);
    END IF;
  END;
END $$

-- Note: If you want stricter detection, run a separate query to list all duplicate rows for manual resolution before applying.
