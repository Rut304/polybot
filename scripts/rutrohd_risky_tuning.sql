-- =====================================================================================
-- RUTROHD USER - ULTRA-RISKY SIMULATION TUNING 🎰🔥
-- January 2025 - Maximum Trade Frequency for Learning
-- =====================================================================================
-- 
-- PURPOSE: User RutRohd wants VERY aggressive settings for simulation learning.
-- Lower all thresholds to generate maximum trade volume and learn from results.
--
-- ⚠️ WARNING: These settings will generate MORE losses but also more data!
-- Only use for SIMULATION MODE - never live trading with these settings.
-- =====================================================================================

-- First, get or create config for RutRohd user
-- (Assumes RutRohd user exists in auth.users - adjust user_id as needed)

-- Log this tuning session
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES ('manual', 'RUTROHD_RISKY_MODE', 'false', 'true', '🎰 RUTROHD ultra-risky tuning for simulation', 'rutrohd');

-- =====================================================================================
-- AI SUPERFORECASTING - Very Aggressive
-- =====================================================================================
-- Current defaults: min_divergence=10%, confidence=0.65
-- New: min_divergence=5%, confidence=0.55 (MUCH more trades!)

UPDATE polybot_config SET 
    ai_min_divergence_pct = 5.0,              -- Was 10%, now 5% (2x more signals!)
    ai_min_confidence = 0.55,                 -- Was 0.65, now 0.55 (lower bar)
    ai_max_position_usd = 150,                -- Was 100, now $150
    ai_scan_interval_sec = 180,               -- Was 300, now 3min (faster!)
    enable_ai_superforecasting = true         -- Make sure it's enabled
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'ai_min_divergence_pct', '10.0', '5.0', '🧠 AI: Lower divergence = more opportunities', 'rutrohd'),
    ('manual', 'ai_min_confidence', '0.65', '0.55', '🧠 AI: Lower confidence threshold', 'rutrohd');

-- =====================================================================================
-- WHALE COPY TRADING - Very Aggressive  
-- =====================================================================================
-- Current defaults: win_rate=75-80%, delay=30s
-- New: win_rate=60%, delay=10s (follow more whales, faster!)

UPDATE polybot_config SET 
    whale_copy_min_win_rate = 60,             -- Was 75-80, now 60% (MANY more whales!)
    whale_copy_delay_seconds = 10,            -- Was 30, now 10s (faster copies)
    whale_copy_max_size_usd = 150,            -- Was 50-100, now $150
    whale_copy_max_concurrent = 15,           -- Was 5-10, now 15 concurrent
    enable_whale_copy_trading = true          -- Make sure it's enabled
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'whale_copy_min_win_rate', '75', '60', '🐋 Whale: Follow 60%+ win rate wallets', 'rutrohd'),
    ('manual', 'whale_copy_delay_seconds', '30', '10', '🐋 Whale: Copy faster (10s)', 'rutrohd');

-- =====================================================================================
-- SELECTIVE WHALE COPY - Even More Aggressive
-- =====================================================================================

UPDATE polybot_config SET 
    selective_whale_min_win_rate = 0.55,      -- Was 0.65, now 0.55 (55%+ win rate)
    selective_whale_min_roi = 0.10,           -- Was 0.20, now 0.10 (10% ROI minimum)
    selective_whale_min_trades = 5,           -- Was 10, now 5 trades minimum
    selective_whale_copy_scale_pct = 10.0,    -- Was 5%, now 10% scale
    selective_whale_max_position_usd = 300,   -- Was 200, now $300
    enable_selective_whale_copy = true        -- Make sure it's enabled
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'selective_whale_min_win_rate', '0.65', '0.55', '🐋 Selective: Lower win rate bar', 'rutrohd'),
    ('manual', 'selective_whale_min_roi', '0.20', '0.10', '🐋 Selective: Lower ROI requirement', 'rutrohd');

-- =====================================================================================
-- CROSS-PLATFORM ARBITRAGE - Aggressive Matching
-- =====================================================================================
-- Current: 3-5% profit thresholds
-- New: 2% (catch smaller cross-platform spreads)

UPDATE polybot_config SET 
    cross_plat_min_profit_buy_poly_pct = 0.3, -- Was 0.5-1.5%, now 0.3%
    cross_plat_min_profit_buy_kalshi_pct = 2, -- Was 3-6%, now 2%
    cross_plat_min_similarity = 0.15,         -- Was 0.20-0.25, now 0.15 (more matches!)
    cross_plat_scan_interval_sec = 20,        -- Was 30-45, now 20s
    cross_plat_max_position_usd = 150,        -- Was 75-100, now $150
    enable_cross_platform_arb = true          -- Make sure it's enabled
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'cross_plat_min_profit_buy_kalshi_pct', '3', '2', '🌉 Cross-platform: 2% threshold', 'rutrohd'),
    ('manual', 'cross_plat_min_similarity', '0.20', '0.15', '🌉 Cross-platform: More market matches', 'rutrohd');

-- =====================================================================================
-- CONGRESSIONAL TRACKER - Aggressive
-- =====================================================================================

