-- ============================================================================
-- FIX UNREALISTIC SIMULATION - December 12, 2025
-- Problem: Bot trading same Kalshi market 100+ times = unrealistic & ban risk
-- ============================================================================

-- ============================================================================
-- SECTION 1: CRITICAL - MUCH LONGER COOLDOWNS
-- In real trading, you can't buy/sell the same position over and over
-- ============================================================================

-- Set much longer cooldowns per market
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS market_cooldown_seconds INTEGER DEFAULT 3600;
UPDATE polybot_config SET market_cooldown_seconds = 86400 WHERE id = 1;  -- 24 HOURS, not 15 min!

-- Add per-market trade limit
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_trades_per_market_per_day INTEGER DEFAULT 2;
UPDATE polybot_config SET max_trades_per_market_per_day = 2 WHERE id = 1;  -- Max 2 trades per market per day

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'market_cooldown_seconds', '900', '86400', '🛑 24 hour cooldown - realistic Kalshi trading', 'admin'),
    ('manual', 'max_trades_per_market_per_day', 'unlimited', '2', '🛑 Max 2 trades per market per day - prevent ban', 'admin');

-- ============================================================================
-- SECTION 2: RAISE KALSHI THRESHOLDS BACK UP
-- With 7% fees, need higher spreads to actually profit
-- ============================================================================

UPDATE polybot_config SET kalshi_single_min_profit_pct = 8 WHERE id = 1;  -- Back to 8%, not 5%

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'kalshi_single_min_profit_pct', '5', '8', '🛑 Raised back - 7% fees need 8%+ spread', 'admin');

-- ============================================================================
-- SECTION 3: ADD REALISTIC LOSS RATES
-- The 95% win rate is too optimistic for Kalshi single-platform
-- ============================================================================

-- Higher loss rate for Kalshi (accounting for 7% fee eating profits)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_resolution_loss_rate NUMERIC(4,2) DEFAULT 0.15;
UPDATE polybot_config SET kalshi_resolution_loss_rate = 0.15 WHERE id = 1;  -- 15% loss rate

-- Higher execution failure for Kalshi (less liquid)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_execution_failure_rate NUMERIC(4,2) DEFAULT 0.15;
UPDATE polybot_config SET kalshi_execution_failure_rate = 0.15 WHERE id = 1;  -- 15% failure

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'kalshi_resolution_loss_rate', '0.05', '0.15', '🛑 More realistic - Kalshi arb is riskier', 'admin'),
    ('manual', 'kalshi_execution_failure_rate', '0.08', '0.15', '🛑 More realistic - Kalshi less liquid', 'admin');

-- ============================================================================
-- SECTION 4: LIMIT POSITION CONCENTRATION
-- Prevent putting all eggs in one basket
-- ============================================================================

-- Lower max position per market to spread risk
UPDATE polybot_config SET 
    kalshi_single_max_position_usd = 40,  -- Was 60, now 40
    max_position_pct = 3                  -- Was 10%, now 3% max per trade
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'kalshi_single_max_position_usd', '60', '40', '🛑 Smaller Kalshi positions - lower risk', 'admin'),
    ('manual', 'max_position_pct', '10', '3', '🛑 Max 3% per trade - diversify', 'admin');

-- ============================================================================
-- SECTION 5: REDUCE OVERALL AGGRESSIVENESS
-- Pull back from "exploration mode" to something more realistic
-- ============================================================================

-- More realistic slippage and failure rates
UPDATE polybot_config SET 
    execution_failure_rate = 0.12,    -- Was 0.08, now 12%
    resolution_loss_rate = 0.10,      -- Was 0.05, now 10%
    slippage_min_pct = 0.15,          -- Was 0.05, now 0.15%
    slippage_max_pct = 1.0            -- Was 0.5, now 1.0%
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'execution_failure_rate', '0.08', '0.12', '🛑 More realistic execution failure', 'admin'),
    ('manual', 'resolution_loss_rate', '0.05', '0.10', '🛑 More realistic resolution loss', 'admin'),
    ('manual', 'slippage_min_pct', '0.05', '0.15', '🛑 More realistic slippage', 'admin'),
    ('manual', 'slippage_max_pct', '0.50', '1.0', '🛑 More realistic max slippage', 'admin');

-- ============================================================================
-- SUMMARY: Key Changes to Make Simulation Realistic
-- ============================================================================
/*
PROBLEM: Bot traded same "James Bond" market 100+ times in 12 hours
- Unrealistic: Real exchanges would flag this as market manipulation
- Unsustainable: You can only hold position once, not trade infinitely

FIXES:
1. 24-HOUR COOLDOWN per market (was 15 min) - can only trade each market once/day
2. MAX 2 TRADES per market per day - hard limit
3. KALSHI MIN PROFIT back to 8% (was 5%) - need to cover 7% fees
4. HIGHER LOSS RATES: 15% for Kalshi (was 5%)
5. HIGHER FAILURE RATES: 12-15% (was 8%)
6. SMALLER POSITIONS: $40 max (was $60), 3% max (was 10%)
7. MORE SLIPPAGE: 0.15-1.0% (was 0.05-0.5%)

EXPECTED RESULTS:
- Fewer trades (realistic)
- Lower win rate (realistic)
- Lower but believable ROI
- Diverse market exposure instead of one market
*/

SELECT 'Simulation parameters adjusted for REALISM! 🎯' as status;
