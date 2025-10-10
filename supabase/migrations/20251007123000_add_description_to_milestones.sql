-- Add description column to canonical milestones table (non-destructive)
-- This migration is idempotent and will not drop any data.
BEGIN;

-- Only add the column if it does not already exist
ALTER TABLE IF EXISTS public.milestones
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Optionally add a simple index for text search lookups (cheap)
DO $$
BEGIN
  -- Only attempt index creation if the table exists; otherwise skip with a notice (safe for shadow DB runs)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'milestones') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'milestones' AND indexname = 'idx_milestones_description'
    ) THEN
      EXECUTE 'CREATE INDEX idx_milestones_description ON public.milestones USING gin (to_tsvector(''english'', COALESCE(description, '''''')));';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping index creation on public.milestones: table does not exist.';
  END IF;
END$$;

COMMIT;

-- Note: After applying this migration, the Supabase/PostgREST schema cache should be refreshed automatically.
-- If you still see PGRST204, try reloading the REST schema via the Supabase dashboard or re-deploying the DB migrations.
