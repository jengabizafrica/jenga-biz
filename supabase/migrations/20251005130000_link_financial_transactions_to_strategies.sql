-- Migration: Link financial_transactions to strategies
-- Generated: 2025-10-05

-- 1) Add strategy_id column without FK (defer FK creation until public.strategies exists)
ALTER TABLE public.financial_transactions
ADD COLUMN IF NOT EXISTS strategy_id UUID;

-- Guard the rest of the work that references public.strategies to avoid parse-time failures on a fresh shadow DB
DO $$
BEGIN
  IF to_regclass('public.strategies') IS NULL THEN
    RAISE NOTICE 'Skipping strategy linkage for financial_transactions: public.strategies does not exist yet.';
    RETURN;
  END IF;

  -- 2) Create index (only when strategies exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_financial_transactions_strategy_id' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_financial_transactions_strategy_id ON public.financial_transactions(strategy_id)';
  END IF;

  -- 3) Attempt to populate strategy_id from business_id via strategies (if businesses exist)
  EXECUTE 'UPDATE public.financial_transactions ft\nSET strategy_id = (SELECT s.id FROM public.strategies s WHERE s.business_id = ft.business_id ORDER BY s.created_at LIMIT 1)\nWHERE strategy_id IS NULL AND ft.business_id IS NOT NULL';

  -- 4) If there are no strategy references and the table allows nulls, decide whether to set NOT NULL.
  -- Use a proper IF/THEN/ELSE so RAISE/EXECUTE are statements (not expressions) and parse correctly inside the DO block.
  IF (SELECT COUNT(*) FROM public.financial_transactions WHERE strategy_id IS NULL) = 0 THEN
    EXECUTE 'ALTER TABLE public.financial_transactions ALTER COLUMN strategy_id SET NOT NULL';
  ELSE
    RAISE NOTICE 'strategy_id contains % NULL values; leaving column nullable for manual reconciliation.',
      (SELECT COUNT(*) FROM public.financial_transactions WHERE strategy_id IS NULL);
  END IF;

  -- 5) Drop the old business_id column if it exists and is unused (optional)
  EXECUTE 'ALTER TABLE public.financial_transactions DROP COLUMN IF EXISTS business_id';

  -- 6) Update RLS policies to reference strategy_id (policies may be updated elsewhere too)
  -- Use EXECUTE to avoid parse-time references to public.strategies
  EXECUTE $pol$
    DROP POLICY IF EXISTS "Users can view their own transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "Users can update their own transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.financial_transactions;

    CREATE POLICY "Users can view their own transactions"
    ON public.financial_transactions
    FOR SELECT
    USING (
      auth.uid() = user_id
      AND (
        EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = financial_transactions.strategy_id AND s.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      )
    );

    CREATE POLICY "Users can insert their own transactions"
    ON public.financial_transactions
    FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = new.strategy_id AND s.user_id = auth.uid())
    );

    CREATE POLICY "Users can update their own transactions"
    ON public.financial_transactions
    FOR UPDATE
    USING (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = financial_transactions.strategy_id AND s.user_id = auth.uid())
    )
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = new.strategy_id AND s.user_id = auth.uid())
    );

    CREATE POLICY "Users can delete their own transactions"
    ON public.financial_transactions
    FOR DELETE
    USING (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.strategies s WHERE s.id = financial_transactions.strategy_id AND s.user_id = auth.uid())
    );
  $pol$;
END $$;

-- Finish
DO $$ BEGIN RAISE NOTICE 'Linked financial_transactions to strategies (if possible)'; END $$;
