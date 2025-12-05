-- Add arbitrage strategy toggles to polybot_config
-- Run this in Supabase SQL Editor

-- ============================================================================
-- SECTION 1: Strategy Enable/Disable Toggles
-- ============================================================================

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_polymarket_single_arb BOOLEAN DEFAULT true;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_kalshi_single_arb BOOLEAN DEFAULT true;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_cross_platform_arb BOOLEAN DEFAULT true;

-- ============================================================================
-- SECTION 2: PER-STRATEGY SETTINGS - PhD RESEARCH OPTIMIZED
-- Based on "Unravelling the Probabilistic Forest" (Saguillo et al., 2025)
-- ============================================================================

-- POLYMARKET SINGLE: Research shows $40M extracted at 0.3-2% margins
-- Fee structure: 0% trading fee = can capture micro-arbitrage
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS poly_single_min_profit_pct NUMERIC(6,2) DEFAULT 0.3;  -- Research-optimized (was 0.5)

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS poly_single_max_spread_pct NUMERIC(6,2) DEFAULT 12.0;  -- Tighter filter for fresh data

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS poly_single_max_position_usd NUMERIC(10,2) DEFAULT 100.0;  -- Increased (safest strategy)

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS poly_single_scan_interval_sec INTEGER DEFAULT 30;  -- Faster (opps close in <60s)

-- KALSHI SINGLE: 7% fee structure requires MUCH higher thresholds
-- Math: 7% fee + 1% target net = 8% minimum gross profit
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS kalshi_single_min_profit_pct NUMERIC(6,2) DEFAULT 8.0;  -- RAISED from 2% (fee adjusted)

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS kalshi_single_max_spread_pct NUMERIC(6,2) DEFAULT 15.0;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS kalshi_single_max_position_usd NUMERIC(10,2) DEFAULT 30.0;  -- Reduced (higher risk)

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS kalshi_single_scan_interval_sec INTEGER DEFAULT 60;

-- CROSS-PLATFORM: Asymmetric thresholds based on buy platform fee structure
-- Buy Poly (0% fee) = lower threshold, Buy Kalshi (7% fee) = higher threshold
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_poly_pct NUMERIC(6,2) DEFAULT 2.5;  -- Buy Poly (cheap)

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_kalshi_pct NUMERIC(6,2) DEFAULT 9.0;  -- Buy Kalshi (expensive)

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS cross_plat_max_position_usd NUMERIC(10,2) DEFAULT 75.0;  -- Reduced (execution risk)

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS cross_plat_scan_interval_sec INTEGER DEFAULT 90;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS cross_plat_min_similarity NUMERIC(4,2) DEFAULT 0.35;  -- Stricter matching

-- Add arbitrage_type column to opportunities table
ALTER TABLE polybot_opportunities
ADD COLUMN IF NOT EXISTS arbitrage_type TEXT;

-- Add arbitrage_type column to simulated trades table  
ALTER TABLE polybot_simulated_trades
ADD COLUMN IF NOT EXISTS arbitrage_type TEXT;

-- Create a table for ALL market scans (including non-qualifying)
CREATE TABLE IF NOT EXISTS polybot_market_scans (
    id BIGSERIAL PRIMARY KEY,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Which scanner found this
    scanner_type TEXT NOT NULL,  -- 'polymarket_single', 'kalshi_single', 'cross_platform'
    
    -- Market info
    platform TEXT NOT NULL,
    market_id TEXT,
    market_title TEXT,
    
    -- Price data
    yes_price NUMERIC(10, 6),
    no_price NUMERIC(10, 6),
    total_price NUMERIC(10, 6),  -- For multi-condition markets
    
    -- For cross-platform
    other_platform TEXT,
    other_market_id TEXT,
    other_price NUMERIC(10, 6),
    
    -- Arbitrage analysis
    spread_pct NUMERIC(10, 4),
    potential_profit_pct NUMERIC(10, 4),
    
    -- Did it qualify?
    qualifies_for_trade BOOLEAN DEFAULT false,
    rejection_reason TEXT,  -- Why it didn't qualify (if applicable)
    
    -- If it became an opportunity
    opportunity_id TEXT,
    
    -- Raw data for debugging
    raw_data JSONB
);

-- Index for recent scans
CREATE INDEX IF NOT EXISTS idx_polybot_market_scans_scanned 
    ON polybot_market_scans(scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_polybot_market_scans_scanner 
    ON polybot_market_scans(scanner_type, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_polybot_market_scans_qualifies 
    ON polybot_market_scans(qualifies_for_trade, scanned_at DESC);

-- Create analytics table for per-strategy performance tracking
CREATE TABLE IF NOT EXISTS polybot_arbitrage_analytics (
    id INTEGER PRIMARY KEY DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_start TIMESTAMP WITH TIME ZONE,
    
    -- Overall stats
    starting_balance NUMERIC(12, 2) DEFAULT 1000,
    current_balance NUMERIC(12, 2) DEFAULT 1000,
    total_net_pnl NUMERIC(12, 2) DEFAULT 0,
    roi_pct NUMERIC(8, 2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    total_opportunities INTEGER DEFAULT 0,
    
    -- Per-strategy stats as JSON
    polymarket_single_stats JSONB DEFAULT '{}',
    kalshi_single_stats JSONB DEFAULT '{}',
    cross_platform_stats JSONB DEFAULT '{}'
);

-- Insert default row for analytics
INSERT INTO polybot_arbitrage_analytics (id) 
VALUES (1) 
ON CONFLICT (id) DO NOTHING;

-- Update default config with new columns
UPDATE polybot_config SET
    enable_polymarket_single_arb = true,
    enable_kalshi_single_arb = true,
    enable_cross_platform_arb = true
WHERE id = 1;

-- Verify
SELECT 
    id,
    enable_polymarket_single_arb,
    enable_kalshi_single_arb,
    enable_cross_platform_arb
FROM polybot_config 
WHERE id = 1;
