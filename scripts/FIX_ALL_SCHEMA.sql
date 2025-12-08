-- =========================================================
-- FIX ALL SCHEMA - Run this in Supabase SQL Editor
-- =========================================================
-- This script ensures polybot_config is properly structured
-- with ALL columns needed by the admin UI settings page.
-- =========================================================

-- STEP 1: Drop the old key-value polybot_config if it exists with wrong structure
-- Only do this if it has UUID id (wrong structure)
DO $$
DECLARE
    id_type TEXT;
BEGIN
    SELECT data_type INTO id_type
    FROM information_schema.columns
    WHERE table_name = 'polybot_config' AND column_name = 'id';
    
    IF id_type = 'uuid' THEN
        RAISE NOTICE 'Found old UUID-based polybot_config, dropping and recreating...';
        DROP TABLE IF EXISTS polybot_config CASCADE;
    ELSE
        RAISE NOTICE 'polybot_config has correct structure, adding missing columns...';
    END IF;
END $$;

-- STEP 2: Create the correct polybot_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS polybot_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    polymarket_enabled BOOLEAN DEFAULT true,
    kalshi_enabled BOOLEAN DEFAULT true,
    min_profit_percent NUMERIC(5, 2) DEFAULT 1.0,
    max_trade_size NUMERIC(10, 2) DEFAULT 100.0,
    max_daily_loss NUMERIC(10, 2) DEFAULT 50.0,
    scan_interval NUMERIC(5, 2) DEFAULT 2.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Insert default row if it doesn't exist
INSERT INTO polybot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- STEP 4: Add ALL columns needed by settings page

-- Basic simulation parameters
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_realistic_spread_pct DECIMAL(5,2) DEFAULT 12.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS min_profit_threshold_pct DECIMAL(5,2) DEFAULT 5.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_min_pct DECIMAL(5,3) DEFAULT 0.2;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_max_pct DECIMAL(5,3) DEFAULT 1.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spread_cost_pct DECIMAL(5,3) DEFAULT 0.5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS execution_failure_rate DECIMAL(5,3) DEFAULT 0.15;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS partial_fill_chance DECIMAL(5,3) DEFAULT 0.15;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS partial_fill_min_pct DECIMAL(5,3) DEFAULT 0.70;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS resolution_loss_rate DECIMAL(5,3) DEFAULT 0.08;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS loss_severity_min DECIMAL(5,3) DEFAULT 0.10;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS loss_severity_max DECIMAL(5,3) DEFAULT 0.40;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_position_pct DECIMAL(5,2) DEFAULT 5.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_position_usd DECIMAL(10,2) DEFAULT 50.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS min_position_usd DECIMAL(10,2) DEFAULT 5.0;

-- Per-strategy enablement
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_polymarket_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_cross_platform_arb BOOLEAN DEFAULT true;

-- Polymarket Single settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_min_profit_pct DECIMAL(5,2) DEFAULT 5.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_max_spread_pct DECIMAL(5,2) DEFAULT 10.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_max_position_usd DECIMAL(10,2) DEFAULT 50.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_scan_interval_sec INTEGER DEFAULT 30;

-- Kalshi Single settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_min_profit_pct DECIMAL(5,2) DEFAULT 5.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_max_spread_pct DECIMAL(5,2) DEFAULT 10.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_max_position_usd DECIMAL(10,2) DEFAULT 50.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_scan_interval_sec INTEGER DEFAULT 30;

-- Cross-Platform settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_poly_pct DECIMAL(5,2) DEFAULT 5.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_kalshi_pct DECIMAL(5,2) DEFAULT 5.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_max_position_usd DECIMAL(10,2) DEFAULT 50.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_scan_interval_sec INTEGER DEFAULT 60;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_min_similarity DECIMAL(5,2) DEFAULT 0.9;

-- Market Making settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_market_making BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_target_spread_bps INTEGER DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_min_spread_bps INTEGER DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_max_spread_bps INTEGER DEFAULT 100;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_order_size_usd DECIMAL(10,2) DEFAULT 25.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_max_inventory_usd DECIMAL(10,2) DEFAULT 500.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_quote_refresh_sec INTEGER DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_min_volume_24h DECIMAL(10,2) DEFAULT 10000.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS mm_max_markets INTEGER DEFAULT 5;

