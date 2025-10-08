-- Add soft-delete audit columns to invite_codes
-- Adds deleted_by (uuid) and deleted_at (timestamptz) so Edge Functions can record soft-deletes
-- Non-destructive: adds columns if they do not already exist and creates an index

DO $$
BEGIN
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
END$$;

-- Create index on deleted_at for fast lookups of active records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'invite_codes' AND indexname = 'invite_codes_deleted_at_idx'
  ) THEN
    CREATE INDEX invite_codes_deleted_at_idx ON public.invite_codes (deleted_at);
  END IF;
END$$;

-- Optionally create FK to profiles.id if the profiles table and id column exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    -- Add FK constraint only if not already present
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = 'invite_codes' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'deleted_by'
    ) THEN
      BEGIN
        ALTER TABLE public.invite_codes
          ADD CONSTRAINT invite_codes_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN
        -- ignore
        NULL;
      END;
    END IF;
  END IF;
END$$;
