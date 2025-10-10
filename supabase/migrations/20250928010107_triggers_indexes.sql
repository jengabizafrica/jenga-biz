-- Triggers for updated_at columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pg_function_is_visible(oid)
    ) THEN
        EXECUTE '
            CREATE FUNCTION public.update_updated_at_column() RETURNS trigger AS $func$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql;
        ';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
        CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_businesses_updated_at') THEN
        CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_financial_records_updated_at') THEN
        CREATE TRIGGER update_financial_records_updated_at BEFORE UPDATE ON public.financial_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_financial_transactions_updated_at') THEN
        CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.analytics_summaries') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_analytics_summaries_metric_date ON public.analytics_summaries (metric_type, metric_date);
    END IF;
    IF to_regclass('public.business_progress_stages') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_business_progress_stages_stage ON public.business_progress_stages (stage_name);
        CREATE INDEX IF NOT EXISTS idx_business_progress_stages_user_id ON public.business_progress_stages (user_id);
    END IF;
    IF to_regclass('public.financial_transactions') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON public.financial_transactions (transaction_date DESC);
        CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_id ON public.financial_transactions (user_id);
    END IF;
    IF to_regclass('public.user_activities') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities (user_id);
    END IF;
END$$;
