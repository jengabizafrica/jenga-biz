-- Migration: Update RLS policies to consistently use strategies.business_id ownership checks where relevant
-- NOTE: Renamed from 20251005121000 to avoid local/remote migration version collision
-- Generated (renamed): 2025-10-09

DO $$
BEGIN
  -- Businesses table: ensure policies allow access if user owns the business or owns a strategy referencing the business
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'businesses') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses';
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own businesses" ON public.businesses';
  END IF;

  -- Create business policies. If the strategies table exists create richer policies that reference strategies,
  -- otherwise create conservative policies that only rely on businesses (safe for fresh shadow DBs).
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'strategies') THEN
    -- strategies table exists: create policies that reference it. Use EXECUTE to defer parsing until runtime.
    EXECUTE $policy$
    CREATE POLICY "Users can view their own businesses"
    ON public.businesses
    FOR SELECT
    USING (
      auth.uid() = user_id OR
      (
        EXISTS (SELECT 1 FROM public.strategies s WHERE s.business_id = businesses.id AND s.user_id = auth.uid())
      ) OR public.is_admin_or_hub_manager(auth.uid())
    );
    $policy$;

    EXECUTE $policy$
    CREATE POLICY "Users can manage their own businesses"
    ON public.businesses
    FOR ALL
    USING (
      auth.uid() = user_id OR
      (
        EXISTS (SELECT 1 FROM public.strategies s WHERE s.business_id = businesses.id AND s.user_id = auth.uid())
      ) OR public.is_admin_or_hub_manager(auth.uid())
    )
    WITH CHECK (
      auth.uid() = user_id OR
      (
        EXISTS (SELECT 1 FROM public.strategies s WHERE s.business_id = businesses.id AND s.user_id = auth.uid())
      ) OR public.is_admin_or_hub_manager(auth.uid())
    );
    $policy$;
  ELSE
    -- strategies table missing: create safer policies that avoid referencing strategies
  EXECUTE $policy$
  CREATE POLICY "Users can view their own businesses"
  ON public.businesses
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_hub_manager(auth.uid()));
  $policy$;

  EXECUTE $policy$
  CREATE POLICY "Users can manage their own businesses"
  ON public.businesses
  FOR ALL
  USING (auth.uid() = user_id OR public.is_admin_or_hub_manager(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_hub_manager(auth.uid()));
  $policy$;
  END IF;

  -- Financial records: create policies. Use strategies-aware policies when the strategy_id column (and strategies table) exist.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_records') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage financial records for their businesses" ON public.financial_records';
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage financial records for their businesses or hub businesses" ON public.financial_records';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_records' AND column_name = 'strategy_id')
     AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'strategies') THEN
    -- Create strategies-aware policy using EXECUTE to defer parsing
    EXECUTE $policy$
    CREATE POLICY "Users can manage financial records for their businesses"
    ON public.financial_records
    FOR ALL
    USING (
      auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_records.strategy_id)
      OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_records.business_id AND (b.user_id = auth.uid() OR public.is_admin_or_hub_manager(auth.uid())))
    )
    WITH CHECK (
      auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_records.strategy_id)
      OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_records.business_id AND (b.user_id = auth.uid() OR public.is_admin_or_hub_manager(auth.uid())))
    );
    $policy$;
  ELSE
    -- Fallback: business-based checks only
    EXECUTE $policy$
    CREATE POLICY "Users can manage financial records for their businesses"
    ON public.financial_records
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_records.business_id AND (b.user_id = auth.uid() OR public.is_admin_or_hub_manager(auth.uid())))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_records.business_id AND (b.user_id = auth.uid() OR public.is_admin_or_hub_manager(auth.uid())))
    );
    $policy$;
  END IF;

  -- Business milestones: ensure ownership checks use strategies when appropriate
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_milestones') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own milestones" ON public.business_milestones';
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own milestones" ON public.business_milestones';
  END IF;

  -- Milestones: only attempt to create policies if the table exists. This prevents
  -- CREATE POLICY calls from failing on fresh shadow DBs where the table is absent.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_milestones') THEN
    -- Milestones: create policies, preferring strategies-aware policies when strategy_id exists and strategies table is present
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_milestones' AND column_name = 'strategy_id')
       AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'strategies') THEN
      EXECUTE $policy$
      CREATE POLICY "Users can view their own milestones"
      ON public.business_milestones
      FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = business_milestones.strategy_id AND s.user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_milestones.business_id AND b.user_id = auth.uid())
      );
      $policy$;

      EXECUTE $policy$
      CREATE POLICY "Users can manage their own milestones"
      ON public.business_milestones
      FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = business_milestones.strategy_id AND s.user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_milestones.business_id AND b.user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = business_milestones.strategy_id AND s.user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_milestones.business_id AND b.user_id = auth.uid())
      );
      $policy$;
    ELSE
      EXECUTE $policy$
      CREATE POLICY "Users can view their own milestones"
      ON public.business_milestones
      FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_milestones.business_id AND b.user_id = auth.uid())
      );
      $policy$;

      EXECUTE $policy$
      CREATE POLICY "Users can manage their own milestones"
      ON public.business_milestones
      FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_milestones.business_id AND b.user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_milestones.business_id AND b.user_id = auth.uid())
      );
      $policy$;
    END IF;
  END IF;

  -- Financial transactions policies (if table exists)
  -- Financial transactions: create policies only if table exists and refer to strategy_id when present
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_transactions') THEN
    DROP POLICY IF EXISTS "Users can view their own transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "Users can update their own transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.financial_transactions;

    -- Check which columns exist and create policies accordingly
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_transactions' AND column_name = 'strategy_id')
     AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'strategies') THEN
      -- strategy_id exists
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_transactions' AND column_name = 'business_id') THEN
        -- both strategy_id and business_id exist
        EXECUTE $policy$
        CREATE POLICY "Users can view their own transactions"
        ON public.financial_transactions
        FOR SELECT
        USING (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_transactions.strategy_id)
          OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_transactions.business_id AND b.user_id = auth.uid())
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can insert their own transactions"
        ON public.financial_transactions
        FOR INSERT
        WITH CHECK (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = strategy_id)
          OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid())
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can update their own transactions"
        ON public.financial_transactions
        FOR UPDATE
        USING (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_transactions.strategy_id)
          OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_transactions.business_id AND b.user_id = auth.uid())
        )
        WITH CHECK (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = strategy_id)
          OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid())
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can delete their own transactions"
        ON public.financial_transactions
        FOR DELETE
        USING (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_transactions.strategy_id)
          OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_transactions.business_id AND b.user_id = auth.uid())
        );
        $policy$;
      ELSE
        -- only strategy_id exists
        EXECUTE $policy$
        CREATE POLICY "Users can view their own transactions"
        ON public.financial_transactions
        FOR SELECT
        USING (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_transactions.strategy_id)
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can insert their own transactions"
        ON public.financial_transactions
        FOR INSERT
        WITH CHECK (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = strategy_id)
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can update their own transactions"
        ON public.financial_transactions
        FOR UPDATE
        USING (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_transactions.strategy_id)
        )
        WITH CHECK (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = strategy_id)
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can delete their own transactions"
        ON public.financial_transactions
        FOR DELETE
        USING (
          auth.uid() = (SELECT user_id FROM public.strategies WHERE id = financial_transactions.strategy_id)
        );
        $policy$;
      END IF;
    ELSE
      -- strategy_id doesn't exist
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_transactions' AND column_name = 'business_id') THEN
        -- only business_id exists
        EXECUTE $policy$
        CREATE POLICY "Users can view their own transactions"
        ON public.financial_transactions
        FOR SELECT
        USING (
          EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_transactions.business_id AND b.user_id = auth.uid())
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can insert their own transactions"
        ON public.financial_transactions
        FOR INSERT
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid())
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can update their own transactions"
        ON public.financial_transactions
        FOR UPDATE
        USING (
          EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_transactions.business_id AND b.user_id = auth.uid())
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid())
        );
        $policy$;

        EXECUTE $policy$
        CREATE POLICY "Users can delete their own transactions"
        ON public.financial_transactions
        FOR DELETE
        USING (
          EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_transactions.business_id AND b.user_id = auth.uid())
        );
        $policy$;
      ELSE
        -- Neither strategy_id nor business_id exist; create conservative policies (admins only)
  EXECUTE $policy$
  CREATE POLICY "Users can view their own transactions"
  ON public.financial_transactions
  FOR SELECT
  USING (public.is_admin_or_hub_manager(auth.uid()));
  $policy$;

  EXECUTE $policy$
  CREATE POLICY "Users can insert their own transactions"
  ON public.financial_transactions
  FOR INSERT
  WITH CHECK (public.is_admin_or_hub_manager(auth.uid()));
  $policy$;

  EXECUTE $policy$
  CREATE POLICY "Users can update their own transactions"
  ON public.financial_transactions
  FOR UPDATE
  USING (public.is_admin_or_hub_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_hub_manager(auth.uid()));
  $policy$;

  EXECUTE $policy$
  CREATE POLICY "Users can delete their own transactions"
  ON public.financial_transactions
  FOR DELETE
  USING (public.is_admin_or_hub_manager(auth.uid()));
  $policy$;
      END IF;
    END IF;
  END IF;

END $$;
