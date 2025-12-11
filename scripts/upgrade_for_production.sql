-- ============================================================================
-- PRODUCTION UPGRADE SCRIPT - December 2025
-- Adds session_label for continuous data tracking and increases risk parameters
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD SESSION LABELS FOR CONTINUOUS DATA TRACKING
-- This allows filtering by trading session without losing historical data
-- ============================================================================

-- Add session_label to simulated trades table
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'simulation_v1';

-- Add session_label to real trades table  
ALTER TABLE polybot_trades
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'live_v1';

-- Add session_label to simulation stats
ALTER TABLE polybot_simulation_stats
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'simulation_v1';

-- Add session_label to balance history
ALTER TABLE polybot_balance_history
ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT 'simulation_v1';

-- Create indexes for efficient session filtering
CREATE INDEX IF NOT EXISTS idx_simulated_trades_session 
ON polybot_simulated_trades(session_label);

CREATE INDEX IF NOT EXISTS idx_trades_session 
ON polybot_trades(session_label);

CREATE INDEX IF NOT EXISTS idx_simulation_stats_session 
ON polybot_simulation_stats(session_label);

-- ============================================================================
-- SECTION 2: UPDATE BANKROLL TO $15K ($3K per platform)
-- ============================================================================

-- Update starting balances
UPDATE polybot_config SET value = '3000' WHERE key = 'polymarket_starting_balance';
UPDATE polybot_config SET value = '3000' WHERE key = 'kalshi_starting_balance';
UPDATE polybot_config SET value = '3000' WHERE key = 'binance_starting_balance';
UPDATE polybot_config SET value = '3000' WHERE key = 'coinbase_starting_balance';
UPDATE polybot_config SET value = '3000' WHERE key = 'alpaca_starting_balance';

-- Insert if not exists
INSERT INTO polybot_config (key, value) VALUES ('polymarket_starting_balance', '3000')
ON CONFLICT (key) DO UPDATE SET value = '3000';
INSERT INTO polybot_config (key, value) VALUES ('kalshi_starting_balance', '3000')
ON CONFLICT (key) DO UPDATE SET value = '3000';
INSERT INTO polybot_config (key, value) VALUES ('binance_starting_balance', '3000')
ON CONFLICT (key) DO UPDATE SET value = '3000';
INSERT INTO polybot_config (key, value) VALUES ('coinbase_starting_balance', '3000')
ON CONFLICT (key) DO UPDATE SET value = '3000';
INSERT INTO polybot_config (key, value) VALUES ('alpaca_starting_balance', '3000')
ON CONFLICT (key) DO UPDATE SET value = '3000';

-- ============================================================================
-- SECTION 3: INCREASE POSITION SIZES FOR MORE PROFIT PER TRADE
-- ============================================================================

-- Polymarket Single Platform - increase to $50
INSERT INTO polybot_config (key, value) VALUES ('poly_single_max_position_usd', '50')
ON CONFLICT (key) DO UPDATE SET value = '50';

-- Kalshi Single Platform - increase to $50
INSERT INTO polybot_config (key, value) VALUES ('kalshi_single_max_position_usd', '50')
ON CONFLICT (key) DO UPDATE SET value = '50';

-- Cross Platform - increase to $50
INSERT INTO polybot_config (key, value) VALUES ('cross_plat_max_position_usd', '50')
ON CONFLICT (key) DO UPDATE SET value = '50';

-- General max position - increase proportionally
INSERT INTO polybot_config (key, value) VALUES ('max_position_usd', '75')
ON CONFLICT (key) DO UPDATE SET value = '75';

-- Min position - keep reasonable
INSERT INTO polybot_config (key, value) VALUES ('min_position_usd', '10')
ON CONFLICT (key) DO UPDATE SET value = '10';

-- ============================================================================
-- SECTION 4: ENABLE ALL STRATEGIES & INCREASE RISK FOR MORE OPPS
-- Only changes that could turn green (not reckless)
-- ============================================================================

