-- Fix Security Definer View Issue
-- The financial_records_with_hub view uses SECURITY DEFINER which bypasses RLS
-- Since financial_records already has hub_id column, we can simply drop the view
-- The base table with RLS policies is now sufficient

-- Drop the SECURITY DEFINER view
DROP VIEW IF EXISTS public.financial_records_with_hub;