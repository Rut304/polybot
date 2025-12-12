-- Add Twitter-Derived Strategy columns to polybot_config
-- Run this in Supabase SQL Editor

-- BTC Bracket Arbitrage
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_btc_bracket_arb BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS btc_bracket_min_discount_pct FLOAT DEFAULT 0.5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS btc_bracket_max_position_usd FLOAT DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS btc_bracket_scan_interval_sec INTEGER DEFAULT 15;

-- Bracket Compression
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_bracket_compression BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS bracket_max_imbalance_threshold FLOAT DEFAULT 0.30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS bracket_take_profit_pct FLOAT DEFAULT 3.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS bracket_stop_loss_pct FLOAT DEFAULT 10.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS bracket_max_position_usd FLOAT DEFAULT 100;

-- Kalshi Mention Sniping
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_mention_snipe BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_snipe_min_profit_cents INTEGER DEFAULT 2;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_snipe_max_position_usd FLOAT DEFAULT 100;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_snipe_max_latency_ms INTEGER DEFAULT 1000;

-- Whale Copy Trading
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_whale_copy_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS whale_copy_min_win_rate INTEGER DEFAULT 80;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS whale_copy_delay_seconds INTEGER DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS whale_copy_max_size_usd FLOAT DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS whale_copy_max_concurrent INTEGER DEFAULT 5;

-- Macro Board Strategy
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_macro_board BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS macro_max_exposure_usd FLOAT DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS macro_min_conviction_score INTEGER DEFAULT 70;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS macro_rebalance_interval_hours INTEGER DEFAULT 24;

-- Fear Premium Contrarian
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_fear_premium_contrarian BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS fear_extreme_low_threshold FLOAT DEFAULT 0.15;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS fear_extreme_high_threshold FLOAT DEFAULT 0.85;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS fear_min_premium_pct INTEGER DEFAULT 10;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS fear_max_position_usd FLOAT DEFAULT 200;

-- Verify all columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'polybot_config'
AND column_name LIKE '%bracket%' OR column_name LIKE '%whale%' 
OR column_name LIKE '%macro%' OR column_name LIKE '%fear%'
OR column_name LIKE '%kalshi_snipe%'
ORDER BY column_name;
