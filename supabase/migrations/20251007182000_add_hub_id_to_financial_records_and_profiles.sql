-- Add hub_id to financial_records and profiles, and backfill from businesses
-- Run in staging first; ensure backups exist before applying to production.

BEGIN;

-- 1) Add hub_id column to financial_records if not exists
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS hub_id uuid NULL;

-- Add foreign key constraint if hubs table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='hubs') THEN
    BEGIN
      ALTER TABLE public.financial_records
        ADD CONSTRAINT IF NOT EXISTS fk_financial_records_hub
        FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      -- ignore
    END;
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

-- 4) Add hub_id to profiles (nullable) to capture organization membership
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_id uuid NULL REFERENCES public.hubs(id);

CREATE INDEX IF NOT EXISTS idx_profiles_hub_id ON public.profiles(hub_id);

COMMIT;
