-- =====================================================================================
-- ULTRA AGGRESSIVE SIMULATION MODE 🔥🚀
-- December 13, 2025 - MAXIMUM OPPORTUNITIES
-- =====================================================================================
-- 
-- PHILOSOPHY: We want MORE trades even at lower win rates.
-- Risk-on simulation to explore what's possible!
--
-- CHANGES FROM CURRENT:
-- 1. LOWER profit thresholds → catch even marginal opportunities
-- 2. LOWER win rate requirements → accept riskier whale tracking
-- 3. LOWER conviction thresholds → more macro board positions
-- 4. HIGHER position sizes → bigger simulated P&L
-- 5. FASTER scan intervals → catch fleeting opportunities
-- 6. LOWER latency tolerance → more sniping opportunities
-- =====================================================================================

-- Log this session
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES ('manual', 'ULTRA_AGGRESSIVE_MODE', 'false', 'true', '🔥 ULTRA AGGRESSIVE - max opportunities for simulation learning', 'admin');

-- =====================================================================================
-- SECTION 1: CORE ARBITRAGE - Push to the Limit
-- =====================================================================================

-- Polymarket single-platform: Accept 0.1% spreads (0% fees means this is pure profit!)
UPDATE polybot_config SET 
    poly_single_min_profit_pct = 0.1,        -- Was 0.2, now 0.1% (almost any spread!)
    poly_single_max_spread_pct = 25,          -- Was 20, now 25% (super volatile markets)
    poly_single_scan_interval_sec = 10,       -- Was 15, now 10s (faster!)
    poly_single_max_position_usd = 100        -- Was 75, now $100
WHERE id = 1;

-- Kalshi single-platform: Lower threshold despite 7% fees (simulation!)
UPDATE polybot_config SET 
    kalshi_single_min_profit_pct = 3,        -- Was 8, now 3% (risky but more opps!)
    kalshi_single_max_spread_pct = 30,        -- Was 22, now 30%
    kalshi_single_scan_interval_sec = 20,     -- Was 30, now 20s
    kalshi_single_max_position_usd = 80       -- Was 60, now $80
WHERE id = 1;

-- Cross-platform: Aggressive matching
UPDATE polybot_config SET 
    cross_plat_min_profit_buy_poly_pct = 0.5,   -- Was 1.5, now 0.5%
    cross_plat_min_profit_buy_kalshi_pct = 3,   -- Was 6, now 3%
    cross_plat_min_similarity = 0.20,           -- Was 0.25, now 0.20 (more matches)
    cross_plat_scan_interval_sec = 30,          -- Was 45, now 30s
    cross_plat_max_position_usd = 100           -- Was 75, now $100
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'poly_single_min_profit_pct', '0.2', '0.1', '🎯 Ultra-low threshold (0% fees = pure profit)', 'admin'),
    ('manual', 'kalshi_single_min_profit_pct', '8', '3', '🎲 Very aggressive (will lose some, learn more)', 'admin'),
    ('manual', 'cross_plat_min_similarity', '0.25', '0.20', '🔍 Find more cross-platform matches', 'admin');

-- =====================================================================================
-- SECTION 2: TWITTER STRATEGIES - Loosen the Reins
-- =====================================================================================

-- BTC Bracket Arbitrage: Even smaller discounts are profitable at scale
UPDATE polybot_config SET 
    btc_bracket_min_discount_pct = 0.2,       -- Was 0.5, now 0.2% (micro-arb!)
    btc_bracket_max_position_usd = 150,       -- Was 50, now $150 (bigger!)
    btc_bracket_scan_interval_sec = 10        -- Was 15, now 10s (faster!)
WHERE id = 1;

-- Bracket Compression: Wider imbalance acceptance
UPDATE polybot_config SET 
    bracket_max_imbalance_threshold = 0.40,   -- Was 0.30, now 0.40 (bigger swings)
    bracket_take_profit_pct = 2.0,            -- Was 3.0, now 2.0% (exit faster)
    bracket_stop_loss_pct = 15.0,             -- Was 10, now 15% (more room)
    bracket_max_position_usd = 200            -- Was 100, now $200
WHERE id = 1;

-- Kalshi Mention Sniping: Lower latency tolerance = more snipes
UPDATE polybot_config SET 
    kalshi_snipe_min_profit_cents = 1,        -- Was 2, now 1¢ (more opps)
    kalshi_snipe_max_position_usd = 200,      -- Was 100, now $200
    kalshi_snipe_max_latency_ms = 2000        -- Was 1000, now 2s (more forgiving)
WHERE id = 1;

-- Whale Copy Trading: Lower win rate requirement = follow more whales
UPDATE polybot_config SET 
    whale_copy_min_win_rate = 65,             -- Was 80, now 65% (more whales!)
    whale_copy_delay_seconds = 15,            -- Was 30, now 15s (faster copies)
    whale_copy_max_size_usd = 100,            -- Was 50, now $100
    whale_copy_max_concurrent = 10            -- Was 5, now 10 concurrent
