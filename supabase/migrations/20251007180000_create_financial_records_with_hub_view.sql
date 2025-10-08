-- Create a view that includes hub_id for aggregated financial records
-- This is non-destructive and intended as a quick fix so frontend code can query hub-scoped aggregates

CREATE OR REPLACE VIEW public.financial_records_with_hub AS
SELECT
  fr.*,
  b.hub_id
FROM public.financial_records fr
LEFT JOIN public.businesses b ON fr.business_id = b.id;

COMMENT ON VIEW public.financial_records_with_hub IS 'Aggregated financial_records joined with businesses to expose hub_id for hub-scoped queries';
