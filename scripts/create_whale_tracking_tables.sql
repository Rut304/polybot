-- =====================================================================================
-- WHALE TRACKING SYSTEM - Database Schema
-- December 14, 2025
-- =====================================================================================
-- 
-- Track whale wallets, their performance over time, and copy trade history
-- =====================================================================================

-- Table to store tracked whale profiles
CREATE TABLE IF NOT EXISTS polybot_tracked_whales (
    id SERIAL PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    alias TEXT,
    
    -- Performance metrics (updated periodically)
    total_volume_usd DECIMAL(20, 2) DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    total_predictions INTEGER DEFAULT 0,
    winning_predictions INTEGER DEFAULT 0,
    
    -- Tier classification
    tier TEXT DEFAULT 'retail', -- mega_whale, whale, smart_money, retail
    
    -- Activity tracking
    last_trade_at TIMESTAMPTZ,
    active_positions INTEGER DEFAULT 0,
    
    -- Copy settings
    copy_enabled BOOLEAN DEFAULT false,
    copy_multiplier DECIMAL(4, 2) DEFAULT 0.5,
    max_copy_size_usd DECIMAL(10, 2) DEFAULT 100,
    
    -- Our copy trade performance following this whale
    copy_trades INTEGER DEFAULT 0,
    copy_wins INTEGER DEFAULT 0,
    copy_pnl DECIMAL(20, 2) DEFAULT 0,
    
    -- Discovery info
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    discovery_source TEXT DEFAULT 'leaderboard', -- leaderboard, manual, search
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track whale performance snapshots over time
CREATE TABLE IF NOT EXISTS polybot_whale_performance_history (
    id SERIAL PRIMARY KEY,
    whale_address TEXT NOT NULL REFERENCES polybot_tracked_whales(address) ON DELETE CASCADE,
    
    -- Snapshot timestamp
    snapshot_at TIMESTAMPTZ DEFAULT NOW(),
    snapshot_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
    
    -- Performance metrics at snapshot time
    total_volume_usd DECIMAL(20, 2),
    win_rate DECIMAL(5, 2),
    total_predictions INTEGER,
    winning_predictions INTEGER,
    tier TEXT,
    
    -- Period-specific metrics
    period_trades INTEGER DEFAULT 0,
    period_wins INTEGER DEFAULT 0,
    period_volume_usd DECIMAL(20, 2) DEFAULT 0,
    period_pnl_usd DECIMAL(20, 2) DEFAULT 0,
    
    -- Ranking
    leaderboard_rank INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store individual whale trades we detect
CREATE TABLE IF NOT EXISTS polybot_whale_trades (
    id TEXT PRIMARY KEY,
    whale_address TEXT NOT NULL,
    
    -- Timestamp
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    trade_timestamp TIMESTAMPTZ,
    
    -- Market info
    market_id TEXT,
    market_title TEXT,
    platform TEXT DEFAULT 'polymarket',
    
    -- Trade details
    direction TEXT, -- buy_yes, buy_no, sell_yes, sell_no
    side TEXT, -- YES or NO
    price DECIMAL(5, 4),
    size_usd DECIMAL(20, 2),
    
    -- Transaction info
    tx_hash TEXT,
    
    -- Copy trade info (if we copied this)
    copied BOOLEAN DEFAULT false,
    copy_trade_id TEXT,
    copy_profit_usd DECIMAL(20, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store our copy trades
CREATE TABLE IF NOT EXISTS polybot_copy_trades (
    id TEXT PRIMARY KEY,
    whale_address TEXT NOT NULL,
    whale_trade_id TEXT REFERENCES polybot_whale_trades(id),
    
    -- Timing
    signal_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    delay_seconds INTEGER,
    
    -- Market info
    market_id TEXT,
    market_title TEXT,
    platform TEXT DEFAULT 'polymarket',
    
    -- Trade details
    direction TEXT,
    side TEXT,
    entry_price DECIMAL(5, 4),
    position_size_usd DECIMAL(20, 2),
    
    -- Whale context
    whale_price DECIMAL(5, 4),
    whale_size_usd DECIMAL(20, 2),
    whale_tier TEXT,
    whale_win_rate DECIMAL(5, 2),
    confidence_score DECIMAL(4, 2),
    
    -- Outcome
    status TEXT DEFAULT 'open', -- open, won, lost, cancelled
    exit_price DECIMAL(5, 4),
    actual_profit_usd DECIMAL(20, 2),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whales_tier ON polybot_tracked_whales(tier);
CREATE INDEX IF NOT EXISTS idx_whales_win_rate ON polybot_tracked_whales(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_whales_volume ON polybot_tracked_whales(total_volume_usd DESC);
CREATE INDEX IF NOT EXISTS idx_whales_copy_enabled ON polybot_tracked_whales(copy_enabled);

CREATE INDEX IF NOT EXISTS idx_whale_history_address ON polybot_whale_performance_history(whale_address);
CREATE INDEX IF NOT EXISTS idx_whale_history_period ON polybot_whale_performance_history(snapshot_period, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_whale_trades_address ON polybot_whale_trades(whale_address);
CREATE INDEX IF NOT EXISTS idx_whale_trades_time ON polybot_whale_trades(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_copy_trades_whale ON polybot_copy_trades(whale_address);
CREATE INDEX IF NOT EXISTS idx_copy_trades_status ON polybot_copy_trades(status);

-- Enable RLS
ALTER TABLE polybot_tracked_whales ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_whale_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_whale_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_copy_trades ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Service role can do everything on whales" ON polybot_tracked_whales
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on whale history" ON polybot_whale_performance_history
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on whale trades" ON polybot_whale_trades
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on copy trades" ON polybot_copy_trades
    FOR ALL USING (true) WITH CHECK (true);

-- Function to update whale tier based on metrics
CREATE OR REPLACE FUNCTION update_whale_tier()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_volume_usd >= 100000 AND NEW.win_rate >= 80 THEN
        NEW.tier := 'mega_whale';
    ELSIF NEW.total_volume_usd >= 50000 AND NEW.win_rate >= 75 THEN
        NEW.tier := 'whale';
    ELSIF NEW.total_volume_usd >= 10000 AND NEW.win_rate >= 70 THEN
        NEW.tier := 'smart_money';
    ELSE
        NEW.tier := 'retail';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update tier
DROP TRIGGER IF EXISTS trigger_update_whale_tier ON polybot_tracked_whales;
CREATE TRIGGER trigger_update_whale_tier
    BEFORE INSERT OR UPDATE OF total_volume_usd, win_rate ON polybot_tracked_whales
    FOR EACH ROW
    EXECUTE FUNCTION update_whale_tier();

-- View for whale leaderboard with period stats
CREATE OR REPLACE VIEW whale_leaderboard AS
SELECT 
    w.address,
    w.alias,
    w.tier,
    w.win_rate,
    w.total_volume_usd,
    w.total_predictions,
    w.copy_enabled,
    w.copy_pnl,
    w.copy_trades,
    w.last_trade_at,
    -- Calculate 7-day stats from history
    (SELECT SUM(period_pnl_usd) FROM polybot_whale_performance_history 
     WHERE whale_address = w.address 
     AND snapshot_period = 'daily' 
     AND snapshot_at >= NOW() - INTERVAL '7 days') as week_pnl,
    -- Calculate 30-day stats
    (SELECT SUM(period_pnl_usd) FROM polybot_whale_performance_history 
     WHERE whale_address = w.address 
     AND snapshot_period = 'daily' 
     AND snapshot_at >= NOW() - INTERVAL '30 days') as month_pnl
FROM polybot_tracked_whales w
ORDER BY w.win_rate DESC, w.total_volume_usd DESC;

SELECT 'Whale tracking tables created successfully! 🐋' as status;
