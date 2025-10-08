-- DRAFT: Add hub_id to profiles and conservative backfill
-- This migration is intentionally conservative and should be reviewed before applying.

-- Add the hub_id column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hub_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN hub_id uuid;
  END IF;
END$$;

-- Create an index for hub_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles' AND indexname = 'profiles_hub_id_idx'
  ) THEN
    CREATE INDEX profiles_hub_id_idx ON public.profiles (hub_id);
  END IF;
END$$;

-- Conservative backfill suggestion (not executed automatically):
-- For entrepreneur users who also have a business record, map the profile to the hub of that business.
-- The following SQL is provided for manual review and execution in a controlled window.
--
-- UPDATE public.profiles p
-- SET hub_id = b.hub_id
-- FROM public.businesses b
-- WHERE p.id = b.owner_id AND p.hub_id IS NULL AND b.hub_id IS NOT NULL;
--
-- NOTE: The mapping between profile.id and business.owner_id (or similar) must be confirmed before applying.
