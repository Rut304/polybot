-- =====================================================================================
-- CONGRESSIONAL TRACKER SYSTEM - Database Schema
-- December 14, 2025
-- =====================================================================================
-- 
-- Track congressional stock trades, politician profiles, and copy trade history
-- =====================================================================================

-- Table to store tracked politician profiles
CREATE TABLE IF NOT EXISTS polybot_tracked_politicians (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    
    -- Political info
    chamber TEXT DEFAULT 'both', -- house, senate, both
    party TEXT DEFAULT 'any', -- D, R, I, any
    state TEXT,
    district TEXT, -- House only
    committees TEXT[], -- Committee memberships
    
    -- Performance metrics (updated from our copy trades)
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    total_pnl_usd DECIMAL(20, 2) DEFAULT 0,
    avg_return_pct DECIMAL(6, 2) DEFAULT 0,
    
    -- Copy settings
    copy_enabled BOOLEAN DEFAULT false,
    copy_scale_pct DECIMAL(5, 2) DEFAULT 10.0, -- % of their trade to copy
    max_copy_size_usd DECIMAL(10, 2) DEFAULT 1000,
    
    -- Activity tracking
    last_trade_at TIMESTAMPTZ,
    first_tracked_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store detected congressional trades
CREATE TABLE IF NOT EXISTS polybot_congressional_trades (
    id TEXT PRIMARY KEY,
    politician_name TEXT NOT NULL,
    
    -- Political info
    chamber TEXT, -- house, senate
    party TEXT, -- D, R, I
    state TEXT,
    
    -- Trade details
    ticker TEXT NOT NULL,
    asset_name TEXT,
    transaction_type TEXT, -- purchase, sale, exchange
    transaction_date TIMESTAMPTZ,
    disclosure_date TIMESTAMPTZ,
    
    -- Amount (Congress reports ranges, not exact)
    amount_range_low DECIMAL(20, 2),
    amount_range_high DECIMAL(20, 2),
    amount_estimated DECIMAL(20, 2), -- Midpoint estimate
    
    -- Price tracking
    price_at_trade DECIMAL(12, 4),
    price_at_disclosure DECIMAL(12, 4),
    price_current DECIMAL(12, 4),
    
    -- Source info
    source TEXT DEFAULT 'house_stock_watcher',
    disclosure_url TEXT,
    
    -- Copy info
    copied BOOLEAN DEFAULT false,
    copy_trade_id TEXT,
    
    -- Timestamps
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store our copy trades following congress
CREATE TABLE IF NOT EXISTS polybot_congressional_copy_trades (
    id TEXT PRIMARY KEY,
    politician_name TEXT NOT NULL,
    original_trade_id TEXT REFERENCES polybot_congressional_trades(id),
    
    -- Trade details
    ticker TEXT NOT NULL,
    direction TEXT, -- buy, sell
    position_size_usd DECIMAL(10, 2),
    entry_price DECIMAL(12, 4),
    
    -- Confidence & reasoning
    confidence_score DECIMAL(4, 2),
    reasoning JSONB,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    execute_after TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    
    -- Outcome
    status TEXT DEFAULT 'pending', -- pending, executed, won, lost, cancelled
    exit_price DECIMAL(12, 4),
    actual_profit_usd DECIMAL(20, 2),
    return_pct DECIMAL(8, 4),
    resolved_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track politician performance snapshots over time
CREATE TABLE IF NOT EXISTS polybot_politician_performance_history (
    id SERIAL PRIMARY KEY,
    politician_name TEXT NOT NULL,
    
    -- Snapshot timestamp
    snapshot_at TIMESTAMPTZ DEFAULT NOW(),
    snapshot_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
    
    -- Performance metrics at snapshot time
    total_trades INTEGER,
    winning_trades INTEGER,
    win_rate_pct DECIMAL(5, 2),
    total_pnl_usd DECIMAL(20, 2),
    
    -- Period-specific metrics
    period_trades INTEGER DEFAULT 0,
    period_wins INTEGER DEFAULT 0,
    period_pnl_usd DECIMAL(20, 2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_politicians_name ON polybot_tracked_politicians(name);
CREATE INDEX IF NOT EXISTS idx_politicians_copy_enabled ON polybot_tracked_politicians(copy_enabled);
CREATE INDEX IF NOT EXISTS idx_politicians_win_rate ON polybot_tracked_politicians(
    (CASE WHEN total_trades > 0 THEN winning_trades::float / total_trades ELSE 0 END) DESC
);

CREATE INDEX IF NOT EXISTS idx_cong_trades_politician ON polybot_congressional_trades(politician_name);
CREATE INDEX IF NOT EXISTS idx_cong_trades_ticker ON polybot_congressional_trades(ticker);
CREATE INDEX IF NOT EXISTS idx_cong_trades_disclosure ON polybot_congressional_trades(disclosure_date DESC);
CREATE INDEX IF NOT EXISTS idx_cong_trades_copied ON polybot_congressional_trades(copied);

CREATE INDEX IF NOT EXISTS idx_cong_copy_trades_politician ON polybot_congressional_copy_trades(politician_name);
CREATE INDEX IF NOT EXISTS idx_cong_copy_trades_status ON polybot_congressional_copy_trades(status);
CREATE INDEX IF NOT EXISTS idx_cong_copy_trades_created ON polybot_congressional_copy_trades(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pol_history_name ON polybot_politician_performance_history(politician_name);
CREATE INDEX IF NOT EXISTS idx_pol_history_period ON polybot_politician_performance_history(snapshot_period, snapshot_at DESC);

-- Enable RLS
ALTER TABLE polybot_tracked_politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_congressional_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_congressional_copy_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_politician_performance_history ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Service role can do everything on politicians" ON polybot_tracked_politicians
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on congressional trades" ON polybot_congressional_trades
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on congressional copy trades" ON polybot_congressional_copy_trades
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on politician history" ON polybot_politician_performance_history
    FOR ALL USING (true) WITH CHECK (true);

-- Function to update politician stats from copy trades
CREATE OR REPLACE FUNCTION update_politician_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update on status change to 'won' or 'lost'
    IF NEW.status IN ('won', 'lost') AND (OLD IS NULL OR OLD.status != NEW.status) THEN
        UPDATE polybot_tracked_politicians
        SET 
            total_trades = total_trades + 1,
            winning_trades = winning_trades + CASE WHEN NEW.status = 'won' THEN 1 ELSE 0 END,
            losing_trades = losing_trades + CASE WHEN NEW.status = 'lost' THEN 1 ELSE 0 END,
            total_pnl_usd = total_pnl_usd + COALESCE(NEW.actual_profit_usd, 0),
            last_trade_at = NOW(),
            updated_at = NOW()
        WHERE name = NEW.politician_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update politician stats
DROP TRIGGER IF EXISTS trigger_update_politician_stats ON polybot_congressional_copy_trades;
CREATE TRIGGER trigger_update_politician_stats
    AFTER INSERT OR UPDATE OF status ON polybot_congressional_copy_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_politician_stats();

-- Function to compute win rate
CREATE OR REPLACE FUNCTION politician_win_rate(p_name TEXT)
RETURNS DECIMAL AS $$
DECLARE
    total INT;
    wins INT;
BEGIN
    SELECT total_trades, winning_trades INTO total, wins
    FROM polybot_tracked_politicians WHERE name = p_name;
    
    IF total IS NULL OR total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN (wins::DECIMAL / total) * 100;
END;
$$ LANGUAGE plpgsql;

-- View for easy querying of politician performance
CREATE OR REPLACE VIEW polybot_politician_performance AS
SELECT 
    p.name,
    p.chamber,
    p.party,
    p.state,
    p.total_trades,
    p.winning_trades,
    p.losing_trades,
    CASE WHEN p.total_trades > 0 
        THEN ROUND((p.winning_trades::DECIMAL / p.total_trades) * 100, 2)
        ELSE 0 
    END as win_rate_pct,
    p.total_pnl_usd,
    p.copy_enabled,
    p.copy_scale_pct,
    p.max_copy_size_usd,
    p.last_trade_at,
    p.created_at,
    (
        SELECT COUNT(*) 
        FROM polybot_congressional_trades ct 
        WHERE ct.politician_name = p.name 
        AND ct.disclosure_date > NOW() - INTERVAL '30 days'
    ) as trades_last_30d
FROM polybot_tracked_politicians p
ORDER BY p.total_pnl_usd DESC;

-- Insert some default tracked politicians (known performers)
INSERT INTO polybot_tracked_politicians (name, chamber, party, state, copy_enabled, copy_scale_pct, max_copy_size_usd)
VALUES 
    ('Nancy Pelosi', 'house', 'D', 'CA', true, 10.0, 1000),
    ('Dan Crenshaw', 'house', 'R', 'TX', true, 10.0, 1000),
    ('Tommy Tuberville', 'senate', 'R', 'AL', true, 10.0, 1000),
    ('Marjorie Taylor Greene', 'house', 'R', 'GA', false, 10.0, 500),
    ('Josh Gottheimer', 'house', 'D', 'NJ', true, 10.0, 1000),
    ('Michael McCaul', 'house', 'R', 'TX', true, 10.0, 1000),
    ('Ro Khanna', 'house', 'D', 'CA', false, 10.0, 500)
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT ALL ON polybot_tracked_politicians TO service_role;
GRANT ALL ON polybot_congressional_trades TO service_role;
GRANT ALL ON polybot_congressional_copy_trades TO service_role;
GRANT ALL ON polybot_politician_performance_history TO service_role;
GRANT SELECT ON polybot_politician_performance TO service_role;