UPDATE polybot_config SET 
    congress_min_trade_amount_usd = 10000,    -- Was 15000, now $10K (smaller trades)
    congress_copy_scale_pct = 15.0,           -- Was 10%, now 15%
    congress_max_position_usd = 750,          -- Was 500, now $750
    congress_delay_hours = 0,                 -- No delay (immediate copy)
    congress_scan_interval_hours = 3,         -- Was 6h, now 3h
    enable_congressional_tracker = true       -- Make sure it's enabled
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'congress_min_trade_amount_usd', '15000', '10000', '🏛️ Congress: Track smaller trades', 'rutrohd'),
    ('manual', 'congress_copy_scale_pct', '10', '15', '🏛️ Congress: Bigger copy scale', 'rutrohd');

-- =====================================================================================
-- NEWS ARBITRAGE - Fast & Aggressive
-- =====================================================================================

UPDATE polybot_config SET 
    news_min_spread_pct = 1.0,                -- Was 2-3%, now 1%
    news_max_lag_minutes = 30,                -- Was 15, now 30min (older news OK)
    news_position_size_usd = 150,             -- Was 100, now $150
    news_scan_interval_sec = 60,              -- Was 120, now 60s
    enable_news_arbitrage = true              -- Make sure it's enabled
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'news_min_spread_pct', '2', '1', '📰 News: Lower spread threshold', 'rutrohd'),
    ('manual', 'news_max_lag_minutes', '15', '30', '📰 News: Accept older news', 'rutrohd');

-- =====================================================================================
-- SPIKE HUNTER - Aggressive Spike Detection
-- =====================================================================================

UPDATE polybot_config SET 
    spike_min_magnitude_pct = 1.5,            -- Was 2.0%, now 1.5% (smaller spikes)
    spike_max_duration_sec = 45,              -- Was 30s, now 45s (longer window)
    spike_take_profit_pct = 1.0,              -- Was 1.5%, now 1% (exit faster)
    spike_stop_loss_pct = 5.0,                -- Was 3%, now 5% (more room)
    spike_max_position_usd = 75,              -- Was 50, now $75
    spike_max_concurrent = 5,                 -- Was 3, now 5 concurrent
    enable_spike_hunter = true                -- Make sure it's enabled
WHERE id = 1;

INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'spike_min_magnitude_pct', '2.0', '1.5', '⚡ Spike: Detect smaller spikes', 'rutrohd'),
    ('manual', 'spike_max_concurrent', '3', '5', '⚡ Spike: More concurrent positions', 'rutrohd');

-- =====================================================================================
-- FEAR PREMIUM CONTRARIAN - Wider Bands
-- =====================================================================================

UPDATE polybot_config SET 
    fear_extreme_low_threshold = 0.25,        -- Was 0.15-0.20, now 0.25 (more signals)
    fear_extreme_high_threshold = 0.75,       -- Was 0.80-0.85, now 0.75 (more signals)
    fear_min_premium_pct = 3,                 -- Was 5-10%, now 3%
    fear_max_position_usd = 500,              -- Was 200-400, now $500
    enable_fear_premium_contrarian = true     -- Make sure it's enabled
WHERE id = 1;

-- =====================================================================================
-- GLOBAL POSITION SIZING - HIGH RISK
-- =====================================================================================

UPDATE polybot_config SET 
    max_position_usd = 400,                   -- Was 244-300, now $400
    min_position_usd = 2,                     -- Was 3-5, now $2
    max_concurrent_positions = 75,            -- Was 35-50, now 75
    max_position_pct = 7                      -- Was 3-5%, now 7% of bankroll
WHERE id = 1;

-- =====================================================================================
-- SUMMARY
-- =====================================================================================
/*
🎰 RUTROHD ULTRA-RISKY SETTINGS APPLIED:

🧠 AI SUPERFORECASTING:
  - min_divergence: 10% → 5% (2x more signals!)
  - confidence: 0.65 → 0.55
  - position: $100 → $150
  - scan: 5min → 3min

🐋 WHALE COPY:
  - win_rate: 75% → 60% (MANY more whales!)
  - delay: 30s → 10s
  - position: $100 → $150
  - concurrent: 10 → 15

🌉 CROSS-PLATFORM:
  - kalshi_min: 3% → 2%
  - similarity: 0.20 → 0.15
  - position: $100 → $150

🏛️ CONGRESSIONAL:
  - min_trade: $15K → $10K
  - scale: 10% → 15%
  - position: $500 → $750

📰 NEWS:
  - spread: 2% → 1%
  - lag: 15min → 30min

⚡ SPIKE HUNTER:
  - magnitude: 2% → 1.5%
  - concurrent: 3 → 5

😱 FEAR CONTRARIAN:
  - wider bands (0.25-0.75)
  - premium: 5% → 3%

💰 GLOBAL:
  - max_position: $400
  - concurrent: 75 positions
  - bankroll %: 7%

⚠️ REMEMBER: These settings will generate MANY trades, some losses!
   Perfect for simulation learning, NOT for live trading.
*/

SELECT '🎰 RUTROHD ULTRA-RISKY MODE ENABLED! Maximum trade frequency for simulation learning!' as status;
