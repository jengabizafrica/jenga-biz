-- Add soft-delete audit columns to invite_codes
-- Adds deleted_by (uuid) and deleted_at (timestamptz) so Edge Functions can record soft-deletes
-- Non-destructive: adds columns if they do not already exist and creates an index

DO $$
BEGIN
  -- Only make column changes if the invite_codes table exists. On a fresh shadow DB this table may not exist.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invite_codes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invite_codes' AND column_name = 'deleted_by'
    ) THEN
      ALTER TABLE public.invite_codes
        ADD COLUMN deleted_by uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invite_codes' AND column_name = 'deleted_at'
    ) THEN
      ALTER TABLE public.invite_codes
        ADD COLUMN deleted_at timestamptz;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping add_deleted_audit_to_invite_codes: table public.invite_codes does not exist.';
  END IF;
END$$;

-- Create index on deleted_at for fast lookups of active records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invite_codes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'invite_codes' AND indexname = 'invite_codes_deleted_at_idx'
    ) THEN
      EXECUTE 'CREATE INDEX invite_codes_deleted_at_idx ON public.invite_codes (deleted_at)';
    ELSE
      RAISE NOTICE 'Index invite_codes_deleted_at_idx already exists; skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping index creation on public.invite_codes: table does not exist.';
  END IF;
END$$;

-- Optionally create FK to profiles.id if the profiles table and id column exist
DO $$
BEGIN
  -- Only attempt FK creation if both profiles and invite_codes tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles')
     AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invite_codes') THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = 'invite_codes' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'deleted_by'
    ) THEN
      -- Use EXECUTE to defer parsing until runtime
      EXECUTE 'ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL';
    ELSE
      RAISE NOTICE 'FK invite_codes_deleted_by_fkey already exists; skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping invite_codes deleted_by FK creation: profiles or invite_codes table does not exist.';
  END IF;
END$$;