WHERE id = 1;

-- Macro Board: Lower conviction = more positions
UPDATE polybot_config SET 
    macro_max_exposure_usd = 10000,           -- Was 5000, now $10K
    macro_min_conviction_score = 55,          -- Was 70, now 55 (more macro bets)
    macro_rebalance_interval_hours = 12       -- Was 24, now 12h (more active)
WHERE id = 1;

-- Fear Premium Contrarian: Wider bands = more contrarian plays
UPDATE polybot_config SET 
    fear_extreme_low_threshold = 0.20,        -- Was 0.15, now 0.20 (more signals)
    fear_extreme_high_threshold = 0.80,       -- Was 0.85, now 0.80 (more signals)
    fear_min_premium_pct = 5,                 -- Was 10, now 5% (lower bar)
    fear_max_position_usd = 400               -- Was 200, now $400
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'whale_copy_min_win_rate', '80', '65', '🐋 Follow more whales (65%+ still profitable)', 'admin'),
    ('manual', 'macro_min_conviction_score', '70', '55', '🌍 More macro positions', 'admin'),
    ('manual', 'fear_extreme_low_threshold', '0.15', '0.20', '😱 Wider contrarian bands', 'admin');

-- =====================================================================================
-- SECTION 3: GLOBAL POSITION SIZING - GO BIG
-- =====================================================================================

UPDATE polybot_config SET 
    max_position_usd = 300,                   -- Was 244, now $300
    min_position_usd = 3,                     -- Was 5, now $3 (tiny trades OK)
    max_concurrent_positions = 50,            -- Was 35, now 50
    max_position_pct = 5                      -- Was 3, now 5% of bankroll
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'max_position_usd', '244', '300', '💰 Bigger positions in simulation', 'admin'),
    ('manual', 'max_concurrent_positions', '35', '50', '📈 More concurrent trades', 'admin');

-- =====================================================================================
-- SECTION 4: EXECUTION PARAMETERS - OPTIMISTIC
-- =====================================================================================

UPDATE polybot_config SET 
    execution_failure_rate = 0.05,            -- Was 0.08, now 5%
    resolution_loss_rate = 0.03,              -- Was 0.05, now 3%
    slippage_min_pct = 0.02,                  -- Was 0.05, now 0.02%
    slippage_max_pct = 0.3,                   -- Was 0.5, now 0.3%
    market_cooldown_seconds = 300             -- Was 900, now 5 min
WHERE id = 1;

-- =====================================================================================
-- SECTION 5: PAPER TRADER - SUPER AGGRESSIVE
-- =====================================================================================

UPDATE polybot_config SET 
    min_profit_threshold_pct = 1,             -- Was 2, now 1%
    max_realistic_spread_pct = 35             -- Was 25, now 35%
WHERE id = 1;

-- =====================================================================================
-- SECTION 6: ADDITIONAL STRATEGIES (if not already enabled)
-- =====================================================================================

-- Enable everything!
UPDATE polybot_config SET 
    enable_polymarket_single_arb = true,
    enable_kalshi_single_arb = true,
    enable_cross_platform_arb = true,
    enable_news_arbitrage = true,
    enable_market_making = true,
    enable_btc_bracket_arb = true,
    enable_bracket_compression = true,
    enable_kalshi_mention_snipe = true,
    enable_whale_copy_trading = true,
    enable_macro_board = true,
    enable_fear_premium_contrarian = true
WHERE id = 1;

-- =====================================================================================
-- SUMMARY OF ULTRA AGGRESSIVE CHANGES
-- =====================================================================================
/*
🎯 POLYMARKET SINGLE:
- min_profit: 0.2% → 0.1% (catch micro-arb!)
- scan: 15s → 10s (faster!)
- position: $75 → $100

💫 KALSHI SINGLE:
- min_profit: 8% → 3% (very aggressive!)
- scan: 30s → 20s
- position: $60 → $80

🌉 CROSS-PLATFORM:
- poly_min: 1.5% → 0.5%
- kalshi_min: 6% → 3%
- similarity: 0.25 → 0.20

🔥 BTC BRACKET ARB:
- min_discount: 0.5% → 0.2%
- position: $50 → $150

📊 BRACKET COMPRESSION:
- imbalance: 0.30 → 0.40
- position: $100 → $200

⚡ KALSHI SNIPING:
- min_profit: 2¢ → 1¢
- position: $100 → $200

🐋 WHALE COPY:
- win_rate: 80% → 65% (more whales!)
- position: $50 → $100
- concurrent: 5 → 10

🌍 MACRO BOARD:
- conviction: 70 → 55
- exposure: $5K → $10K

😱 FEAR CONTRARIAN:
- thresholds: wider bands
- position: $200 → $400

💰 GLOBAL:
- max_position: $244 → $300
- concurrent: 35 → 50
- cooldown: 15min → 5min
*/

SELECT 'ULTRA AGGRESSIVE MODE ENABLED! 🔥🚀 Ready to find maximum opportunities!' as status;
