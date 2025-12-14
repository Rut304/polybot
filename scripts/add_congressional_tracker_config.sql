-- =====================================================================================
-- ADD CONGRESSIONAL TRACKER CONFIG COLUMNS
-- December 14, 2025
-- =====================================================================================
-- 
-- Run this in Supabase Dashboard > SQL Editor to add Congressional Tracker settings
-- =====================================================================================

-- Add Congressional Tracker configuration columns to polybot_config
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_congressional_tracker BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS congress_tracked_politicians TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS congress_chamber_filter TEXT DEFAULT 'both',
ADD COLUMN IF NOT EXISTS congress_copy_scale_pct DECIMAL(5,2) DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS congress_min_trade_amount_usd DECIMAL(10,2) DEFAULT 100.0,
ADD COLUMN IF NOT EXISTS congress_max_position_usd DECIMAL(10,2) DEFAULT 500.0,
ADD COLUMN IF NOT EXISTS congress_copy_delay_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS congress_data_source TEXT DEFAULT 'house_watcher';

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
AND column_name LIKE 'congress%' OR column_name = 'enable_congressional_tracker'
ORDER BY column_name;
