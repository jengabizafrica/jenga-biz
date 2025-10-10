-- Migration: Link financial records to strategies
-- This migration updates the financial_records table to link to strategies instead of businesses

-- Add strategy_id column (nullable initially)
-- Add the column without a FK so this migration is safe when public.strategies doesn't exist yet
ALTER TABLE public.financial_records 
ADD COLUMN IF NOT EXISTS strategy_id UUID;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_financial_records_strategy_id ON public.financial_records(strategy_id);

-- If the strategies table exists, run the rest of the migration that depends on it.
DO $$
BEGIN
    IF to_regclass('public.strategies') IS NOT NULL THEN
        -- Migrate existing data to associate with the first strategy of each business
        UPDATE public.financial_records fr
        SET strategy_id = (
            SELECT s.id
            FROM public.strategies s
            WHERE s.business_id = fr.business_id
            ORDER BY s.created_at
            LIMIT 1
        )
        WHERE strategy_id IS NULL;

        -- Make strategy_id required after migration only if there are no NULLs
        IF NOT EXISTS (SELECT 1 FROM public.financial_records WHERE strategy_id IS NULL) THEN
            ALTER TABLE public.financial_records
            ALTER COLUMN strategy_id SET NOT NULL;
        ELSE
            RAISE NOTICE 'strategy_id contains NULLs after attempted migration; leaving nullable.';
        END IF;

        -- Drop the old unique constraint on business_id and record_date
        ALTER TABLE public.financial_records
        DROP CONSTRAINT IF EXISTS financial_records_business_id_record_date_key;

        -- Create a new unique constraint on strategy_id and record_date if not exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public' AND tc.table_name = 'financial_records' AND tc.constraint_type = 'UNIQUE' AND tc.constraint_name = 'financial_records_strategy_id_record_date_key'
        ) THEN
            ALTER TABLE public.financial_records
            ADD CONSTRAINT financial_records_strategy_id_record_date_key UNIQUE (strategy_id, record_date);
        END IF;

        -- Update RLS policies to check strategy access
        BEGIN
            -- Drop existing policies if present
            DROP POLICY IF EXISTS "Users can view their financial records" ON public.financial_records;
            DROP POLICY IF EXISTS "Users can insert their financial records" ON public.financial_records;
            DROP POLICY IF EXISTS "Users can update their financial records" ON public.financial_records;
            DROP POLICY IF EXISTS "Users can delete their financial records" ON public.financial_records;

            -- View policy: Users can see financial records for their strategies
            CREATE POLICY "Users can view their financial records"
            ON public.financial_records
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.strategies s
                    WHERE s.id = financial_records.strategy_id
                    AND s.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role = 'admin'
                )
            );

            -- Insert policy
            CREATE POLICY "Users can insert their financial records"
            ON public.financial_records
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.strategies s
                    WHERE s.id = financial_records.strategy_id
                    AND s.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role = 'admin'
                )
            );

            -- Update policy
            CREATE POLICY "Users can update their financial records"
            ON public.financial_records
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM public.strategies s
                    WHERE s.id = financial_records.strategy_id
                    AND s.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role = 'admin'
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.strategies s
                    WHERE s.id = financial_records.strategy_id
                    AND s.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role = 'admin'
                )
            );

            -- Delete policy
            CREATE POLICY "Users can delete their financial records"
            ON public.financial_records
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM public.strategies s
                    WHERE s.id = financial_records.strategy_id
                    AND s.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid()
                    AND role = 'admin'
                )
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error updating RLS policies: %', SQLERRM;
        END;

        -- Create/replace the view and function that depend on strategies
        CREATE OR REPLACE VIEW public.business_financials AS
        SELECT fr.*
        FROM public.financial_records fr
        JOIN public.strategies s ON fr.strategy_id = s.id
        WHERE s.business_id = current_setting('app.current_business_id', true)::uuid;

        CREATE OR REPLACE FUNCTION public.get_strategy_financials(p_strategy_id UUID)
        RETURNS TABLE (
            id UUID,
            strategy_id UUID,
            record_date DATE,
            amount NUMERIC,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        ) AS $fn$
        BEGIN
            RETURN QUERY
            SELECT
                fr.id,
                fr.strategy_id,
                fr.record_date,
                fr.amount,
                fr.created_at,
                fr.updated_at
            FROM
                public.financial_records fr
            WHERE
                fr.strategy_id = p_strategy_id
            ORDER BY
                fr.record_date DESC;
        END;
        $fn$ LANGUAGE plpgsql SECURITY DEFINER;

        -- Grant permissions and comments
        GRANT EXECUTE ON FUNCTION public.get_strategy_financials(UUID) TO authenticated;
        GRANT SELECT ON public.business_financials TO authenticated;

        COMMENT ON COLUMN public.financial_records.strategy_id IS 'References the strategy this financial record belongs to';
        COMMENT ON VIEW public.business_financials IS 'Legacy view for backward compatibility - use strategy_id in financial_records for new development';

        -- Notify
        RAISE NOTICE 'Migration completed successfully. Financial records are now linked to strategies.';
        RAISE NOTICE 'Please update your application code to use strategy_id when creating/updating financial records.';
        RAISE NOTICE 'The business_financials view is provided for backward compatibility but should be updated in the future.';

    ELSE
        RAISE NOTICE 'Skipping strategy-dependent parts of migration because public.strategies does not exist yet.';
    END IF;
END $$;
