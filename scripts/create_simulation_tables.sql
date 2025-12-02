-- PolyBot Simulation Tables
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad/sql/new)

-- PolyBot Simulated Trades Table (Paper Trading)
CREATE TABLE IF NOT EXISTS polybot_simulated_trades (
    id BIGSERIAL PRIMARY KEY,
    position_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Market info
    polymarket_token_id TEXT,
    polymarket_market_title TEXT,
    kalshi_ticker TEXT,
    kalshi_market_title TEXT,
    
    -- Prices at detection
    polymarket_yes_price NUMERIC(10, 6),
    polymarket_no_price NUMERIC(10, 6),
    kalshi_yes_price NUMERIC(10, 6),
    kalshi_no_price NUMERIC(10, 6),
    
    -- Trade details
    trade_type TEXT,
    position_size_usd NUMERIC(10, 2),
    expected_profit_usd NUMERIC(10, 4),
    expected_profit_pct NUMERIC(10, 4),
    
    -- Resolution
    outcome TEXT DEFAULT 'pending',
    actual_profit_usd NUMERIC(10, 4),
    resolved_at TIMESTAMP WITH TIME ZONE,
    market_result TEXT,
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_polybot_simulated_trades_created 
    ON polybot_simulated_trades(created_at DESC);

-- PolyBot Simulation Stats Snapshots
CREATE TABLE IF NOT EXISTS polybot_simulation_stats (
    id BIGSERIAL PRIMARY KEY,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stats_json JSONB,
    simulated_balance NUMERIC(12, 2),
    total_pnl NUMERIC(12, 2),
    total_trades INTEGER,
    win_rate NUMERIC(5, 2)
);

CREATE INDEX IF NOT EXISTS idx_polybot_simulation_stats_snapshot 
    ON polybot_simulation_stats(snapshot_at DESC);

-- PolyBot Market Pairs (matched markets between platforms)
CREATE TABLE IF NOT EXISTS polybot_market_pairs (
    id BIGSERIAL PRIMARY KEY,
    polymarket_token_id TEXT NOT NULL,
    polymarket_question TEXT,
    kalshi_ticker TEXT NOT NULL,
    kalshi_title TEXT,
    match_confidence NUMERIC(5, 4) DEFAULT 1.0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(polymarket_token_id, kalshi_ticker)
);

-- PolyBot Configuration (bot settings)
CREATE TABLE IF NOT EXISTS polybot_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    polymarket_enabled BOOLEAN DEFAULT true,
    kalshi_enabled BOOLEAN DEFAULT true,
    min_profit_percent NUMERIC(5, 2) DEFAULT 1.0,
    max_trade_size NUMERIC(10, 2) DEFAULT 100.0,
    max_daily_loss NUMERIC(10, 2) DEFAULT 50.0,
    scan_interval NUMERIC(5, 2) DEFAULT 2.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config
INSERT INTO polybot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- PolyBot Disabled Markets (markets the user has disabled)
CREATE TABLE IF NOT EXISTS polybot_disabled_markets (
    id BIGSERIAL PRIMARY KEY,
    market_id TEXT UNIQUE NOT NULL,
    platform TEXT, -- 'polymarket' or 'kalshi'
    reason TEXT,
    disabled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polybot_disabled_markets_id ON polybot_disabled_markets(market_id);

-- PolyBot Active Positions (real-time positions)
CREATE TABLE IF NOT EXISTS polybot_positions (
    id BIGSERIAL PRIMARY KEY,
    position_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL, -- 'polymarket' or 'kalshi'
    market_id TEXT NOT NULL,
    market_title TEXT,
    side TEXT NOT NULL, -- 'yes' or 'no'
    quantity NUMERIC(12, 6),
    avg_price NUMERIC(10, 6),
    current_price NUMERIC(10, 6),
    cost_basis NUMERIC(10, 2),
    current_value NUMERIC(10, 2),
    unrealized_pnl NUMERIC(10, 2),
    is_automated BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polybot_positions_platform ON polybot_positions(platform);

-- Success message
SELECT 'PolyBot simulation tables created successfully!' AS status;
