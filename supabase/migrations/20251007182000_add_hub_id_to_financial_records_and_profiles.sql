-- Add hub_id to financial_records and profiles, and backfill from businesses
-- Run in staging first; ensure backups exist before applying to production.

BEGIN;

-- 1) Add hub_id column to financial_records if not exists
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS hub_id uuid NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='hubs') THEN
    -- Ensure the target table exists and the constraint is not already present
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_records') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'financial_records' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'hub_id'
      ) THEN
        EXECUTE 'ALTER TABLE public.financial_records ADD CONSTRAINT fk_financial_records_hub FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL';
      ELSE
        RAISE NOTICE 'FK fk_financial_records_hub already exists; skipping.';
      END IF;
    ELSE
      RAISE NOTICE 'Skipping FK creation for financial_records.hub_id: table public.financial_records does not exist.';
    END IF;
  END IF;
END$$;

-- 2) Backfill hub_id in financial_records from businesses
UPDATE public.financial_records fr
SET hub_id = b.hub_id
FROM public.businesses b
WHERE fr.business_id = b.id AND fr.hub_id IS NULL;

-- 3) Add index for performance
CREATE INDEX IF NOT EXISTS idx_financial_records_hub_id ON public.financial_records(hub_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_record_date ON public.financial_records(record_date);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_hub_id ON public.profiles(hub_id);

-- Guarded FK creation for profiles.hub_id -> hubs(id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='hubs') THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'profiles' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'hub_id'
      ) THEN
        EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL';
      ELSE
        RAISE NOTICE 'FK profiles_hub_id_fkey already exists; skipping.';
      END IF;
    ELSE
      RAISE NOTICE 'Skipping FK creation for profiles.hub_id: table public.profiles does not exist.';
    END IF;
  END IF;
END$$;

COMMIT;
