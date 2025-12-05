-- Migration: Create polybot_balances table for aggregated balance tracking
-- Run this in Supabase SQL Editor

-- Create table for storing aggregated balances
CREATE TABLE IF NOT EXISTS polybot_balances (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_portfolio_usd DECIMAL(20, 2) DEFAULT 0,
    total_cash_usd DECIMAL(20, 2) DEFAULT 0,
    total_positions_usd DECIMAL(20, 2) DEFAULT 0,
    platforms JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row
INSERT INTO polybot_balances (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Create historical balance snapshots table
CREATE TABLE IF NOT EXISTS polybot_balance_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    total_portfolio_usd DECIMAL(20, 2),
    total_cash_usd DECIMAL(20, 2),
    total_positions_usd DECIMAL(20, 2),
    platforms JSONB,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for time-based queries
CREATE INDEX IF NOT EXISTS idx_balance_history_time 
ON polybot_balance_history(snapshot_at DESC);

-- Function to take balance snapshots (call periodically)
CREATE OR REPLACE FUNCTION snapshot_balance()
RETURNS void AS $$
BEGIN
    INSERT INTO polybot_balance_history (
        total_portfolio_usd,
        total_cash_usd,
        total_positions_usd,
        platforms,
        snapshot_at
    )
    SELECT 
        total_portfolio_usd,
        total_cash_usd,
        total_positions_usd,
        platforms,
        NOW()
    FROM polybot_balances
    WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE polybot_balances IS 'Current aggregated balance across all platforms';
COMMENT ON TABLE polybot_balance_history IS 'Historical balance snapshots for tracking performance';
COMMENT ON COLUMN polybot_balances.platforms IS 'JSON array of platform-specific balances';

-- Show structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_balances';
