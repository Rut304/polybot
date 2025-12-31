-- ============================================
-- TRADINGVIEW SIGNALS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Create table to store TradingView webhook signals
CREATE TABLE IF NOT EXISTS polybot_tradingview_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'close')),
    price DECIMAL(20, 8),
    exchange TEXT,
    strategy TEXT,
    interval TEXT,  -- timeframe: 1m, 5m, 15m, 1H, 4H, D, W
    quantity DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    comment TEXT,
    raw_payload JSONB,  -- Store full original payload
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    process_result JSONB,  -- Store result of processing (trade executed, etc)
    received_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tv_signals_symbol ON polybot_tradingview_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_tv_signals_strategy ON polybot_tradingview_signals(strategy);
CREATE INDEX IF NOT EXISTS idx_tv_signals_received_at ON polybot_tradingview_signals(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_tv_signals_processed ON polybot_tradingview_signals(processed);
CREATE INDEX IF NOT EXISTS idx_tv_signals_action ON polybot_tradingview_signals(action);

-- Enable RLS
ALTER TABLE polybot_tradingview_signals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read tv_signals" ON polybot_tradingview_signals;
DROP POLICY IF EXISTS "Service role tv_signals" ON polybot_tradingview_signals;
DROP POLICY IF EXISTS "Allow public insert tv_signals" ON polybot_tradingview_signals;

-- RLS Policies
-- Allow authenticated users to read signals
CREATE POLICY "Allow authenticated read tv_signals" 
    ON polybot_tradingview_signals FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow anyone to insert (webhooks come from TradingView servers)
CREATE POLICY "Allow public insert tv_signals" 
    ON polybot_tradingview_signals FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role tv_signals" 
    ON polybot_tradingview_signals FOR ALL 
    TO service_role 
    USING (true);

-- ============================================
-- Useful Views
-- ============================================

-- View for recent signals with aggregated stats
CREATE OR REPLACE VIEW v_tradingview_signal_stats AS
SELECT 
    strategy,
    symbol,
    COUNT(*) as total_signals,
    COUNT(*) FILTER (WHERE action = 'buy') as buy_signals,
    COUNT(*) FILTER (WHERE action = 'sell') as sell_signals,
    COUNT(*) FILTER (WHERE processed = true) as processed_signals,
    MAX(received_at) as last_signal_at
FROM polybot_tradingview_signals
WHERE received_at > now() - interval '7 days'
GROUP BY strategy, symbol
ORDER BY last_signal_at DESC;

-- View for signal performance (if we track results)
CREATE OR REPLACE VIEW v_tradingview_signal_performance AS
SELECT 
    strategy,
    COUNT(*) as total_signals,
    COUNT(*) FILTER (WHERE processed = true) as executed,
    AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_execution_time_seconds
FROM polybot_tradingview_signals
WHERE strategy IS NOT NULL
GROUP BY strategy
ORDER BY total_signals DESC;
