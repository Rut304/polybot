-- PolyBot Advanced Features Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- TRACKED TRADERS (for Copy Trading)
-- ============================================
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

-- Create index on wallet address
CREATE INDEX IF NOT EXISTS idx_tracked_traders_address 
ON polybot_tracked_traders(wallet_address);

-- ============================================
-- COPY SIGNALS (Signals from tracked traders)
-- ============================================
CREATE TABLE IF NOT EXISTS polybot_copy_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trader_address TEXT NOT NULL,
    condition_id TEXT NOT NULL,
    token_id TEXT,
    market_slug TEXT,
    action TEXT NOT NULL, -- 'buy', 'sell', 'increase', 'decrease'
    outcome TEXT NOT NULL, -- 'Yes', 'No'
    original_size DECIMAL(20, 4) NOT NULL,
    copy_size DECIMAL(20, 4),
    price DECIMAL(10, 6) NOT NULL,
    executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMPTZ,
    execution_price DECIMAL(10, 6),
    detected_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_copy_signals_trader 
ON polybot_copy_signals(trader_address);
CREATE INDEX IF NOT EXISTS idx_copy_signals_detected 
ON polybot_copy_signals(detected_at DESC);

-- ============================================
-- OVERLAPPING ARBITRAGE OPPORTUNITIES
-- ============================================
CREATE TABLE IF NOT EXISTS polybot_overlap_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_a_id TEXT NOT NULL,
    market_a_question TEXT,
    market_a_price DECIMAL(10, 6),
    market_b_id TEXT NOT NULL,
    market_b_question TEXT,
    market_b_price DECIMAL(10, 6),
    relationship TEXT NOT NULL, -- 'implies', 'mutually_exclusive', 'correlated'
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

-- Create index on deviation for finding best opportunities
CREATE INDEX IF NOT EXISTS idx_overlap_deviation 
ON polybot_overlap_opportunities(deviation DESC);

