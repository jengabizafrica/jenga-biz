-- Ensure required unique constraints exist to support ON CONFLICT usage

-- 1) user_subscriptions requires UNIQUE (user_id, plan_id) for assign_free_tier_on_signup()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_subscriptions_user_plan_key'
  ) THEN
    ALTER TABLE public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_plan_key UNIQUE (user_id, plan_id);
  END IF;
END $$;

-- 2) geographic_analytics upsert path requires UNIQUE (country_code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geographic_analytics_country_code_key'
  ) THEN
    ALTER TABLE public.geographic_analytics
    ADD CONSTRAINT geographic_analytics_country_code_key UNIQUE (country_code);
  END IF;
END $$;