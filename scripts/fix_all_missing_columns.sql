-- COMPREHENSIVE SCHEMA FIX
-- Generated from schema validation - fixes ALL missing columns
-- Run in Supabase SQL Editor to fix settings save issues
-- Generated: $(date)

-- ============================================
-- SCALP 15-MIN CRYPTO STRATEGY (ALL MISSING)
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scalp_15min_entry_threshold DECIMAL(5, 4) DEFAULT 0.45;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scalp_15min_max_position_usd DECIMAL(20, 4) DEFAULT 500;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scalp_15min_min_position_usd DECIMAL(20, 4) DEFAULT 50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scalp_15min_scan_interval_sec INTEGER DEFAULT 60;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scalp_15min_use_kelly BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scalp_15min_kelly_fraction DECIMAL(5, 4) DEFAULT 0.25;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scalp_15min_max_concurrent INTEGER DEFAULT 5;

-- ============================================
-- SPIKE HUNTER STRATEGY (ALL MISSING)
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spike_max_concurrent INTEGER DEFAULT 3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spike_max_duration_sec INTEGER DEFAULT 300;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spike_max_hold_sec INTEGER DEFAULT 600;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spike_max_position_usd DECIMAL(20, 4) DEFAULT 200;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spike_min_magnitude_pct DECIMAL(5, 4) DEFAULT 0.05;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spike_stop_loss_pct DECIMAL(5, 4) DEFAULT 0.03;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS spike_take_profit_pct DECIMAL(5, 4) DEFAULT 0.08;

-- ============================================
-- STOCK MOMENTUM (MISSING FIELDS)
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_momentum_lookback_days INTEGER DEFAULT 90;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_momentum_min_score DECIMAL(5, 4) DEFAULT 0.7;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_momentum_trailing_stop_pct DECIMAL(5, 4) DEFAULT 0.08;

-- ============================================
-- STOCK MEAN REVERSION (MISSING FIELDS)
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_rsi_oversold INTEGER DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_rsi_overbought INTEGER DEFAULT 70;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_take_profit_pct DECIMAL(5, 4) DEFAULT 0.05;

-- ============================================
-- CONGRESSIONAL TRACKER (MISSING FIELDS)
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS congress_chambers TEXT DEFAULT 'both';
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS congress_delay_hours INTEGER DEFAULT 24;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS congress_parties TEXT DEFAULT 'all';
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS congress_scan_interval_hours INTEGER DEFAULT 6;

-- ============================================
-- POLITICAL EVENT STRATEGY
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS political_event_max_position_usd DECIMAL(20, 4) DEFAULT 500;

-- ============================================
-- RISK MANAGEMENT (MISSING)
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_daily_loss DECIMAL(20, 4) DEFAULT 500;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS min_profit_percent DECIMAL(5, 4) DEFAULT 0.02;

-- ============================================
-- BOT MANAGER
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS bot_manager_enabled BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS scan_interval INTEGER DEFAULT 60;

-- ============================================
-- ALTERNATIVE PLATFORM ENABLE NAMES
-- These may be duplicates with different naming
-- ============================================
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS polymarket_enabled BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kalshi_enabled BOOLEAN DEFAULT true;

-- ============================================
-- VERIFY ALL COLUMNS
-- ============================================
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config'
AND column_name LIKE '%scalp_15min%'
ORDER BY column_name;
