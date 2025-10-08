-- Add hub_id to profiles and backfill conservatively from businesses
-- Non-destructive additions followed by a conservative backfill.

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

-- Create index on profiles.hub_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles' AND indexname = 'profiles_hub_id_idx'
  ) THEN
    CREATE INDEX profiles_hub_id_idx ON public.profiles (hub_id);
  END IF;
END$$;

-- Add foreign key to hubs.id if the hubs table exists and constraint not present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hubs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = 'profiles' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'hub_id'
    ) THEN
      BEGIN
        ALTER TABLE public.profiles
          ADD CONSTRAINT profiles_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END;
    END IF;
  END IF;
END$$;

-- Conservative backfill: assign profiles.hub_id from businesses.hub_id when business.user_id maps to profile.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'hub_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'user_id'
  ) THEN
    -- Only update profiles that don't already have a hub_id and where the business has a hub_id
    UPDATE public.profiles p
    SET hub_id = b.hub_id
    FROM public.businesses b
    WHERE p.id = b.user_id
      AND p.hub_id IS NULL
      AND b.hub_id IS NOT NULL;
  END IF;
END$$;

-- NOTE: This mapping assumes businesses.user_id references profiles.id. If your ownership model differs (e.g., owner_id), adjust accordingly.
