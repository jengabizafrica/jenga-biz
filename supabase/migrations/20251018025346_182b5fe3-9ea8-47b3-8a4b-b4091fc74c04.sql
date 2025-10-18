-- Fix Critical Security Issues
-- 1. Enable RLS on financial_records table and add policies
-- 2. Fix search_path on all SECURITY DEFINER functions

-- ============================================================
-- PART 1: Enable RLS on financial_records table
-- ============================================================

ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own business financial records
CREATE POLICY "Users can manage their business financials"
ON public.financial_records FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = financial_records.business_id
    AND b.user_id = auth.uid()
  )
);

-- Policy: Hub managers can view financial records for their hub businesses
CREATE POLICY "Hub managers can view their hub financials"
ON public.financial_records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = financial_records.business_id
    AND b.hub_id = get_current_hub_context()
    AND is_admin_or_hub_manager(auth.uid())
  )
);

-- Policy: Admins and super admins can view all financial records
CREATE POLICY "Admins can view all financial records"
ON public.financial_records FOR SELECT
USING (is_admin_or_hub_manager(auth.uid()));

-- ============================================================
-- PART 2: Fix search_path on all SECURITY DEFINER functions
-- ============================================================

-- Fix get_strategy_financials
ALTER FUNCTION public.get_strategy_financials(uuid) 
  SET search_path = public;

-- Fix sync_financial_records
ALTER FUNCTION public.sync_financial_records()
  SET search_path = public;

-- Fix update_updated_at_column
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public;

-- Fix create_strategy_with_business
ALTER FUNCTION public.create_strategy_with_business(jsonb, jsonb)
  SET search_path = public;

-- Fix batch_process_financial_aggregation
ALTER FUNCTION public.batch_process_financial_aggregation(date, date)
  SET search_path = public;

-- Fix cleanup_old_financial_aggregations
ALTER FUNCTION public.cleanup_old_financial_aggregations(integer)
  SET search_path = public;

-- Fix assign_free_tier_on_signup
ALTER FUNCTION public.assign_free_tier_on_signup()
  SET search_path = public;

-- Fix create_or_update_strategy_with_business
ALTER FUNCTION public.create_or_update_strategy_with_business(jsonb, jsonb, jsonb[])
  SET search_path = public;

-- Fix service_add_user_role
ALTER FUNCTION public.service_add_user_role(uuid, user_role, uuid, inet, text)
  SET search_path = public;