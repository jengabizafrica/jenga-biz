-- Migration: Migrate relationships, drop businesses.strategy_id, update RLS policies
-- Generated: 2025-10-05

-- 1) Migrate existing relationships (if any) from businesses.strategy_id to strategies.business_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'strategy_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'strategies' AND column_name = 'business_id'
  ) THEN

    -- Copy relationship: for each business that pointed to a strategy, set that strategy's business_id to the business id
    UPDATE public.strategies s
    SET business_id = b.id
    FROM public.businesses b
    WHERE b.strategy_id IS NOT NULL
      AND b.strategy_id = s.id
      AND s.business_id IS NULL;
  END IF;
END $$;

-- 2) Drop the index on businesses.strategy_id if it exists
DROP INDEX IF EXISTS idx_businesses_strategy_id;

-- 3) Drop the strategy_id column from businesses
ALTER TABLE public.businesses DROP COLUMN IF EXISTS strategy_id;

-- 4) Recreate RLS policies for businesses to reference strategies.business_id
DO $$
BEGIN
    -- Drop old policies if they exist
    DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
    DROP POLICY IF EXISTS "Users can manage their own businesses" ON public.businesses;

  -- Create new policies referencing strategies.business_id -> businesses.id
  IF to_regclass('public.strategies') IS NOT NULL THEN
    -- Use EXECUTE so the SQL referencing public.strategies isn't parsed unless the table exists
    EXECUTE $sql$
    CREATE POLICY "Users can view their own businesses"
    ON public.businesses
    FOR SELECT
    USING (
      auth.uid() = user_id OR
      EXISTS (
        SELECT 1 FROM public.strategies s
        WHERE s.business_id = businesses.id AND s.user_id = auth.uid()
      )
    );
    $sql$;

    EXECUTE $sql$
    CREATE POLICY "Users can manage their own businesses"
    ON public.businesses
    FOR ALL
    USING (
      auth.uid() = user_id OR
      EXISTS (
        SELECT 1 FROM public.strategies s
        WHERE s.business_id = businesses.id AND s.user_id = auth.uid()
      )
    )
    WITH CHECK (
      auth.uid() = user_id OR
      EXISTS (
        SELECT 1 FROM public.strategies s
        WHERE s.business_id = businesses.id AND s.user_id = auth.uid()
      )
    );
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping creation of businesses policies referencing public.strategies: public.strategies does not exist yet.';
  END IF;
END $$;

-- Note: If you have other policies or functions referencing businesses.strategy_id, update them accordingly.
