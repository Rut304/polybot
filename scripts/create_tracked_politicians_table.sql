-- =====================================================================================
-- CREATE TRACKED POLITICIANS TABLE
-- December 14, 2025
-- =====================================================================================
-- 
-- Run this in Supabase Dashboard > SQL Editor to create the tracked politicians table
-- =====================================================================================

-- Table to store politicians being tracked for copy trading
CREATE TABLE IF NOT EXISTS polybot_tracked_politicians (
    id BIGSERIAL PRIMARY KEY,
    politician_name TEXT UNIQUE NOT NULL,
    chamber TEXT NOT NULL,  -- 'house' or 'senate'
    party TEXT,
    state TEXT,
    
    -- Tracking settings
    copy_enabled BOOLEAN DEFAULT false,
    copy_scale_pct DECIMAL(5,2) DEFAULT 10.0,  -- What % of their trades to copy
    min_trade_amount_usd DECIMAL(10,2) DEFAULT 100.0,
    max_position_usd DECIMAL(10,2) DEFAULT 500.0,
    delay_hours INTEGER DEFAULT 24,  -- Hours after disclosure to execute
    
    -- Stats
    total_trades_tracked INTEGER DEFAULT 0,
    total_volume_usd DECIMAL(12,2) DEFAULT 0,
    copy_trades INTEGER DEFAULT 0,
    copy_pnl DECIMAL(10,2) DEFAULT 0,
    avg_trade_performance_pct DECIMAL(5,2) DEFAULT 0,
    
    -- Metadata
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_trade_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tracked_politicians_name ON polybot_tracked_politicians(politician_name);
CREATE INDEX IF NOT EXISTS idx_tracked_politicians_chamber ON polybot_tracked_politicians(chamber);
CREATE INDEX IF NOT EXISTS idx_tracked_politicians_copy ON polybot_tracked_politicians(copy_enabled);

-- Enable RLS
ALTER TABLE polybot_tracked_politicians ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the admin dashboard)
DROP POLICY IF EXISTS "Allow public read access to tracked politicians" ON polybot_tracked_politicians;
CREATE POLICY "Allow public read access to tracked politicians"
    ON polybot_tracked_politicians 
    FOR SELECT 
    USING (true);

-- Allow public write for upserts (for tracking)
DROP POLICY IF EXISTS "Allow public write to tracked politicians" ON polybot_tracked_politicians;
CREATE POLICY "Allow public write to tracked politicians"
    ON polybot_tracked_politicians 
    FOR ALL 
    USING (true);

-- Verify table was created
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_tracked_politicians'
ORDER BY ordinal_position;
