-- Add hub_id column to businesses table if not exists
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES public.hubs(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_businesses_hub_id ON public.businesses(hub_id);

-- Add missing columns to hubs table
ALTER TABLE public.hubs 
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS admin_user_id uuid,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_hubs_slug ON public.hubs(slug) WHERE slug IS NOT NULL;

-- Create impersonation sessions table
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL,
  target_hub_id uuid NOT NULL REFERENCES public.hubs(id),
  session_token text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '8 hours'),
  is_active boolean DEFAULT true
);

-- Enable RLS on impersonation_sessions
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'impersonation_sessions' AND policyname = 'Super admins can manage impersonation sessions'
  ) THEN
    EXECUTE 'CREATE POLICY "Super admins can manage impersonation sessions" ON public.impersonation_sessions FOR ALL USING (has_role(auth.uid(), ''super_admin''::user_role))';
  END IF;
END $$;

-- Create function to get current hub context
CREATE OR REPLACE FUNCTION public.get_current_hub_context()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_hub_id uuid;
  impersonation_hub_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is impersonating
  SELECT target_hub_id INTO impersonation_hub_id
  FROM public.impersonation_sessions
  WHERE super_admin_id = current_user_id
    AND is_active = true
    AND expires_at > now()
  LIMIT 1;
  
  IF impersonation_hub_id IS NOT NULL THEN
    RETURN impersonation_hub_id;
  END IF;
  
  -- Get user's hub from user_roles
  SELECT hub_id INTO user_hub_id
  FROM public.user_roles
  WHERE user_id = current_user_id
    AND role = 'hub_manager'
  LIMIT 1;
  
  RETURN user_hub_id;
END;
$$;

-- Create function to start impersonation
CREATE OR REPLACE FUNCTION public.start_impersonation(target_hub_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  session_token text;
  result jsonb;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is super admin
  IF NOT has_role(current_user_id, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: only super admins can impersonate';
  END IF;
  
  -- Verify target hub exists
  IF NOT EXISTS (SELECT 1 FROM public.hubs WHERE id = target_hub_id) THEN
    RAISE EXCEPTION 'Target hub not found';
  END IF;
  
  -- Generate session token
  session_token := encode(gen_random_bytes(32), 'base64');
  
  -- Deactivate any existing sessions for this user
  UPDATE public.impersonation_sessions
  SET is_active = false
  WHERE super_admin_id = current_user_id;
  
  -- Create new impersonation session
  INSERT INTO public.impersonation_sessions (
    super_admin_id,
    target_hub_id,
    session_token
  ) VALUES (
    current_user_id,
    target_hub_id,
    session_token
  );
  
  result := jsonb_build_object(
    'success', true,
    'session_token', session_token,
    'hub_id', target_hub_id
  );
  
  RETURN result;
END;
$$;

-- Create function to stop impersonation
CREATE OR REPLACE FUNCTION public.stop_impersonation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Deactivate all active sessions for this user
  UPDATE public.impersonation_sessions
  SET is_active = false
  WHERE super_admin_id = current_user_id
    AND is_active = true;
  
  RETURN FOUND;
END;
$$;

-- Update businesses RLS policies to include hub scoping
-- Update businesses RLS policies to include hub scoping
DO $$
BEGIN
  IF to_regclass('public.businesses') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
    DROP POLICY IF EXISTS "Users can update their own businesses" ON public.businesses;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'businesses' AND policyname = 'Users can view their own businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view their own businesses or hub businesses" ON public.businesses FOR SELECT USING (user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'businesses' AND policyname = 'Users can update their own businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can update their own businesses or hub businesses" ON public.businesses FOR UPDATE USING (user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))';
    END IF;
  END IF;
END $$;

-- Update financial_records RLS to include hub scoping
DO $$
BEGIN
  IF to_regclass('public.financial_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage financial records for their businesses" ON public.financial_records;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_records' AND policyname = 'Users can manage financial records for their businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage financial records for their businesses or hub businesses" ON public.financial_records FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = financial_records.business_id AND (b.user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (b.hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))))';
    END IF;
  END IF;
END $$;

-- Update other business-related tables with hub scoping
DO $$
BEGIN
  IF to_regclass('public.business_milestones') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage milestones for their businesses" ON public.business_milestones;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_milestones' AND policyname = 'Users can manage milestones for their businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage milestones for their businesses or hub businesses" ON public.business_milestones FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_milestones.business_id AND (b.user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (b.hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))))';
    END IF;
  END IF;
END $$;

-- Update business_survival_records
DO $$
BEGIN
  IF to_regclass('public.business_survival_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage survival records for their businesses" ON public.business_survival_records;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_survival_records' AND policyname = 'Users can manage survival records for their businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage survival records for their businesses or hub businesses" ON public.business_survival_records FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_survival_records.business_id AND (b.user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (b.hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))))';
    END IF;
  END IF;
END $$;

-- Update finance_access_records
DO $$
BEGIN
  IF to_regclass('public.finance_access_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage finance access records for their businesses" ON public.finance_access_records;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_access_records' AND policyname = 'Users can manage finance access records for their businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage finance access records for their businesses or hub businesses" ON public.finance_access_records FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = finance_access_records.business_id AND (b.user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (b.hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))))';
    END IF;
  END IF;
END $$;

-- Update job_creation_records
DO $$
BEGIN
  IF to_regclass('public.job_creation_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage job records for their businesses" ON public.job_creation_records;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_creation_records' AND policyname = 'Users can manage job records for their businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage job records for their businesses or hub businesses" ON public.job_creation_records FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = job_creation_records.business_id AND (b.user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (b.hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))))';
    END IF;
  END IF;
END $$;

-- Update loan_readiness_assessments
DO $$
BEGIN
  IF to_regclass('public.loan_readiness_assessments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage loan assessments for their businesses" ON public.loan_readiness_assessments;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'loan_readiness_assessments' AND policyname = 'Users can manage loan assessments for their businesses or hub businesses'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage loan assessments for their businesses or hub businesses" ON public.loan_readiness_assessments FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = loan_readiness_assessments.business_id AND (b.user_id = auth.uid() OR is_admin_or_hub_manager(auth.uid()) OR (b.hub_id = public.get_current_hub_context() AND is_admin_or_hub_manager(auth.uid())))))';
    END IF;
  END IF;
END $$;

-- Create RPC to get hub-scoped analytics data
CREATE OR REPLACE FUNCTION public.get_hub_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hub_id uuid;
  total_businesses bigint;
  active_businesses bigint;
  total_revenue numeric;
  total_users bigint;
  result jsonb;
BEGIN
  -- Check if user has permissions
  IF NOT is_admin_or_hub_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  current_hub_id := public.get_current_hub_context();
  
  -- Get business metrics for the hub
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COALESCE(SUM(fr.revenue), 0)
  INTO total_businesses, active_businesses, total_revenue
  FROM public.businesses b
  LEFT JOIN public.financial_records fr ON b.id = fr.business_id
  WHERE (current_hub_id IS NULL OR b.hub_id = current_hub_id);
  
  -- Get user count for the hub
  SELECT COUNT(DISTINCT b.user_id)
  INTO total_users
  FROM public.businesses b
  WHERE (current_hub_id IS NULL OR b.hub_id = current_hub_id);
  
  result := jsonb_build_object(
    'hub_id', current_hub_id,
    'total_businesses', total_businesses,
    'active_businesses', active_businesses,
    'total_revenue', total_revenue,
    'total_users', total_users
  );
  
  RETURN result;
END;
$$;