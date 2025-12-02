-- ============================================
-- QUICK SETUP: Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad/sql
-- ============================================

-- 1. Set your user as admin
INSERT INTO polybot_user_profiles (email, role, display_name)
VALUES ('rutrohd@gmail.com', 'admin', 'Rut (Admin)')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- 2. Create tracked traders table
CREATE TABLE IF NOT EXISTS polybot_tracked_traders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    nickname TEXT,
    total_pnl DECIMAL(20, 4) DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    last_trade_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    copy_percentage DECIMAL(5, 2) DEFAULT 10.0,
    max_position_size DECIMAL(20, 4) DEFAULT 100.0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create copy signals table
CREATE TABLE IF NOT EXISTS polybot_copy_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trader_address TEXT NOT NULL,
    condition_id TEXT NOT NULL,
    token_id TEXT,
    market_slug TEXT,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    original_size DECIMAL(20, 4) NOT NULL,
    copy_size DECIMAL(20, 4),
    price DECIMAL(10, 6) NOT NULL,
    executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMPTZ,
    execution_price DECIMAL(10, 6),
    detected_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create overlap opportunities table
CREATE TABLE IF NOT EXISTS polybot_overlap_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_a_id TEXT NOT NULL,
    market_a_question TEXT,
    market_a_price DECIMAL(10, 6),
    market_b_id TEXT NOT NULL,
    market_b_question TEXT,
    market_b_price DECIMAL(10, 6),
    relationship TEXT NOT NULL,
    combined_probability DECIMAL(10, 6),
    deviation DECIMAL(10, 4) NOT NULL,
    profit_potential DECIMAL(20, 6),
    confidence DECIMAL(5, 4),
    is_active BOOLEAN DEFAULT true,
    executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMPTZ,
    detected_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create manual trades table
CREATE TABLE IF NOT EXISTS polybot_manual_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    market_id TEXT NOT NULL,
    market_question TEXT,
    side TEXT NOT NULL,
    outcome TEXT NOT NULL,
    amount DECIMAL(20, 4) NOT NULL,
    price DECIMAL(10, 6),
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMPTZ,
    tx_hash TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create news items table
CREATE TABLE IF NOT EXISTS polybot_news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    author TEXT,
    sentiment TEXT,
    sentiment_score DECIMAL(5, 4),
    keywords TEXT[],
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create market alerts table
CREATE TABLE IF NOT EXISTS polybot_market_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_condition_id TEXT NOT NULL,
    market_question TEXT,
    news_item_id UUID REFERENCES polybot_news_items(id),
    alert_type TEXT NOT NULL,
    confidence DECIMAL(5, 4),
    suggested_action TEXT,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Enable RLS and create policies
ALTER TABLE polybot_tracked_traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_copy_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_overlap_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_manual_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_market_alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY IF NOT EXISTS "authenticated_read" ON polybot_tracked_traders FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "authenticated_read" ON polybot_copy_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "authenticated_read" ON polybot_overlap_opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "authenticated_read" ON polybot_manual_trades FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "authenticated_read" ON polybot_news_items FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "authenticated_read" ON polybot_market_alerts FOR SELECT TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY IF NOT EXISTS "service_all" ON polybot_tracked_traders FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_all" ON polybot_copy_signals FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_all" ON polybot_overlap_opportunities FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_all" ON polybot_manual_trades FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_all" ON polybot_news_items FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_all" ON polybot_market_alerts FOR ALL TO service_role USING (true);

-- Verify
SELECT 'Setup complete!' as result;
SELECT * FROM polybot_user_profiles;
