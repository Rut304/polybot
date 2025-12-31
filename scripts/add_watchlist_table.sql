-- ============================================
-- WATCHLIST TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Create watchlist table for tracking markets of interest
CREATE TABLE IF NOT EXISTS polybot_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,  -- Optional: for multi-tenant support
    market_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    market_title TEXT NOT NULL,
    category TEXT,
    notes TEXT,
    alert_above DECIMAL(10, 6),  -- Alert when price goes above
    alert_below DECIMAL(10, 6),  -- Alert when price goes below
    added_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique market per user (or globally if no user_id)
    UNIQUE(market_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_market_id ON polybot_watchlist(market_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON polybot_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_platform ON polybot_watchlist(platform);
CREATE INDEX IF NOT EXISTS idx_watchlist_added_at ON polybot_watchlist(added_at DESC);

-- Enable RLS
ALTER TABLE polybot_watchlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users manage own watchlist" ON polybot_watchlist;
DROP POLICY IF EXISTS "Service role watchlist" ON polybot_watchlist;
DROP POLICY IF EXISTS "Allow authenticated read watchlist" ON polybot_watchlist;
DROP POLICY IF EXISTS "Allow authenticated insert watchlist" ON polybot_watchlist;
DROP POLICY IF EXISTS "Allow authenticated update watchlist" ON polybot_watchlist;
DROP POLICY IF EXISTS "Allow authenticated delete watchlist" ON polybot_watchlist;

-- Create RLS policies
-- Allow all authenticated users to read all watchlist items (shared watchlist)
CREATE POLICY "Allow authenticated read watchlist" 
    ON polybot_watchlist FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert watchlist" 
    ON polybot_watchlist FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow authenticated users to update (their own or global items)
CREATE POLICY "Allow authenticated update watchlist" 
    ON polybot_watchlist FOR UPDATE 
    TO authenticated 
    USING (user_id IS NULL OR user_id = auth.uid());

-- Allow authenticated users to delete (their own or global items)
CREATE POLICY "Allow authenticated delete watchlist" 
    ON polybot_watchlist FOR DELETE 
    TO authenticated 
    USING (user_id IS NULL OR user_id = auth.uid());

-- Service role has full access (for the bot)
CREATE POLICY "Service role watchlist" 
    ON polybot_watchlist FOR ALL 
    TO service_role 
    USING (true);

-- Grant anon role select access for public watchlist (if needed)
-- CREATE POLICY "Allow anon read watchlist" ON polybot_watchlist FOR SELECT TO anon USING (user_id IS NULL);

-- ============================================
-- Add trigger to update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_watchlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_watchlist_timestamp ON polybot_watchlist;
CREATE TRIGGER update_watchlist_timestamp
    BEFORE UPDATE ON polybot_watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_watchlist_updated_at();

-- ============================================
-- Insert some example watchlist items for testing
-- ============================================
-- INSERT INTO polybot_watchlist (market_id, platform, market_title, category) VALUES
--     ('telcoin-2024', 'polymarket', 'Will Telcoin reach $1 by end of 2024?', 'Crypto'),
--     ('btc-100k-2024', 'polymarket', 'Will Bitcoin reach $100k by end of 2024?', 'Crypto'),
--     ('trump-election-winner', 'polymarket', 'Who will win the 2024 Presidential Election?', 'Politics');
