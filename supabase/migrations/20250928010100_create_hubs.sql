-- Migration: Create hubs table
CREATE TABLE IF NOT EXISTS public.hubs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  region text NULL,
  contact_email text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slug text NULL,
  admin_user_id uuid NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  CONSTRAINT hubs_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hubs_slug ON public.hubs USING btree (slug) TABLESPACE pg_default
WHERE (slug IS NOT NULL);

-- Trigger creation for `public.hubs` is intentionally deferred. A later migration will create
-- the `update_hubs_updated_at` trigger after the `update_updated_at_column()` helper is defined.
-- This avoids ordering problems when applying migrations in a fresh/shadow database.
