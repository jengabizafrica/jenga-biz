-- Real-time Financial Aggregation System
-- Provides immediate consistency via triggers + scheduled batch processing for optimization

-- ==========================================
-- 1. Real-time Trigger Function
-- ==========================================

CREATE OR REPLACE FUNCTION sync_financial_records()
RETURNS TRIGGER AS $$
DECLARE
  v_strategy_id uuid;
  v_business_id uuid;
  v_transaction_date date;
  v_currency text;
BEGIN
  -- Get strategy and business info from the transaction
  IF TG_OP = 'DELETE' THEN
    v_strategy_id := OLD.strategy_id;
    v_transaction_date := OLD.transaction_date;
    v_currency := OLD.currency;
  ELSE
    v_strategy_id := NEW.strategy_id;
    v_transaction_date := NEW.transaction_date;
    v_currency := NEW.currency;
  END IF;

  -- Get business_id from strategy
  SELECT business_id INTO v_business_id
  FROM strategies
  WHERE id = v_strategy_id;

  -- Only process if we have a business_id
  IF v_business_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculate aggregated financial record for this business on this date
  INSERT INTO financial_records (
    business_id,
    record_date,
    amount,
    metric_type,
    notes,
    created_at,
    updated_at
  )
  SELECT
    v_business_id,
    v_transaction_date,
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0),
    'net_income',
    'Auto-aggregated from transactions',
    NOW(),
    NOW()
  FROM financial_transactions
  WHERE strategy_id = v_strategy_id
    AND transaction_date = v_transaction_date
    AND currency = v_currency
  ON CONFLICT (business_id, record_date, metric_type)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. Attach Trigger to financial_transactions
-- ==========================================

DROP TRIGGER IF EXISTS trigger_sync_financial_records ON financial_transactions;

CREATE TRIGGER trigger_sync_financial_records
  AFTER INSERT OR UPDATE OR DELETE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_financial_records();

-- ==========================================
-- 3. Batch Processing Function for Optimization
-- ==========================================

CREATE OR REPLACE FUNCTION batch_process_financial_aggregation(
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  business_id uuid,
  record_date date,
  records_processed integer
) AS $$
BEGIN
  RETURN QUERY
  WITH aggregated_data AS (
    SELECT
      s.business_id,
      ft.transaction_date,
      ft.currency,
      COUNT(*) as transaction_count,
      COALESCE(SUM(CASE WHEN ft.transaction_type = 'income' THEN ft.amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN ft.transaction_type = 'expense' THEN ft.amount ELSE 0 END), 0) as total_expenses
    FROM financial_transactions ft
    JOIN strategies s ON s.id = ft.strategy_id
    WHERE ft.transaction_date BETWEEN p_start_date AND p_end_date
      AND s.business_id IS NOT NULL
    GROUP BY s.business_id, ft.transaction_date, ft.currency
  )
  INSERT INTO financial_records (
    business_id,
    record_date,
    amount,
    metric_type,
    notes,
    created_at,
    updated_at
  )
  SELECT
    aggregated_data.business_id,
    aggregated_data.transaction_date,
    (aggregated_data.total_income - aggregated_data.total_expenses),
    'net_income',
    format('Batch aggregated: %s income, %s expenses from %s transactions', 
           total_income, total_expenses, transaction_count),
    NOW(),
    NOW()
  FROM aggregated_data
  ON CONFLICT (business_id, record_date, metric_type)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    notes = EXCLUDED.notes,
    updated_at = NOW()
  RETURNING 
    financial_records.business_id,
    financial_records.record_date,
    1 as records_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. Maintenance Function to Clean Old Records
-- ==========================================

CREATE OR REPLACE FUNCTION cleanup_old_financial_aggregations(
  p_retention_days integer DEFAULT 365
)
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM financial_records
  WHERE record_date < CURRENT_DATE - (p_retention_days || ' days')::interval
    AND metric_type = 'net_income'
    AND notes LIKE '%Auto-aggregated%';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. Grant Permissions
-- ==========================================

GRANT EXECUTE ON FUNCTION batch_process_financial_aggregation TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_financial_aggregations TO service_role;

-- ==========================================
-- 6. Add Comments for Documentation
-- ==========================================

COMMENT ON FUNCTION sync_financial_records() IS 
'Real-time trigger function that aggregates financial transactions into daily records immediately upon transaction changes';

COMMENT ON FUNCTION batch_process_financial_aggregation(date, date) IS 
'Batch processing function for optimizing financial aggregations over a date range. Recommended to run daily via cron.';

COMMENT ON FUNCTION cleanup_old_financial_aggregations(integer) IS 
'Maintenance function to remove old aggregated records beyond retention period. Default 365 days.';