-- PolyBot Additional Tables
-- Run this in Supabase SQL Editor AFTER create_simulation_tables.sql

-- PolyBot Opportunities Table (detected arbitrage opportunities)
CREATE TABLE IF NOT EXISTS polybot_opportunities (
    id BIGSERIAL PRIMARY KEY,
    opportunity_id TEXT UNIQUE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Market info
    buy_platform TEXT NOT NULL, -- 'polymarket' or 'kalshi'
    sell_platform TEXT NOT NULL,
    buy_market_id TEXT,
    sell_market_id TEXT,
    buy_market_name TEXT,
    sell_market_name TEXT,
    
    -- Prices
    buy_price NUMERIC(10, 6),
    sell_price NUMERIC(10, 6),
    
    -- Opportunity details
    profit_percent NUMERIC(10, 4),
    max_size NUMERIC(10, 2),
    total_profit NUMERIC(10, 4),
    confidence NUMERIC(5, 4),
    strategy TEXT,
    
    -- Status
    status TEXT DEFAULT 'detected' -- 'detected', 'executed', 'missed', 'expired'
);

CREATE INDEX IF NOT EXISTS idx_polybot_opportunities_detected 
    ON polybot_opportunities(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_polybot_opportunities_profit 
    ON polybot_opportunities(profit_percent DESC);

-- PolyBot Status Table (bot runtime status)
CREATE TABLE IF NOT EXISTS polybot_status (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_running BOOLEAN DEFAULT false,
    mode TEXT DEFAULT 'simulation', -- 'simulation', 'live', 'paused'
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    current_action TEXT,
    error_message TEXT,
    polymarket_connected BOOLEAN DEFAULT false,
    kalshi_connected BOOLEAN DEFAULT false,
    opportunities_this_session INTEGER DEFAULT 0,
    trades_this_session INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default status row
INSERT INTO polybot_status (id, is_running, mode) 
VALUES (1, false, 'simulation') 
ON CONFLICT (id) DO NOTHING;

-- PolyBot Manual Trades Table (trades placed manually from admin UI)
CREATE TABLE IF NOT EXISTS polybot_manual_trades (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Trade details
    platform TEXT NOT NULL, -- 'polymarket' or 'kalshi'
    market_id TEXT NOT NULL,
    market_title TEXT,
    side TEXT NOT NULL, -- 'yes' or 'no'
    action TEXT NOT NULL, -- 'buy' or 'sell'
    quantity NUMERIC(12, 6),
    price NUMERIC(10, 6),
    total_cost NUMERIC(10, 2),
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'filled', 'failed', 'cancelled'
    filled_at TIMESTAMP WITH TIME ZONE,
    filled_price NUMERIC(10, 6),
    filled_quantity NUMERIC(12, 6),
    
    -- User/session info
    user_agent TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_polybot_manual_trades_created 
    ON polybot_manual_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polybot_manual_trades_platform 
    ON polybot_manual_trades(platform);

-- PolyBot Market Cache (cached market data for quick lookup)
CREATE TABLE IF NOT EXISTS polybot_markets_cache (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    market_id TEXT NOT NULL,
    title TEXT,
    question TEXT,
    description TEXT,
    category TEXT,
    yes_price NUMERIC(10, 6),
    no_price NUMERIC(10, 6),
    volume NUMERIC(15, 2),
    liquidity NUMERIC(15, 2),
    close_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, market_id)
);

CREATE INDEX IF NOT EXISTS idx_polybot_markets_platform 
    ON polybot_markets_cache(platform);
CREATE INDEX IF NOT EXISTS idx_polybot_markets_updated 
    ON polybot_markets_cache(last_updated DESC);

-- Success message
SELECT 'PolyBot additional tables created successfully!' AS status;
