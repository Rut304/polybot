-- ============================================================================
-- PRODUCTION UPGRADE SCRIPT v2 - December 2025
-- FIXED: Uses column-based polybot_config table structure
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD SESSION LABELS FOR CONTINUOUS DATA TRACKING
-- ============================================================================

ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'simulation_v1';

ALTER TABLE polybot_trades
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'live_v1';

ALTER TABLE polybot_simulation_stats
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'simulation_v1';

ALTER TABLE polybot_balance_history
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'simulation_v1';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_simulated_trades_session ON polybot_simulated_trades(session_label);
CREATE INDEX IF NOT EXISTS idx_trades_session ON polybot_trades(session_label);

-- ============================================================================
-- SECTION 2: CREATE STRATEGY CHANGE HISTORY TABLE
-- Tracks all config changes with timestamps for analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS polybot_config_history (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by TEXT DEFAULT 'system',
    change_type TEXT NOT NULL, -- 'manual', 'auto_tune', 'ai_recommendation', 'reset'
    parameter_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    session_label TEXT DEFAULT 'v1'
);

CREATE INDEX IF NOT EXISTS idx_config_history_created ON polybot_config_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_history_param ON polybot_config_history(parameter_name);

-- ============================================================================
-- SECTION 3: UPDATE BANKROLL TO $15K ($3K per platform) - COLUMN STYLE
-- ============================================================================

-- First ensure columns exist
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS polymarket_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS binance_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS coinbase_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS alpaca_starting_balance NUMERIC(15,2) DEFAULT 5000;

-- Update values
UPDATE polybot_config SET 
    polymarket_starting_balance = 3000,
    kalshi_starting_balance = 3000,
    binance_starting_balance = 3000,
    coinbase_starting_balance = 3000,
    alpaca_starting_balance = 3000
WHERE id = 1;

-- Log the changes
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason)
VALUES 
    ('manual', 'polymarket_starting_balance', '5000', '3000', 'Upgraded to $15K total bankroll'),
    ('manual', 'kalshi_starting_balance', '5000', '3000', 'Upgraded to $15K total bankroll'),
    ('manual', 'binance_starting_balance', '5000', '3000', 'Upgraded to $15K total bankroll'),
    ('manual', 'coinbase_starting_balance', '5000', '3000', 'Upgraded to $15K total bankroll'),
    ('manual', 'alpaca_starting_balance', '5000', '3000', 'Upgraded to $15K total bankroll');

-- ============================================================================
-- SECTION 4: INCREASE POSITION SIZES TO $50
-- ============================================================================

ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_max_position_usd NUMERIC(10,2) DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_max_position_usd NUMERIC(10,2) DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_max_position_usd NUMERIC(10,2) DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_position_usd NUMERIC(10,2) DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS min_position_usd NUMERIC(10,2) DEFAULT 5;

UPDATE polybot_config SET 
    poly_single_max_position_usd = 50,
    kalshi_single_max_position_usd = 50,
    cross_plat_max_position_usd = 50,
    max_position_usd = 75,
    min_position_usd = 10
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason)
VALUES 
    ('manual', 'poly_single_max_position_usd', '30', '50', 'Increase position size for more profit per trade'),
    ('manual', 'kalshi_single_max_position_usd', '30', '50', 'Increase position size for more profit per trade'),
    ('manual', 'cross_plat_max_position_usd', '30', '50', 'Increase position size for more profit per trade');

-- ============================================================================
-- SECTION 5: ENABLE STRATEGIES & INCREASE RISK FOR MORE OPPS
-- ============================================================================

ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_polymarket_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_cross_platform_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_news_arbitrage BOOLEAN DEFAULT false;

UPDATE polybot_config SET 
    enable_polymarket_single_arb = true,
    enable_kalshi_single_arb = true,
    enable_cross_platform_arb = true,
    enable_news_arbitrage = true
WHERE id = 1;

-- Spread settings
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_min_profit_pct NUMERIC(6,2) DEFAULT 0.3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_max_spread_pct NUMERIC(6,2) DEFAULT 12;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_max_spread_pct NUMERIC(6,2) DEFAULT 15;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_scan_interval_sec INTEGER DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_scan_interval_sec INTEGER DEFAULT 60;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_scan_interval_sec INTEGER DEFAULT 90;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_min_similarity NUMERIC(4,2) DEFAULT 0.35;

UPDATE polybot_config SET 
    poly_single_min_profit_pct = 0.5,
    poly_single_max_spread_pct = 15,
    kalshi_single_max_spread_pct = 18,
    poly_single_scan_interval_sec = 20,
    kalshi_single_scan_interval_sec = 45,
    cross_plat_scan_interval_sec = 60,
    cross_plat_min_similarity = 0.30
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason)
VALUES 
    ('manual', 'poly_single_max_spread_pct', '12', '15', 'Increase max spread to find more markets'),
    ('manual', 'kalshi_single_max_spread_pct', '15', '18', 'Increase max spread to find more markets'),
    ('manual', 'poly_single_scan_interval_sec', '30', '20', 'Faster scanning for more opportunities'),
    ('manual', 'cross_plat_min_similarity', '0.35', '0.30', 'Lower similarity threshold for more cross-platform matches'),
    ('manual', 'enable_news_arbitrage', 'false', 'true', 'Enable news arbitrage strategy');

-- ============================================================================
-- SECTION 6: REDUCE EXECUTION FRICTION
-- ============================================================================

ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS execution_failure_rate NUMERIC(4,2) DEFAULT 0.15;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS resolution_loss_rate NUMERIC(4,2) DEFAULT 0.08;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_min_pct NUMERIC(4,2) DEFAULT 0.2;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_max_pct NUMERIC(4,2) DEFAULT 1.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_concurrent_positions INTEGER DEFAULT 20;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_position_pct NUMERIC(4,2) DEFAULT 5;

UPDATE polybot_config SET 
    execution_failure_rate = 0.10,
    resolution_loss_rate = 0.06,
    slippage_min_pct = 0.1,
    slippage_max_pct = 0.8,
    max_concurrent_positions = 25,
    max_position_pct = 8
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason)
VALUES 
    ('manual', 'execution_failure_rate', '0.15', '0.10', 'Lower failure rate for more fills'),
    ('manual', 'resolution_loss_rate', '0.08', '0.06', 'Less pessimistic loss rate'),
    ('manual', 'max_concurrent_positions', '20', '25', 'Allow more concurrent positions with larger bankroll');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM polybot_config_history ORDER BY created_at DESC LIMIT 20;
