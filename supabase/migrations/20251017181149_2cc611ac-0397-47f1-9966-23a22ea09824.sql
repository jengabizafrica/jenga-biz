-- Add support for multiple billing cycles with different prices per subscription plan

-- 1. Add new columns to subscription_plans table
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS prices jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS available_cycles text[] DEFAULT ARRAY['monthly']::text[];

-- 2. Migrate existing data to new structure
UPDATE public.subscription_plans
SET prices = jsonb_build_object(
  billing_cycle, 
  jsonb_build_object('price', price, 'currency', currency)
),
available_cycles = ARRAY[billing_cycle]
WHERE prices = '{}'::jsonb;

-- 3. Add new columns to user_subscriptions for tracking chosen billing cycle
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS price_paid numeric;

-- 4. Migrate existing subscription data
UPDATE public.user_subscriptions us
SET billing_cycle = sp.billing_cycle,
    price_paid = sp.price
FROM public.subscription_plans sp
WHERE us.plan_id = sp.id
  AND us.billing_cycle IS NULL;

-- 5. Add helpful comment
COMMENT ON COLUMN public.subscription_plans.prices IS 'JSONB object with billing cycles as keys: {"monthly": {"price": 100, "currency": "KES"}, "quarterly": {"price": 270, "currency": "KES"}, "yearly": {"price": 1000, "currency": "KES"}}';
COMMENT ON COLUMN public.subscription_plans.available_cycles IS 'Array of available billing cycle options for this plan';

-- 6. Keep legacy columns for backward compatibility during transition
-- (price, currency, billing_cycle remain but are now supplementary to the prices JSONB)