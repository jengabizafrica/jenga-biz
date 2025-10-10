-- Migration: Create update_hubs_updated_at trigger safely
-- Generated: 2025-10-09

DO $$
BEGIN
  -- Only create the trigger if the helper function exists and the trigger is not already created.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_hubs_updated_at') THEN
      CREATE TRIGGER update_hubs_updated_at
      BEFORE UPDATE ON public.hubs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  ELSE
    RAISE NOTICE 'update_updated_at_column() not found; skipping creation of update_hubs_updated_at trigger.';
  END IF;
END$$;
