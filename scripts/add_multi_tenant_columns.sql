-- ============================================
-- MULTI-TENANT MIGRATION SCRIPT
-- ============================================
-- This script adds user_id columns to existing tables
-- and updates RLS policies for proper multi-tenancy
-- 
-- RUN THIS IN SUPABASE SQL EDITOR:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- ============================================

-- ============================================
-- STEP 1: Add user_id columns to core tables
-- ============================================

-- polybot_simulated_trades
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_simulated_trades' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_simulated_trades 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_simulated_trades_user_id 
        ON polybot_simulated_trades(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_simulated_trades';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_simulated_trades';
    END IF;
END $$;

-- polybot_opportunities
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_opportunities' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_opportunities 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_opportunities_user_id 
        ON polybot_opportunities(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_opportunities';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_opportunities';
    END IF;
END $$;

-- polybot_positions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_positions' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_positions 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_positions_user_id 
        ON polybot_positions(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_positions';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_positions';
    END IF;
END $$;

-- polybot_markets_cache (shared across users, no user_id needed)
-- polybot_simulation_stats
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_simulation_stats' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_simulation_stats 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_simulation_stats_user_id 
        ON polybot_simulation_stats(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_simulation_stats';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_simulation_stats';
    END IF;
END $$;

-- polybot_disabled_markets
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_disabled_markets' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_disabled_markets 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_disabled_markets_user_id 
        ON polybot_disabled_markets(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_disabled_markets';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_disabled_markets';
    END IF;
END $$;

-- polybot_tracked_traders
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_tracked_traders' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_tracked_traders 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_tracked_traders_user_id 
        ON polybot_tracked_traders(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_tracked_traders';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_tracked_traders';
    END IF;
END $$;

-- polybot_copy_signals
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_copy_signals' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_copy_signals 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_copy_signals_user_id 
        ON polybot_copy_signals(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_copy_signals';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_copy_signals';
    END IF;
END $$;

-- polybot_overlap_opportunities
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_overlap_opportunities' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_overlap_opportunities 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_overlap_opportunities_user_id 
        ON polybot_overlap_opportunities(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_overlap_opportunities';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_overlap_opportunities';
    END IF;
END $$;

-- polybot_news_items (shared across users, no user_id needed)

-- polybot_market_alerts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_market_alerts' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_market_alerts 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX IF NOT EXISTS idx_market_alerts_user_id 
        ON polybot_market_alerts(user_id);
        
        RAISE NOTICE 'Added user_id column to polybot_market_alerts';
    ELSE
        RAISE NOTICE 'user_id column already exists on polybot_market_alerts';
    END IF;
END $$;

-- ============================================
-- STEP 2: Update RLS Policies for Multi-Tenancy
-- ============================================

-- polybot_simulated_trades
DROP POLICY IF EXISTS "Allow public read access to simulated trades" ON polybot_simulated_trades;
DROP POLICY IF EXISTS "Allow user read own trades" ON polybot_simulated_trades;
DROP POLICY IF EXISTS "Allow service role full access" ON polybot_simulated_trades;

CREATE POLICY "Allow user read own trades" 
    ON polybot_simulated_trades 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" 
    ON polybot_simulated_trades 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- polybot_opportunities
DROP POLICY IF EXISTS "Allow public read access to opportunities" ON polybot_opportunities;
DROP POLICY IF EXISTS "Allow user read own opportunities" ON polybot_opportunities;
DROP POLICY IF EXISTS "Allow service role full access to opportunities" ON polybot_opportunities;

CREATE POLICY "Allow user read own opportunities" 
    ON polybot_opportunities 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to opportunities" 
    ON polybot_opportunities 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- polybot_positions
DROP POLICY IF EXISTS "Allow user read own positions" ON polybot_positions;
DROP POLICY IF EXISTS "Allow service role full access to positions" ON polybot_positions;

CREATE POLICY "Allow user read own positions" 
    ON polybot_positions 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to positions" 
    ON polybot_positions 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- polybot_simulation_stats
DROP POLICY IF EXISTS "Allow user read own stats" ON polybot_simulation_stats;
DROP POLICY IF EXISTS "Allow service role full access to stats" ON polybot_simulation_stats;

CREATE POLICY "Allow user read own stats" 
    ON polybot_simulation_stats 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to stats" 
    ON polybot_simulation_stats 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- polybot_disabled_markets
DROP POLICY IF EXISTS "Allow user manage own disabled markets" ON polybot_disabled_markets;
DROP POLICY IF EXISTS "Allow service role full access to disabled markets" ON polybot_disabled_markets;

CREATE POLICY "Allow user manage own disabled markets" 
    ON polybot_disabled_markets 
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Allow service role full access to disabled markets" 
    ON polybot_disabled_markets 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- polybot_tracked_traders
DROP POLICY IF EXISTS "authenticated_read" ON polybot_tracked_traders;
DROP POLICY IF EXISTS "Allow user manage own tracked traders" ON polybot_tracked_traders;
DROP POLICY IF EXISTS "Allow service role full access to tracked traders" ON polybot_tracked_traders;

CREATE POLICY "Allow user manage own tracked traders" 
    ON polybot_tracked_traders 
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Allow service role full access to tracked traders" 
    ON polybot_tracked_traders 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- polybot_copy_signals
DROP POLICY IF EXISTS "authenticated_read" ON polybot_copy_signals;
DROP POLICY IF EXISTS "Allow user read own copy signals" ON polybot_copy_signals;
DROP POLICY IF EXISTS "Allow service role full access to copy signals" ON polybot_copy_signals;

CREATE POLICY "Allow user read own copy signals" 
    ON polybot_copy_signals 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to copy signals" 
    ON polybot_copy_signals 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- polybot_market_alerts
DROP POLICY IF EXISTS "authenticated_read" ON polybot_market_alerts;
DROP POLICY IF EXISTS "Allow user manage own alerts" ON polybot_market_alerts;
DROP POLICY IF EXISTS "Allow service role full access to alerts" ON polybot_market_alerts;

CREATE POLICY "Allow user manage own alerts" 
    ON polybot_market_alerts 
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Allow service role full access to alerts" 
    ON polybot_market_alerts 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- ============================================
-- STEP 3: Create view for user's strategy performance
-- ============================================
DROP VIEW IF EXISTS polybot_strategy_performance_user;

CREATE OR REPLACE VIEW polybot_strategy_performance_user AS
SELECT 
    user_id,
    trading_mode,
    COALESCE(strategy_type, arbitrage_type, trade_type, 'unknown') as strategy,
    COUNT(*) as total_trades,
    COUNT(*) FILTER (WHERE outcome = 'won') as winning_trades,
    COUNT(*) FILTER (WHERE outcome = 'lost') as losing_trades,
    SUM(actual_profit_usd) as total_pnl,
    AVG(actual_profit_usd) as avg_trade_pnl,
    MAX(actual_profit_usd) as best_trade,
    MIN(actual_profit_usd) as worst_trade,
    CASE 
        WHEN COUNT(*) FILTER (WHERE outcome IN ('won', 'lost')) > 0 
        THEN (COUNT(*) FILTER (WHERE outcome = 'won')::DECIMAL / 
              COUNT(*) FILTER (WHERE outcome IN ('won', 'lost'))) * 100
        ELSE 0
    END as win_rate_pct
FROM polybot_simulated_trades
WHERE outcome != 'failed_execution'
GROUP BY user_id, trading_mode, COALESCE(strategy_type, arbitrage_type, trade_type, 'unknown');

-- ============================================
-- STEP 4: Migrate existing data to a default user (optional)
-- ============================================
-- If you want to assign existing data to a specific user, run:
-- UPDATE polybot_simulated_trades SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE polybot_opportunities SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- etc.

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration:

-- SELECT table_name, column_name 
-- FROM information_schema.columns 
-- WHERE column_name = 'user_id' 
-- AND table_schema = 'public'
-- ORDER BY table_name;

-- SELECT tablename, policyname 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, policyname;

-- Success message (run this separately to confirm)
-- SELECT 'Multi-tenant migration completed successfully!' as status;
