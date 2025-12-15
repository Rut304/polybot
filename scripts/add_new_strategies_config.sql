-- Add new strategy configuration columns to polybot_config
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- Political Event Strategy (80% CONFIDENCE)
-- ============================================
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_political_event_strategy BOOLEAN DEFAULT FALSE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS political_min_conviction_score DECIMAL(5,2) DEFAULT 0.75;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS political_max_position_usd DECIMAL(12,2) DEFAULT 500.00;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS political_max_concurrent_events INTEGER DEFAULT 5;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS political_event_categories TEXT DEFAULT 'elections,legislation,policy,appointments';

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS political_lead_time_hours INTEGER DEFAULT 48;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS political_exit_buffer_hours INTEGER DEFAULT 2;

-- Additional columns used by settings UI
ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS political_event_min_edge_pct DECIMAL(5,2) DEFAULT 5.00;

ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS political_event_monitor_interval_sec INTEGER DEFAULT 300;

-- ============================================
-- High Conviction Strategy (85% CONFIDENCE)
-- ============================================
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_high_conviction_strategy BOOLEAN DEFAULT FALSE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS high_conviction_min_score DECIMAL(5,2) DEFAULT 80.00;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS high_conviction_max_positions INTEGER DEFAULT 3;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS high_conviction_min_signals INTEGER DEFAULT 3;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS high_conviction_position_pct DECIMAL(5,2) DEFAULT 15.00;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS high_conviction_use_kelly BOOLEAN DEFAULT TRUE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS high_conviction_kelly_fraction DECIMAL(5,2) DEFAULT 0.25;

-- Additional columns used by settings UI
ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS high_conviction_min_volume INTEGER DEFAULT 50000;

ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS high_conviction_max_position_usd DECIMAL(12,2) DEFAULT 250.00;

ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS high_conviction_scan_interval_sec INTEGER DEFAULT 120;

-- ============================================
-- Selective Whale Copy Strategy (80% CONFIDENCE)
-- ============================================
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_selective_whale_copy BOOLEAN DEFAULT FALSE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS selective_whale_min_win_rate DECIMAL(5,2) DEFAULT 65.00;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS selective_whale_min_roi DECIMAL(5,2) DEFAULT 0.20;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS selective_whale_min_trades INTEGER DEFAULT 10;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS selective_whale_max_tracked INTEGER DEFAULT 10;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS selective_whale_auto_select BOOLEAN DEFAULT TRUE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS selective_whale_copy_scale_pct DECIMAL(5,2) DEFAULT 5.00;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS selective_whale_max_position_usd DECIMAL(12,2) DEFAULT 200.00;

-- Additional columns used by settings UI
ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS selective_whale_min_pnl INTEGER DEFAULT 5000;

ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS selective_whale_max_copy_size_usd DECIMAL(12,2) DEFAULT 100.00;

ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS selective_whale_delay_seconds INTEGER DEFAULT 30;

-- ============================================
-- Verify columns were added
-- ============================================
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'polybot_config'
AND (column_name LIKE '%political%' 
   OR column_name LIKE '%high_conviction%'
   OR column_name LIKE '%selective_whale%')
ORDER BY column_name;
