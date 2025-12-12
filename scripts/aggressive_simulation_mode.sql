-- ============================================================================
-- AGGRESSIVE SIMULATION MODE - Push the Limits! 🚀
-- December 2025 - Time to explore and find more opportunities
-- ============================================================================
-- 
-- PHILOSOPHY: In simulation mode, we WANT to see what happens with risky trades.
-- Better to learn from simulated losses than real ones!
--
-- KEY CHANGES:
-- 1. LOWER profit thresholds → find MORE opportunities (even marginal ones)
-- 2. HIGHER max spreads → accept more volatile/illiquid markets
-- 3. FASTER scan intervals → catch fleeting opportunities
-- 4. LOWER similarity threshold → find more cross-platform matches
-- 5. REDUCED cooldowns → trade same markets more frequently
-- 6. INCREASED position sizes → bigger simulated trades
-- ============================================================================

-- Log all these changes to history
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'AGGRESSIVE_MODE_ENABLED', 'false', 'true', '🚀 Enabling aggressive simulation mode to find more opportunities', 'admin');

-- ============================================================================
-- SECTION 1: POLYMARKET SINGLE-PLATFORM - Go Ultra Aggressive
-- Research shows 0.3% spreads are profitable with 0% fees
-- ============================================================================

-- Lower min profit to catch micro-arbitrage
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_min_profit_pct NUMERIC(6,3) DEFAULT 0.5;
UPDATE polybot_config SET poly_single_min_profit_pct = 0.2 WHERE id = 1;  -- Was 0.5, now 0.2%

-- Raise max spread to include more volatile markets
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_max_spread_pct NUMERIC(6,2) DEFAULT 12;
UPDATE polybot_config SET poly_single_max_spread_pct = 20 WHERE id = 1;  -- Was 15, now 20%

-- Faster scanning - every 15 seconds instead of 20
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_scan_interval_sec INTEGER DEFAULT 30;
UPDATE polybot_config SET poly_single_scan_interval_sec = 15 WHERE id = 1;

-- Log changes
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'poly_single_min_profit_pct', '0.5', '0.2', '🎯 Ultra-low threshold to catch micro-arb (Polymarket has 0% fees)', 'admin'),
    ('manual', 'poly_single_max_spread_pct', '15', '20', '📈 Accept more volatile markets', 'admin'),
    ('manual', 'poly_single_scan_interval_sec', '20', '15', '⚡ Faster scanning', 'admin');

-- ============================================================================
-- SECTION 2: KALSHI SINGLE-PLATFORM - Reduce Threshold Despite 7% Fees
-- In simulation, we want to see what happens with lower margins
-- ============================================================================

-- Lower Kalshi min profit (risky with 7% fees, but let's see!)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_min_profit_pct NUMERIC(6,2) DEFAULT 8;
UPDATE polybot_config SET kalshi_single_min_profit_pct = 5 WHERE id = 1;  -- Was 8%, now 5%

-- Raise Kalshi max spread
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_max_spread_pct NUMERIC(6,2) DEFAULT 15;
UPDATE polybot_config SET kalshi_single_max_spread_pct = 22 WHERE id = 1;  -- Was 18, now 22%

-- Faster Kalshi scanning
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_scan_interval_sec INTEGER DEFAULT 60;
UPDATE polybot_config SET kalshi_single_scan_interval_sec = 30 WHERE id = 1;  -- Was 45s, now 30s

-- Log changes
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'kalshi_single_min_profit_pct', '8', '5', '🎲 Accept lower margins (risky with 7% fees, but simulating!)', 'admin'),
    ('manual', 'kalshi_single_max_spread_pct', '18', '22', '📈 Cast wider net for opportunities', 'admin'),
    ('manual', 'kalshi_single_scan_interval_sec', '45', '30', '⚡ Faster Kalshi scanning', 'admin');

-- ============================================================================
-- SECTION 3: CROSS-PLATFORM - Lower Barriers
-- ============================================================================

