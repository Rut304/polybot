#!/usr/bin/env python3
"""
Setup PolyBot tables in Supabase.

All tables are prefixed with 'polybot_' to avoid conflicts with PolyParlay.
This script is idempotent - safe to run multiple times.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Supabase SQL for PolyBot tables
# These are completely separate from PolyParlay tables
SCHEMA_SQL = """
-- PolyBot Tables (completely isolated from PolyParlay)
-- All tables prefixed with 'polybot_' to prevent any conflicts

-- 1. Arbitrage opportunities detected
CREATE TABLE IF NOT EXISTS polybot_opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Market info
    market_name TEXT NOT NULL,
    polymarket_token_id TEXT,
    kalshi_ticker TEXT,
    
    -- Prices
    buy_platform TEXT NOT NULL,
    buy_price DECIMAL(10, 6) NOT NULL,
    sell_platform TEXT NOT NULL,
    sell_price DECIMAL(10, 6) NOT NULL,
    
    -- Profit calculation
    profit_percent DECIMAL(10, 4) NOT NULL,
    potential_profit_usd DECIMAL(10, 2),
    trade_size_usd DECIMAL(10, 2),
    
    -- Status
    was_executed BOOLEAN DEFAULT FALSE,
    execution_result TEXT
);

-- 2. Trade execution log
CREATE TABLE IF NOT EXISTS polybot_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Trade details
    platform TEXT NOT NULL,
    market_name TEXT NOT NULL,
    side TEXT NOT NULL,  -- 'buy' or 'sell'
    size_usd DECIMAL(10, 2) NOT NULL,
    price DECIMAL(10, 6) NOT NULL,
    
    -- Execution
    status TEXT NOT NULL,  -- 'pending', 'executed', 'failed', 'dry_run'
    order_id TEXT,
    error_message TEXT,
    
    -- Linking
    opportunity_id UUID REFERENCES polybot_opportunities(id),
    paired_trade_id UUID,  -- Links buy/sell legs
    
    -- Dry run flag
    is_dry_run BOOLEAN DEFAULT TRUE
);

-- 3. Bot status and heartbeat
CREATE TABLE IF NOT EXISTS polybot_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Bot state
    is_running BOOLEAN DEFAULT FALSE,
    dry_run_mode BOOLEAN DEFAULT TRUE,
    
    -- Configuration snapshot
    max_trade_size DECIMAL(10, 2),
    min_profit_threshold DECIMAL(10, 4),
    
    -- Stats
    daily_trades_count INTEGER DEFAULT 0,
    daily_profit_usd DECIMAL(10, 2) DEFAULT 0,
    daily_loss_usd DECIMAL(10, 2) DEFAULT 0,
    
    -- Last activity
    last_opportunity_at TIMESTAMPTZ,
    last_trade_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Market pairs configuration
CREATE TABLE IF NOT EXISTS polybot_market_pairs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Market identifiers
    polymarket_token_id TEXT NOT NULL,
    kalshi_ticker TEXT NOT NULL,
    
    -- Market metadata
    market_name TEXT,
    category TEXT,
    
    -- Matching info
    is_active BOOLEAN DEFAULT TRUE,
    match_type TEXT DEFAULT 'exact',  -- 'exact', 'split', 'range'
    
    -- For split markets
    kalshi_range_low INTEGER,
    kalshi_range_high INTEGER,
    
    UNIQUE(polymarket_token_id, kalshi_ticker)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_polybot_opportunities_created 
    ON polybot_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polybot_trades_created 
    ON polybot_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polybot_trades_platform 
    ON polybot_trades(platform);
CREATE INDEX IF NOT EXISTS idx_polybot_market_pairs_active 
    ON polybot_market_pairs(is_active) WHERE is_active = TRUE;

-- Insert initial bot status row
INSERT INTO polybot_status (is_running, dry_run_mode, max_trade_size, min_profit_threshold)
VALUES (FALSE, TRUE, 100.00, 1.0000)
ON CONFLICT DO NOTHING;
"""

def main():
    """Create PolyBot tables in Supabase."""
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env")
        sys.exit(1)
    
    print(f"📦 Connecting to Supabase: {url}")
    print()
    
    # For table creation, we need to use the Supabase SQL Editor
    # or the Management API. The Python client can't run raw DDL.
    # Instead, let's output the SQL and use the REST API to verify.
    
    from supabase import create_client
    
    try:
        client = create_client(url, key)
        print("✅ Connected to Supabase")
        
        # Check if tables exist by querying them
        tables_to_check = [
            'polybot_opportunities',
            'polybot_trades', 
            'polybot_status',
            'polybot_market_pairs'
        ]
        
        print()
        print("Checking for existing tables...")
        
        existing = []
        missing = []
        
        for table in tables_to_check:
            try:
                result = client.table(table).select("*").limit(1).execute()
                existing.append(table)
                print(f"  ✅ {table} exists")
            except Exception as e:
                if "does not exist" in str(e) or "404" in str(e) or "relation" in str(e):
                    missing.append(table)
                    print(f"  ❌ {table} needs to be created")
                else:
                    print(f"  ⚠️  {table}: {e}")
                    missing.append(table)
        
        if missing:
            print()
            print("=" * 60)
            print("⚠️  Some tables need to be created!")
            print("=" * 60)
            print()
            print("Please run the following SQL in your Supabase SQL Editor:")
            print("(Dashboard → SQL Editor → New Query → Paste & Run)")
            print()
            print("-" * 60)
            print(SCHEMA_SQL)
            print("-" * 60)
            print()
            print("After running the SQL, run this script again to verify.")
        else:
            print()
            print("=" * 60)
            print("✅ All PolyBot tables exist!")
            print("=" * 60)
            
            # Try to get status
            status = client.table('polybot_status').select("*").limit(1).execute()
            if status.data:
                s = status.data[0]
                print(f"  Running: {s.get('is_running', False)}")
                print(f"  Dry Run: {s.get('dry_run_mode', True)}")
                print(f"  Max Trade: ${s.get('max_trade_size', 100)}")
        
        # Also check PolyParlay tables to confirm isolation
        print()
        print("Checking PolyParlay tables (should NOT be touched)...")
        polyparlay_tables = ['users', 'markets', 'bets', 'parlays']
        for table in polyparlay_tables:
            try:
                client.table(table).select("*").limit(1).execute()
                print(f"  ✅ {table} exists (PolyParlay - untouched)")
            except:
                print(f"  ⚪ {table} not found (may not exist yet)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
