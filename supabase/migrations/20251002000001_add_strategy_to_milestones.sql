-- Add strategy_id to business_milestones
-- Create the column first without FK so the migration is safe when public.strategies doesn't exist yet
ALTER TABLE public.business_milestones
ADD COLUMN IF NOT EXISTS strategy_id UUID;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_business_milestones_strategy_id ON public.business_milestones(strategy_id);

-- If strategies table exists, add FK constraint (idempotent)
DO $$
BEGIN
    IF to_regclass('public.strategies') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conrelid = 'public.business_milestones'::regclass AND conname = 'fk_business_milestones_strategy'
        ) THEN
            ALTER TABLE public.business_milestones
            ADD CONSTRAINT fk_business_milestones_strategy FOREIGN KEY (strategy_id) REFERENCES public.strategies(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Update RLS policies if they exist
DO $$
BEGIN
    -- Check if RLS is enabled on the table and strategies table exists (policies reference strategies)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_milestones') AND to_regclass('public.strategies') IS NOT NULL THEN
        -- Enable RLS if not already enabled
        EXECUTE 'ALTER TABLE public.business_milestones ENABLE ROW LEVEL SECURITY';
        
        -- Drop existing policy if it exists to avoid conflicts
        DROP POLICY IF EXISTS "Users can view their own milestones" ON public.business_milestones;
        DROP POLICY IF EXISTS "Users can manage their own milestones" ON public.business_milestones;
        
        -- Create new policies that include strategy_id check
        CREATE POLICY "Users can view their own milestones" 
        ON public.business_milestones
        FOR SELECT
        USING (
            auth.uid() = (SELECT user_id FROM public.strategies WHERE id = strategy_id)
        );
        
        CREATE POLICY "Users can manage their own milestones"
        ON public.business_milestones
        FOR ALL
        USING (
            auth.uid() = (SELECT user_id FROM public.strategies WHERE id = strategy_id)
        )
        WITH CHECK (
            auth.uid() = (SELECT user_id FROM public.strategies WHERE id = strategy_id)
        );
    END IF;
END $$;

-- Create a function to help with the migration of existing data
CREATE OR REPLACE FUNCTION public.migrate_milestones_to_strategies()
RETURNS void AS $$
DECLARE
    strategy_record RECORD;
    milestone_count INTEGER;
BEGIN
    -- For each strategy, find and update its milestones
    FOR strategy_record IN SELECT id, user_id FROM public.strategies
    LOOP
        -- Update milestones that belong to this strategy's user and don't have a strategy_id yet
        UPDATE public.business_milestones
        SET strategy_id = strategy_record.id
        WHERE user_id = strategy_record.user_id 
        AND (strategy_id IS NULL OR strategy_id != strategy_record.id);
    END LOOP;
    
    -- Count how many milestones were not migrated
    SELECT COUNT(*) INTO milestone_count
    FROM public.business_milestones
    WHERE strategy_id IS NULL;
    
    IF milestone_count > 0 THEN
        RAISE NOTICE 'There are % milestones that could not be automatically assigned to a strategy', milestone_count;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the migration function (uncomment to run manually)
-- SELECT public.migrate_milestones_to_strategies();

-- Create a trigger to automatically set user_id when a new milestone is inserted
CREATE OR REPLACE FUNCTION public.set_milestone_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.strategy_id IS NOT NULL AND NEW.user_id IS NULL THEN
        NEW.user_id := (SELECT user_id FROM public.strategies WHERE id = NEW.strategy_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_set_milestone_user_id ON public.business_milestones;
CREATE TRIGGER trg_set_milestone_user_id
BEFORE INSERT OR UPDATE ON public.business_milestones
FOR EACH ROW
EXECUTE FUNCTION public.set_milestone_user_id();

-- Add a comment to explain the purpose of the migration
COMMENT ON COLUMN public.business_milestones.strategy_id IS 'References the strategy this milestone belongs to. If NULL, the milestone is not associated with any specific strategy.';