-- Lower cross-platform thresholds
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_poly_pct NUMERIC(6,2) DEFAULT 2.5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_kalshi_pct NUMERIC(6,2) DEFAULT 9;
UPDATE polybot_config SET 
    cross_plat_min_profit_buy_poly_pct = 1.5,  -- Was 2.5, now 1.5%
    cross_plat_min_profit_buy_kalshi_pct = 6   -- Was 9, now 6%
WHERE id = 1;

-- Lower similarity threshold to find more matches
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_min_similarity NUMERIC(4,2) DEFAULT 0.35;
UPDATE polybot_config SET cross_plat_min_similarity = 0.25 WHERE id = 1;  -- Was 0.30, now 0.25

-- Faster cross-platform scanning
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_scan_interval_sec INTEGER DEFAULT 90;
UPDATE polybot_config SET cross_plat_scan_interval_sec = 45 WHERE id = 1;  -- Was 60s, now 45s

-- Log changes
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'cross_plat_min_profit_buy_poly_pct', '2.5', '1.5', '🌉 Lower threshold for Poly→Kalshi arb', 'admin'),
    ('manual', 'cross_plat_min_profit_buy_kalshi_pct', '9', '6', '🌉 Lower threshold for Kalshi→Poly arb', 'admin'),
    ('manual', 'cross_plat_min_similarity', '0.30', '0.25', '🔍 Find more cross-platform matches', 'admin'),
    ('manual', 'cross_plat_scan_interval_sec', '60', '45', '⚡ Faster cross-platform scanning', 'admin');

-- ============================================================================
-- SECTION 4: GLOBAL EXECUTION PARAMETERS - More Aggressive
-- ============================================================================

-- Lower execution failure simulation (optimistic)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS execution_failure_rate NUMERIC(4,2) DEFAULT 0.15;
UPDATE polybot_config SET execution_failure_rate = 0.08 WHERE id = 1;  -- Was 0.10, now 8%

-- Lower resolution loss rate (more optimistic)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS resolution_loss_rate NUMERIC(4,2) DEFAULT 0.08;
UPDATE polybot_config SET resolution_loss_rate = 0.05 WHERE id = 1;  -- Was 0.06, now 5%

-- Lower slippage simulation
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_min_pct NUMERIC(4,2) DEFAULT 0.2;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_max_pct NUMERIC(4,2) DEFAULT 1.0;
UPDATE polybot_config SET 
    slippage_min_pct = 0.05,   -- Was 0.1, now 0.05%
    slippage_max_pct = 0.5     -- Was 0.8, now 0.5%
WHERE id = 1;

-- Reduce market cooldown (trade same market faster)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS market_cooldown_seconds INTEGER DEFAULT 3600;
UPDATE polybot_config SET market_cooldown_seconds = 900 WHERE id = 1;  -- Was 1 hour, now 15 min

-- Log changes
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'execution_failure_rate', '0.10', '0.08', '✅ More optimistic execution', 'admin'),
    ('manual', 'resolution_loss_rate', '0.06', '0.05', '✅ More optimistic resolution', 'admin'),
    ('manual', 'slippage_min_pct', '0.10', '0.05', '✅ Lower simulated slippage', 'admin'),
    ('manual', 'slippage_max_pct', '0.80', '0.50', '✅ Lower max slippage', 'admin'),
    ('manual', 'market_cooldown_seconds', '3600', '900', '🔄 Trade same markets more frequently', 'admin');

-- ============================================================================
-- SECTION 5: POSITION SIZING - Bigger Bets
-- ============================================================================

-- Increase position sizes
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS poly_single_max_position_usd NUMERIC(10,2) DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_max_position_usd NUMERIC(10,2) DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS cross_plat_max_position_usd NUMERIC(10,2) DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_position_usd NUMERIC(10,2) DEFAULT 75;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS min_position_usd NUMERIC(10,2) DEFAULT 10;

UPDATE polybot_config SET 
    poly_single_max_position_usd = 75,    -- Was 50, now 75
    kalshi_single_max_position_usd = 60,  -- Was 50, now 60
    cross_plat_max_position_usd = 75,     -- Was 50, now 75
    max_position_usd = 100,               -- Was 75, now 100
    min_position_usd = 5                  -- Was 10, now 5 (smaller trades OK)
WHERE id = 1;

