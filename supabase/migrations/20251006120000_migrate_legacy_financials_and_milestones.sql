-- Migrate data from legacy tables (business_milestones, financial_records) to canonical tables (milestones, financial_transactions)
BEGIN;

-- 1) Ensure target columns exist
ALTER TABLE IF EXISTS public.milestones
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE IF EXISTS public.financial_transactions
  ADD COLUMN IF NOT EXISTS transaction_date date;

-- 2) Copy business_milestones -> milestones (avoid duplicates)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_milestones') THEN
    INSERT INTO public.milestones (id, user_id, strategy_id, title, target_date, status, business_stage, created_at, updated_at, completed_at)
    SELECT bm.id, NULL::uuid, bm.strategy_id, bm.milestone_type::text AS title, NULL::timestamptz AS target_date, NULL::text AS status, NULL::text AS business_stage, bm.created_at, bm.created_at, bm.completed_at
    FROM public.business_milestones bm
    ON CONFLICT (id) DO NOTHING;
  END IF;
END$$;

-- 3) Copy financial_records -> financial_transactions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_records') THEN
    -- Ensure the target table exists and has the required columns before attempting the INSERT.
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_transactions') THEN
      RAISE NOTICE 'Skipping financial_records -> financial_transactions: target table public.financial_transactions does not exist.';
      RETURN;
    END IF;

    DECLARE
      req_count int;
    BEGIN
      SELECT COUNT(*) INTO req_count
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_transactions'
        AND column_name IN ('id','user_id','strategy_id','amount','category','description','currency','transaction_date','created_at','updated_at');

      IF req_count <> 10 THEN
        RAISE NOTICE 'Skipping financial_records -> financial_transactions: target table missing required columns (found % of 10).', req_count;
        RETURN;
      END IF;
    END;

    INSERT INTO public.financial_transactions (id, user_id, strategy_id, amount, category, description, currency, transaction_date, created_at, updated_at)
    SELECT fr.id, NULL::uuid, fr.strategy_id, COALESCE(fr.revenue,0) - COALESCE(fr.expenses,0) AS amount,
           CASE WHEN COALESCE(fr.revenue,0) - COALESCE(fr.expenses,0) >= 0 THEN 'revenue' ELSE 'expense' END AS category,
           fr.notes AS description, COALESCE(fr.currency,'') AS currency, fr.record_date::date AS transaction_date, fr.created_at, fr.updated_at
    FROM public.financial_records fr
    ON CONFLICT (id) DO NOTHING;
  END IF;
END$$;

-- 4) Optionally drop legacy tables if empty after migration
-- We'll only drop if the table exists and has zero rows (safety)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_milestones') THEN
    IF (SELECT count(*) FROM public.business_milestones) = 0 THEN
      DROP TABLE public.business_milestones CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_records') THEN
    IF (SELECT count(*) FROM public.financial_records) = 0 THEN
      DROP TABLE public.financial_records CASCADE;
    END IF;
  END IF;
END$$;

-- 5) Rebuild any dependent RLS policies / indexes if needed (no-op if not present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'milestones') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_milestones_strategy_id ON public.milestones(strategy_id)';
  ELSE
    RAISE NOTICE 'Skipping index creation on public.milestones: table does not exist.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_transactions') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_financial_transactions_strategy_id ON public.financial_transactions(strategy_id)';
  ELSE
    RAISE NOTICE 'Skipping index creation on public.financial_transactions: table does not exist.';
  END IF;
END$$;
COMMIT;

-- Note: This migration intentionally avoids destructive drops if legacy tables contain data. Review the tables and run another migration to drop them after verification.
