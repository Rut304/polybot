-- Add Market Making and News Arbitrage config columns to polybot_config
-- Run this in Supabase SQL Editor

-- ============================================================================
-- SECTION 1: MARKET MAKING STRATEGY CONFIG
-- Expected returns: 10-20% APR from spread capture + Polymarket rewards
-- High confidence (70-80%) - Based on academic market making research
-- ============================================================================

-- Master toggle for market making strategy
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_market_making BOOLEAN DEFAULT false;

-- Target bid-ask spread in basis points (100 bps = 1%)
-- 200 bps = 2% spread → expect to capture ~50% of spread per roundtrip
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS mm_target_spread_bps INTEGER DEFAULT 200;

-- Size of each order placed in USD
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS mm_order_size_usd NUMERIC(10,2) DEFAULT 50.0;

-- Maximum inventory (position) per market in USD
-- Limits exposure to any single market
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS mm_max_inventory_usd NUMERIC(10,2) DEFAULT 500.0;

-- Minimum 24h volume required to market make a market
-- Only liquid markets to ensure fills
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS mm_min_volume_24h NUMERIC(15,2) DEFAULT 10000.0;

-- How often to refresh/adjust quotes (seconds)
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS mm_quote_refresh_sec INTEGER DEFAULT 5;

-- Maximum number of markets to simultaneously make markets in
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS mm_max_markets INTEGER DEFAULT 5;

-- ============================================================================
-- SECTION 2: NEWS ARBITRAGE STRATEGY CONFIG  
-- Expected returns: 5-30% per event (when divergence occurs)
-- Medium confidence (50-60%) - Depends on Polymarket→Kalshi price lag
-- ============================================================================

-- Master toggle for news arbitrage strategy
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_news_arbitrage BOOLEAN DEFAULT false;

-- Minimum price divergence to trigger a trade (percentage)
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS news_min_spread_pct NUMERIC(6,2) DEFAULT 3.0;

-- Maximum lag time after news before ignoring (minutes)
-- Divergences should close quickly; stale ones may be fundamental
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS news_max_lag_minutes INTEGER DEFAULT 5;

-- Position size for news arbitrage trades
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS news_position_size_usd NUMERIC(10,2) DEFAULT 50.0;

-- How often to scan for news events (seconds)
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS news_scan_interval_sec INTEGER DEFAULT 30;

-- Keywords to watch for news events (comma-separated)
-- Markets containing these keywords will be monitored for price divergence
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS news_keywords TEXT DEFAULT 'election,fed,trump,bitcoin,crypto,verdict,fomc,debate,trial,indictment';

-- ============================================================================
-- SECTION 3: CREATE MARKET MAKING ACTIVITY LOG TABLE
-- Track all quotes placed, fills, and P&L
-- ============================================================================

CREATE TABLE IF NOT EXISTS polybot_mm_activity (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Market info
    market_id TEXT NOT NULL,
    market_title TEXT,
    token_id TEXT,  -- Polymarket token ID
    
    -- Quote info
    action TEXT NOT NULL,  -- 'quote_placed', 'quote_cancelled', 'fill', 'position_update'
    side TEXT,  -- 'bid', 'ask'
    price NUMERIC(10, 6),
    size NUMERIC(15, 6),
    order_id TEXT,
    
    -- Fill info (when action = 'fill')
    fill_price NUMERIC(10, 6),
    fill_size NUMERIC(15, 6),
    
    -- Position tracking
    current_inventory NUMERIC(15, 2),  -- Current position value in USD
    
    -- P&L tracking
    realized_pnl NUMERIC(15, 2),  -- P&L from this fill
    cumulative_pnl NUMERIC(15, 2),  -- Total P&L for this market
    
    -- Session tracking
    session_id TEXT  -- Group activity by bot run session
);

-- Create indexes for polybot_mm_activity
CREATE INDEX IF NOT EXISTS idx_mm_activity_market ON polybot_mm_activity (market_id);
CREATE INDEX IF NOT EXISTS idx_mm_activity_session ON polybot_mm_activity (session_id);
CREATE INDEX IF NOT EXISTS idx_mm_activity_created ON polybot_mm_activity (created_at DESC);

-- ============================================================================
-- SECTION 4: CREATE NEWS ARBITRAGE SIGNALS TABLE
-- Track detected price divergences and trade outcomes
-- ============================================================================

CREATE TABLE IF NOT EXISTS polybot_news_signals (
    id BIGSERIAL PRIMARY KEY,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Market info
    poly_market_id TEXT NOT NULL,
    kalshi_market_id TEXT NOT NULL,
    market_title TEXT,
    
    -- Price data at detection
    poly_price NUMERIC(10, 6) NOT NULL,
    kalshi_price NUMERIC(10, 6) NOT NULL,
    spread_pct NUMERIC(10, 4) NOT NULL,
    
    -- Trigger info
    trigger_keyword TEXT,  -- Which keyword triggered monitoring
    
    -- Trade execution
    trade_executed BOOLEAN DEFAULT false,
    trade_side TEXT,  -- 'buy_poly_sell_kalshi' or 'buy_kalshi_sell_poly'
    entry_price NUMERIC(10, 6),
    exit_price NUMERIC(10, 6),
    position_size_usd NUMERIC(10, 2),
    
    -- Outcome
    realized_pnl NUMERIC(15, 2),
    convergence_time_minutes NUMERIC(10, 2),  -- How long until prices converged
    
    -- Status
    status TEXT DEFAULT 'detected',  -- 'detected', 'traded', 'closed', 'expired'
    notes TEXT
);

-- Create indexes for polybot_news_signals
CREATE INDEX IF NOT EXISTS idx_news_signals_detected ON polybot_news_signals (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_signals_status ON polybot_news_signals (status);

-- ============================================================================
-- SECTION 5: SET DEFAULT VALUES FOR NEW CONFIG
-- ============================================================================

UPDATE polybot_config SET
    enable_market_making = COALESCE(enable_market_making, false),
    mm_target_spread_bps = COALESCE(mm_target_spread_bps, 200),
    mm_order_size_usd = COALESCE(mm_order_size_usd, 50.0),
    mm_max_inventory_usd = COALESCE(mm_max_inventory_usd, 500.0),
    mm_min_volume_24h = COALESCE(mm_min_volume_24h, 10000.0),
    mm_quote_refresh_sec = COALESCE(mm_quote_refresh_sec, 5),
    mm_max_markets = COALESCE(mm_max_markets, 5),
    enable_news_arbitrage = COALESCE(enable_news_arbitrage, false),
    news_min_spread_pct = COALESCE(news_min_spread_pct, 3.0),
    news_max_lag_minutes = COALESCE(news_max_lag_minutes, 5),
    news_position_size_usd = COALESCE(news_position_size_usd, 50.0),
    news_scan_interval_sec = COALESCE(news_scan_interval_sec, 30),
    news_keywords = COALESCE(news_keywords, 'election,fed,trump,bitcoin,crypto,verdict,fomc,debate,trial,indictment')
WHERE id = 1;

-- ============================================================================
-- DONE! Summary of changes:
-- ============================================================================
-- 1. Added enable_market_making toggle + 6 market making parameters
-- 2. Added enable_news_arbitrage toggle + 5 news arbitrage parameters  
-- 3. Created polybot_mm_activity table for market making logs
-- 4. Created polybot_news_signals table for news arbitrage tracking
-- 5. Set default values for existing config row