-- News Arbitrage settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_news_arbitrage BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS news_min_spread_pct DECIMAL(5,2) DEFAULT 3.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS news_max_lag_minutes INTEGER DEFAULT 15;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS news_position_size_usd DECIMAL(10,2) DEFAULT 50.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS news_scan_interval_sec INTEGER DEFAULT 60;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS news_keywords TEXT DEFAULT 'earnings,FDA,merger,acquisition,bankruptcy';

-- Funding Rate Arbitrage settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_funding_rate_arb BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_min_rate_pct DECIMAL(10,4) DEFAULT 0.03;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_min_apy DECIMAL(10,2) DEFAULT 30.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_max_position_usd DECIMAL(10,2) DEFAULT 1000.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_max_positions INTEGER DEFAULT 3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_max_leverage INTEGER DEFAULT 3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_scan_interval_sec INTEGER DEFAULT 300;

-- Grid Trading settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_grid_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_default_range_pct DECIMAL(10,2) DEFAULT 10.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_default_levels INTEGER DEFAULT 20;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_default_investment_usd DECIMAL(10,2) DEFAULT 500.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_max_grids INTEGER DEFAULT 3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_stop_loss_pct DECIMAL(10,2) DEFAULT 15.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_take_profit_pct DECIMAL(10,2) DEFAULT 50.0;

-- Pairs Trading settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_pairs_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_entry_zscore DECIMAL(10,2) DEFAULT 2.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_exit_zscore DECIMAL(10,2) DEFAULT 0.5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_position_size_usd DECIMAL(10,2) DEFAULT 500.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_max_positions INTEGER DEFAULT 2;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_max_hold_hours DECIMAL(10,2) DEFAULT 72.0;

-- EXCHANGE ENABLEMENT FLAGS
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_binance BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_bybit BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_okx BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kraken BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_coinbase BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kucoin BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_alpaca BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_ibkr BOOLEAN DEFAULT false;

-- STEP 5: Ensure row 1 has default values for all columns
UPDATE polybot_config SET
    polymarket_enabled = COALESCE(polymarket_enabled, true),
    kalshi_enabled = COALESCE(kalshi_enabled, true),
    min_profit_percent = COALESCE(min_profit_percent, 1.0),
    max_trade_size = COALESCE(max_trade_size, 100.0),
    max_daily_loss = COALESCE(max_daily_loss, 50.0),
    scan_interval = COALESCE(scan_interval, 2.0),
    enable_binance = COALESCE(enable_binance, false),
    enable_bybit = COALESCE(enable_bybit, false),
    enable_okx = COALESCE(enable_okx, false),
    enable_kraken = COALESCE(enable_kraken, false),
    enable_coinbase = COALESCE(enable_coinbase, false),
    enable_kucoin = COALESCE(enable_kucoin, false),
    enable_alpaca = COALESCE(enable_alpaca, false),
    enable_ibkr = COALESCE(enable_ibkr, false),
    updated_at = NOW()
WHERE id = 1;

-- STEP 6: Enable Row Level Security
ALTER TABLE polybot_config ENABLE ROW LEVEL SECURITY;

-- STEP 7: Create policies for access
DROP POLICY IF EXISTS "Allow authenticated read polybot_config" ON polybot_config;
DROP POLICY IF EXISTS "Allow authenticated write polybot_config" ON polybot_config;
DROP POLICY IF EXISTS "Allow service full access polybot_config" ON polybot_config;
DROP POLICY IF EXISTS "Allow anon read polybot_config" ON polybot_config;

CREATE POLICY "Allow authenticated read polybot_config" ON polybot_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write polybot_config" ON polybot_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow service full access polybot_config" ON polybot_config
    FOR ALL TO service_role USING (true);

-- Allow anonymous reads for the admin dashboard
CREATE POLICY "Allow anon read polybot_config" ON polybot_config
    FOR SELECT TO anon USING (true);

-- STEP 8: Verify structure
SELECT 
    '✅ polybot_config table configured successfully!' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'polybot_config';

-- Show exchange columns status
SELECT 
    'Exchange Config' as section,
    enable_binance,
    enable_bybit,
    enable_okx,
    enable_kraken,
    enable_coinbase,
    enable_kucoin,
    enable_alpaca,
    enable_ibkr
FROM polybot_config 
WHERE id = 1;