-- Core Arbitrage Strategies (ENABLED)
INSERT INTO polybot_config (key, value) VALUES ('enable_polymarket_single_arb', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
INSERT INTO polybot_config (key, value) VALUES ('enable_kalshi_single_arb', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
INSERT INTO polybot_config (key, value) VALUES ('enable_cross_platform_arb', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';

-- Lower Polymarket min profit to catch more opps (0% fees = can be aggressive)
INSERT INTO polybot_config (key, value) VALUES ('poly_single_min_profit_pct', '0.5')
ON CONFLICT (key) DO UPDATE SET value = '0.5';

-- Increase max spread to find more markets
INSERT INTO polybot_config (key, value) VALUES ('poly_single_max_spread_pct', '15')
ON CONFLICT (key) DO UPDATE SET value = '15';
INSERT INTO polybot_config (key, value) VALUES ('kalshi_single_max_spread_pct', '18')
ON CONFLICT (key) DO UPDATE SET value = '18';

-- Faster scanning intervals to catch more opportunities
INSERT INTO polybot_config (key, value) VALUES ('poly_single_scan_interval_sec', '20')
ON CONFLICT (key) DO UPDATE SET value = '20';
INSERT INTO polybot_config (key, value) VALUES ('kalshi_single_scan_interval_sec', '45')
ON CONFLICT (key) DO UPDATE SET value = '45';
INSERT INTO polybot_config (key, value) VALUES ('cross_plat_scan_interval_sec', '60')
ON CONFLICT (key) DO UPDATE SET value = '60';

-- Cross platform - lower similarity threshold to find more matches
INSERT INTO polybot_config (key, value) VALUES ('cross_plat_min_similarity', '0.30')
ON CONFLICT (key) DO UPDATE SET value = '0.30';

-- Enable News Arbitrage (catches price divergence on news events)
INSERT INTO polybot_config (key, value) VALUES ('enable_news_arbitrage', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
INSERT INTO polybot_config (key, value) VALUES ('news_min_spread_pct', '2.5')
ON CONFLICT (key) DO UPDATE SET value = '2.5';
INSERT INTO polybot_config (key, value) VALUES ('news_position_size_usd', '40')
ON CONFLICT (key) DO UPDATE SET value = '40';

-- ============================================================================
-- SECTION 5: REDUCE EXECUTION FRICTION FOR MORE TRADES
-- (Slightly more aggressive but still realistic)
-- ============================================================================

-- Lower execution failure rate (better fills in simulation)
INSERT INTO polybot_config (key, value) VALUES ('execution_failure_rate', '0.10')
ON CONFLICT (key) DO UPDATE SET value = '0.10';

-- Lower resolution loss rate (still realistic but not overly pessimistic)
INSERT INTO polybot_config (key, value) VALUES ('resolution_loss_rate', '0.06')
ON CONFLICT (key) DO UPDATE SET value = '0.06';

-- Tighter slippage range
INSERT INTO polybot_config (key, value) VALUES ('slippage_min_pct', '0.1')
ON CONFLICT (key) DO UPDATE SET value = '0.1';
INSERT INTO polybot_config (key, value) VALUES ('slippage_max_pct', '0.8')
ON CONFLICT (key) DO UPDATE SET value = '0.8';

-- ============================================================================
-- SECTION 6: CONCURRENT POSITION LIMITS
-- ============================================================================

-- Allow more concurrent positions with larger bankroll
INSERT INTO polybot_config (key, value) VALUES ('max_concurrent_positions', '25')
ON CONFLICT (key) DO UPDATE SET value = '25';

-- Max exposure per market (% of bankroll)
INSERT INTO polybot_config (key, value) VALUES ('max_position_pct', '8')
ON CONFLICT (key) DO UPDATE SET value = '8';

-- ============================================================================
-- VERIFICATION QUERY - Run this to check your config
-- ============================================================================
-- SELECT key, value FROM polybot_config 
-- WHERE key IN (
--   'polymarket_starting_balance', 'kalshi_starting_balance',
--   'poly_single_max_position_usd', 'kalshi_single_max_position_usd',
--   'enable_polymarket_single_arb', 'enable_kalshi_single_arb', 
--   'enable_cross_platform_arb', 'enable_news_arbitrage',
--   'execution_failure_rate', 'resolution_loss_rate'
-- )
-- ORDER BY key;
