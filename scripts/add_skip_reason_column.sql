-- Add skip_reason column to polybot_opportunities table
-- This enables proper tracking of WHY opportunities were skipped

-- 1. Add skip_reason column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_opportunities' 
        AND column_name = 'skip_reason'
    ) THEN
        ALTER TABLE polybot_opportunities 
        ADD COLUMN skip_reason TEXT;
        
        COMMENT ON COLUMN polybot_opportunities.skip_reason IS 
            'Reason why opportunity was skipped (Cooldown, False Positive, Same-Platform Overlap, etc)';
    END IF;
END $$;

-- 2. Add execution_result column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_opportunities' 
        AND column_name = 'execution_result'
    ) THEN
        ALTER TABLE polybot_opportunities 
        ADD COLUMN execution_result TEXT;
        
        COMMENT ON COLUMN polybot_opportunities.execution_result IS 
            'Result of execution attempt (success, partial_fill, slippage, failed, etc)';
    END IF;
END $$;

-- 3. Create index on skip_reason for faster analytics
CREATE INDEX IF NOT EXISTS idx_polybot_opportunities_skip_reason 
ON polybot_opportunities(skip_reason) 
WHERE skip_reason IS NOT NULL;

-- 4. DROP existing functions first (required when changing return types)
DROP FUNCTION IF EXISTS get_missed_money_stats(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_skip_reason_breakdown(UUID, INTEGER);

-- 5. Create RPC function for missed money stats
CREATE OR REPLACE FUNCTION get_missed_money_stats(
    p_user_id UUID DEFAULT NULL,
    hours_lookback INTEGER DEFAULT 24
)
RETURNS TABLE (
    missed_money NUMERIC,
    opportunities_count INTEGER,
    executed_count INTEGER,
    conversion_rate NUMERIC,
    actual_pnl NUMERIC
) AS $$
DECLARE
    v_cutoff TIMESTAMPTZ;
BEGIN
    v_cutoff := NOW() - (hours_lookback || ' hours')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        -- Missed money: sum of total_profit for skipped/detected opportunities
        COALESCE(SUM(
            CASE 
                WHEN o.status IN ('skipped', 'detected', 'missed', 'expired') 
                THEN o.total_profit 
                ELSE 0 
            END
        ), 0)::NUMERIC as missed_money,
        
        -- Total opportunities detected
        COUNT(*)::INTEGER as opportunities_count,
        
        -- Executed count
        COUNT(*) FILTER (WHERE o.status IN ('executed', 'filled'))::INTEGER as executed_count,
        
        -- Conversion rate
        CASE 
            WHEN COUNT(*) > 0 
            THEN (COUNT(*) FILTER (WHERE o.status IN ('executed', 'filled'))::NUMERIC / COUNT(*)::NUMERIC * 100)
            ELSE 0 
        END as conversion_rate,
        
        -- Actual PnL from executed trades (join with trades table if needed)
        COALESCE(SUM(
            CASE 
                WHEN o.status IN ('executed', 'filled') 
                THEN o.total_profit 
                ELSE 0 
            END
        ), 0)::NUMERIC as actual_pnl
        
    FROM polybot_opportunities o
    WHERE o.detected_at >= v_cutoff
    AND (p_user_id IS NULL OR o.user_id = p_user_id);
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create RPC function for skip reason breakdown
CREATE OR REPLACE FUNCTION get_skip_reason_breakdown(
    p_user_id UUID DEFAULT NULL,
    hours_lookback INTEGER DEFAULT 24
)
RETURNS TABLE (
    skip_reason TEXT,
    count INTEGER,
    total_profit_missed NUMERIC,
    avg_profit_pct NUMERIC
) AS $$
DECLARE
    v_cutoff TIMESTAMPTZ;
BEGIN
    v_cutoff := NOW() - (hours_lookback || ' hours')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        COALESCE(o.skip_reason, 'No Reason Logged') as skip_reason,
        COUNT(*)::INTEGER as count,
        COALESCE(SUM(o.total_profit), 0)::NUMERIC as total_profit_missed,
        COALESCE(AVG(o.profit_percent), 0)::NUMERIC as avg_profit_pct
    FROM polybot_opportunities o
    WHERE o.detected_at >= v_cutoff
    AND o.status NOT IN ('executed', 'filled')
    AND (p_user_id IS NULL OR o.user_id = p_user_id)
    GROUP BY o.skip_reason
    ORDER BY total_profit_missed DESC;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION get_missed_money_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_missed_money_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_skip_reason_breakdown TO authenticated;
GRANT EXECUTE ON FUNCTION get_skip_reason_breakdown TO service_role;

-- 7. View current skip reasons distribution (run after migration)
-- SELECT 
--     COALESCE(skip_reason, 'No Reason Logged') as reason,
--     COUNT(*) as count,
--     SUM(total_profit) as profit_missed
-- FROM polybot_opportunities 
-- WHERE status NOT IN ('executed', 'filled')
-- AND detected_at > NOW() - INTERVAL '24 hours'
-- GROUP BY skip_reason
-- ORDER BY profit_missed DESC;

SELECT 'Migration complete! skip_reason column and RPC functions created.' as status;
