-- Create live trades table for tracking REAL order executions
-- This is separate from simulation trades

CREATE TABLE IF NOT EXISTS polybot_live_trades (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    market_id TEXT NOT NULL,
    market_title TEXT,
    position_size_usd DECIMAL(10, 2) NOT NULL,
    expected_profit_pct DECIMAL(8, 4),
    actual_profit_usd DECIMAL(10, 2),
    order_ids JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'open',
    is_simulation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_outcome TEXT,
    notes TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_live_trades_user 
    ON polybot_live_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_live_trades_status 
    ON polybot_live_trades(status);
CREATE INDEX IF NOT EXISTS idx_live_trades_platform 
    ON polybot_live_trades(platform);
CREATE INDEX IF NOT EXISTS idx_live_trades_created 
    ON polybot_live_trades(created_at DESC);

-- Enable RLS
ALTER TABLE polybot_live_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own live trades
CREATE POLICY "Users can view own live trades" 
    ON polybot_live_trades
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own live trades"
    ON polybot_live_trades
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own live trades"
    ON polybot_live_trades
    FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Grant access to service role (bypasses RLS)
GRANT ALL ON polybot_live_trades TO service_role;
GRANT USAGE, SELECT ON SEQUENCE polybot_live_trades_id_seq TO service_role;

COMMENT ON TABLE polybot_live_trades IS 
    'Tracks REAL (non-simulation) trade executions for live trading mode';
