-- Add hub_id column to invite_codes (nullable) - non-destructive
-- Adds an optional foreign key to public.hubs if that table exists

DO $$
BEGIN
  -- Only attempt to add the column if the table exists. If the table is missing (shadow DB) skip safely.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invite_codes') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invite_codes'
        AND column_name = 'hub_id'
    ) THEN
      ALTER TABLE public.invite_codes
        ADD COLUMN hub_id uuid;
    ELSE
      RAISE NOTICE 'Column public.invite_codes.hub_id already exists; skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping add_hub_id_to_invite_codes: table public.invite_codes does not exist.';
  END IF;
END$$
;
-- Create an index for faster lookups when hub_id is present
DO $$
BEGIN
  -- Create an index for faster lookups when hub_id is present, but only if the table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invite_codes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'invite_codes' AND indexname = 'invite_codes_hub_id_idx'
    ) THEN
      CREATE INDEX invite_codes_hub_id_idx ON public.invite_codes (hub_id);
    ELSE
      RAISE NOTICE 'Index invite_codes_hub_id_idx already exists; skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping index creation on public.invite_codes: table does not exist.';
  END IF;
END$$
;
-- Optionally add foreign key constraint if hubs table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hubs'
  ) THEN
    -- Add constraint only if it doesn't already exist and invite_codes table is present
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invite_codes') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'invite_codes' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'hub_id'
      ) THEN
        ALTER TABLE public.invite_codes
          ADD CONSTRAINT invite_codes_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL;
      END IF;
    ELSE
      RAISE NOTICE 'Skipping invite_codes_hub_id_fkey creation: table public.invite_codes does not exist.';
    END IF;
  END IF;
END$$;