-- Increase concurrent positions
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_concurrent_positions INTEGER DEFAULT 20;
UPDATE polybot_config SET max_concurrent_positions = 35 WHERE id = 1;  -- Was 25, now 35

-- Increase max % of balance per trade
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_position_pct NUMERIC(4,2) DEFAULT 5;
UPDATE polybot_config SET max_position_pct = 10 WHERE id = 1;  -- Was 8%, now 10%

-- Log changes
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'poly_single_max_position_usd', '50', '75', '💰 Bigger Poly positions', 'admin'),
    ('manual', 'kalshi_single_max_position_usd', '50', '60', '💰 Bigger Kalshi positions', 'admin'),
    ('manual', 'cross_plat_max_position_usd', '50', '75', '💰 Bigger cross-platform positions', 'admin'),
    ('manual', 'max_position_usd', '75', '100', '💰 Max trade size increased', 'admin'),
    ('manual', 'min_position_usd', '10', '5', '📉 Allow smaller trades too', 'admin'),
    ('manual', 'max_concurrent_positions', '25', '35', '📈 More concurrent positions', 'admin'),
    ('manual', 'max_position_pct', '8', '10', '📈 Larger % of bankroll per trade', 'admin');

-- ============================================================================
-- SECTION 6: ENABLE ALL STRATEGIES
-- ============================================================================

ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_polymarket_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_cross_platform_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_news_arbitrage BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_market_making BOOLEAN DEFAULT false;

UPDATE polybot_config SET 
    enable_polymarket_single_arb = true,
    enable_kalshi_single_arb = true,
    enable_cross_platform_arb = true,
    enable_news_arbitrage = true,
    enable_market_making = true  -- Try market making in simulation!
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'enable_news_arbitrage', 'true', 'true', '📰 News arbitrage enabled', 'admin'),
    ('manual', 'enable_market_making', 'false', 'true', '🏪 Market making enabled for simulation', 'admin');

-- ============================================================================
-- SECTION 7: PAPER TRADER SPECIFIC - More Aggressive Simulation
-- ============================================================================

-- Global min profit for paper trader
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS min_profit_threshold_pct NUMERIC(6,2) DEFAULT 5;
UPDATE polybot_config SET min_profit_threshold_pct = 2 WHERE id = 1;  -- Was 5%, now 2%

-- Max realistic spread (paper trader false positive filter)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_realistic_spread_pct NUMERIC(6,2) DEFAULT 12;
UPDATE polybot_config SET max_realistic_spread_pct = 25 WHERE id = 1;  -- Was 12%, now 25%

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'min_profit_threshold_pct', '5', '2', '🎯 Paper trader accepts lower profits', 'admin'),
    ('manual', 'max_realistic_spread_pct', '12', '25', '📈 Paper trader accepts larger spreads', 'admin');

-- ============================================================================
-- SUMMARY OF AGGRESSIVE CHANGES
-- ============================================================================
/*
POLYMARKET SINGLE:
- min_profit: 0.5% → 0.2% (catch micro-arb!)
- max_spread: 15% → 20% (more volatile markets)
- scan_interval: 20s → 15s (faster)

KALSHI SINGLE:
- min_profit: 8% → 5% (risky with 7% fees, but simulating!)
- max_spread: 18% → 22% (wider net)
- scan_interval: 45s → 30s (faster)

CROSS-PLATFORM:
- buy_poly_min: 2.5% → 1.5%
- buy_kalshi_min: 9% → 6%
- similarity: 0.30 → 0.25 (more matches)
- scan_interval: 60s → 45s (faster)

EXECUTION:
- failure_rate: 10% → 8%
- loss_rate: 6% → 5%
- slippage: lower
- cooldown: 1hr → 15min

POSITIONS:
- poly_max: $50 → $75
- kalshi_max: $50 → $60
- cross_max: $50 → $75
- max_concurrent: 25 → 35
- max_pct: 8% → 10%

PAPER TRADER:
- min_profit: 5% → 2%
- max_spread: 12% → 25%
*/

-- Verify changes
SELECT 'Configuration updated to AGGRESSIVE mode! 🚀' as status;