-- ============================================
-- POSITIONS (User's open and closed positions)
-- ============================================
CREATE TABLE IF NOT EXISTS polybot_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condition_id TEXT NOT NULL,
    token_id TEXT,
    market_question TEXT,
    outcome TEXT NOT NULL,
    size DECIMAL(20, 6) NOT NULL,
    avg_entry_price DECIMAL(10, 6) NOT NULL,
    current_price DECIMAL(10, 6),
    status TEXT DEFAULT 'open', -- 'open', 'resolved_win', 'resolved_loss', 'claimed'
    unrealized_pnl DECIMAL(20, 4),
    realized_pnl DECIMAL(20, 4),
    entry_time TIMESTAMPTZ DEFAULT now(),
    resolved_time TIMESTAMPTZ,
    claimed_time TIMESTAMPTZ,
    claim_amount DECIMAL(20, 4),
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_positions_status 
ON polybot_positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_condition 
ON polybot_positions(condition_id);

-- ============================================
-- NEWS & ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS polybot_news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL, -- 'polymarket', 'news_api', 'twitter', etc.
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    author TEXT,
    sentiment TEXT, -- 'very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'
    sentiment_score DECIMAL(5, 4),
    keywords TEXT[], -- Array of keywords
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for recent news
CREATE INDEX IF NOT EXISTS idx_news_published 
ON polybot_news_items(published_at DESC);

CREATE TABLE IF NOT EXISTS polybot_market_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_condition_id TEXT NOT NULL,
    market_question TEXT,
    news_item_id UUID REFERENCES polybot_news_items(id),
    alert_type TEXT NOT NULL, -- 'sentiment_shift', 'breaking_news', 'volume_spike'
    confidence DECIMAL(5, 4),
    suggested_action TEXT, -- 'buy', 'sell', 'watch'
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unack 
ON polybot_market_alerts(acknowledged, created_at DESC);

-- ============================================
-- MANUAL TRADES (for Admin Dashboard)
-- ============================================
CREATE TABLE IF NOT EXISTS polybot_manual_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    market_id TEXT NOT NULL,
    market_question TEXT,
    side TEXT NOT NULL, -- 'buy', 'sell'
    outcome TEXT NOT NULL, -- 'Yes', 'No'
    amount DECIMAL(20, 4) NOT NULL,
    price DECIMAL(10, 6),
    status TEXT DEFAULT 'pending', -- 'pending', 'executed', 'failed', 'cancelled'
    executed_at TIMESTAMPTZ,
    tx_hash TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BOT CONFIGURATION
-- ============================================
CREATE TABLE IF NOT EXISTS polybot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default config values
INSERT INTO polybot_config (key, value, description) VALUES
    ('copy_trading_enabled', 'true', 'Enable/disable copy trading feature'),
    ('arb_detection_enabled', 'true', 'Enable/disable arbitrage detection'),
    ('position_manager_enabled', 'true', 'Enable/disable position manager'),
    ('news_sentiment_enabled', 'true', 'Enable/disable news/sentiment monitoring'),
    ('simulation_mode', 'true', 'Run in simulation mode (no real trades)'),
    ('min_arbitrage_spread', '0.02', 'Minimum spread to trigger arbitrage'),
    ('max_position_size', '100', 'Maximum position size in USDC'),
    ('copy_percentage', '0.1', 'Percentage of whale trade to copy')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE polybot_tracked_traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_copy_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_overlap_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_market_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_manual_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_config ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (read access)
CREATE POLICY "Allow authenticated read" ON polybot_tracked_traders
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON polybot_copy_signals
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON polybot_overlap_opportunities
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON polybot_positions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON polybot_news_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON polybot_market_alerts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON polybot_manual_trades
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON polybot_config
    FOR SELECT TO authenticated USING (true);

-- Service role has full access (for the bot)
CREATE POLICY "Allow service full access" ON polybot_tracked_traders
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service full access" ON polybot_copy_signals
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service full access" ON polybot_overlap_opportunities
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service full access" ON polybot_positions
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service full access" ON polybot_news_items
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service full access" ON polybot_market_alerts
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service full access" ON polybot_manual_trades
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service full access" ON polybot_config
    FOR ALL TO service_role USING (true);

-- ============================================
-- VIEWS FOR DASHBOARD
-- ============================================

-- Copy trading performance view
CREATE OR REPLACE VIEW v_copy_trading_performance AS
SELECT 
    t.wallet_address,
    t.nickname,
    t.total_pnl,
    t.win_rate,
    t.total_trades,
    COUNT(s.id) as signals_24h,
    MAX(s.detected_at) as last_signal
FROM polybot_tracked_traders t
LEFT JOIN polybot_copy_signals s 
    ON t.wallet_address = s.trader_address 
    AND s.detected_at > now() - interval '24 hours'
GROUP BY t.wallet_address, t.nickname, t.total_pnl, t.win_rate, t.total_trades;

-- Position summary view
CREATE OR REPLACE VIEW v_position_summary AS
SELECT 
    status,
    COUNT(*) as count,
    SUM(size * avg_entry_price) as total_invested,
    SUM(CASE WHEN status = 'open' THEN unrealized_pnl ELSE realized_pnl END) as total_pnl
FROM polybot_positions
GROUP BY status;

-- Alert summary view
CREATE OR REPLACE VIEW v_alert_summary AS
SELECT 
    alert_type,
    suggested_action,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE NOT acknowledged) as unacknowledged
FROM polybot_market_alerts
WHERE created_at > now() - interval '24 hours'
GROUP BY alert_type, suggested_action;

-- ============================================
-- UPDATE USER ROLE (Run this for your admin user)
-- ============================================
-- UPDATE polybot_user_profiles 
-- SET role = 'admin' 
-- WHERE email = 'rutrohd@gmail.com';

SELECT 'Schema created successfully!' as result;
