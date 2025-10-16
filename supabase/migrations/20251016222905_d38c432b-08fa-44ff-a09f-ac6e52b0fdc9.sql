-- =========================================================
-- Multi-Billing Cycle & B2C Subscription System Updates
-- =========================================================

-- 1. Ensure subscription_plans supports quarterly billing
-- (billing_cycle already exists as varchar, so we just need to ensure quarterly is valid)
-- No table changes needed - billing_cycle is flexible text field

-- 2. Create Free tier plan if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM subscription_plans WHERE name = 'Free' AND billing_cycle = 'monthly'
  ) THEN
    INSERT INTO subscription_plans (name, description, price, currency, billing_cycle, features, is_active)
    VALUES (
      'Free',
      'Free tier with 14-day full access trial, then basic features',
      0,
      'USD',
      'monthly',
      '{
        "trial_days": 14,
        "max_projects": 1,
        "max_milestones": 20,
        "max_receipts_per_month": 100,
        "ai_summaries": "lite",
        "share_unlimited": true,
        "downloads_per_month": 5,
        "milestone_stages": ["concept", "early_stage"],
        "milestone_suggestions": true,
        "ocr_enabled": true
      }'::jsonb,
      true
    );
  END IF;
END $$;

-- 3. Extend app_settings for new features
-- Add maintenance_mode setting
INSERT INTO app_settings (key, value, description)
VALUES (
  'maintenance_mode',
  'false',
  'When enabled, bypasses subscription gating for all users'
)
ON CONFLICT (key) DO NOTHING;

-- Add allowed_currencies setting (comma-separated list)
INSERT INTO app_settings (key, value, description)
VALUES (
  'allowed_currencies',
  'USD,KES,EUR,GBP',
  'Comma-separated list of currencies available in the application'
)
ON CONFLICT (key) DO NOTHING;

-- Add paystack_webhook_url setting
INSERT INTO app_settings (key, value, description)
VALUES (
  'paystack_webhook_url',
  'https://diclwatocrixibjpajuf.supabase.co/functions/v1/subscriptions/paystack/webhook',
  'Paystack webhook URL for subscription updates'
)
ON CONFLICT (key) DO NOTHING;

-- 4. Create function to assign free tier on user signup
CREATE OR REPLACE FUNCTION assign_free_tier_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id uuid;
BEGIN
  -- Get the free plan ID
  SELECT id INTO free_plan_id
  FROM subscription_plans
  WHERE name = 'Free' AND is_active = true
  LIMIT 1;

  -- Only assign if a free plan exists
  IF free_plan_id IS NOT NULL THEN
    -- Insert free subscription for the new user
    INSERT INTO user_subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    ) VALUES (
      NEW.id,
      free_plan_id,
      'active',
      NOW(),
      NOW() + INTERVAL '14 days' -- 14-day trial
    )
    ON CONFLICT (user_id, plan_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Create trigger to assign free tier on user creation
DROP TRIGGER IF EXISTS assign_free_tier_trigger ON auth.users;
CREATE TRIGGER assign_free_tier_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_free_tier_on_signup();

-- 6. Add email confirmation tracking columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMP WITH TIME ZONE;

-- 7. Update pending_approvals to block org users until approved
-- Add a function to check if org user is approved
CREATE OR REPLACE FUNCTION is_org_approved(p_user_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM pending_approvals
    WHERE user_id = p_user_id
      AND status = 'pending'
  ) OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_user_id
      AND account_type != 'organization'
  );
$$;

-- 8. Create RLS policy helper for org approval check
CREATE OR REPLACE FUNCTION user_can_interact()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_org_approved(auth.uid());
$$;

COMMENT ON FUNCTION assign_free_tier_on_signup() IS 
'Automatically assigns the Free tier subscription to new users upon signup';

COMMENT ON FUNCTION is_org_approved(uuid) IS 
'Checks if an organization user has been approved by super admin';

COMMENT ON FUNCTION user_can_interact() IS 
'Helper function for RLS policies to check if user can interact with the system';
