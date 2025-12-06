-- PolyBot Enhanced Trade Tracking Schema
-- Adds trading_mode and strategy filtering support
-- Run this in Supabase SQL Editor

-- Add trading_mode column to distinguish paper vs live trades
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'paper';

-- Add strategy_type for better filtering (normalized version of arbitrage_type)
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS strategy_type TEXT;

-- Add platform column to track which platform(s) involved
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add session_id to group trades by trading session
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_simulated_trades_mode 
    ON polybot_simulated_trades(trading_mode);
    
CREATE INDEX IF NOT EXISTS idx_simulated_trades_strategy 
    ON polybot_simulated_trades(strategy_type);
    
CREATE INDEX IF NOT EXISTS idx_simulated_trades_outcome 
    ON polybot_simulated_trades(outcome);

CREATE INDEX IF NOT EXISTS idx_simulated_trades_session 
    ON polybot_simulated_trades(session_id);

-- Create a view for per-strategy analytics
CREATE OR REPLACE VIEW polybot_strategy_performance AS
SELECT 
    trading_mode,
    COALESCE(strategy_type, arbitrage_type, trade_type) as strategy,
    COUNT(*) as total_trades,
    COUNT(CASE WHEN outcome = 'won' THEN 1 END) as winning_trades,
    COUNT(CASE WHEN outcome = 'lost' THEN 1 END) as losing_trades,
    ROUND(
        COUNT(CASE WHEN outcome = 'won' THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(CASE WHEN outcome IN ('won', 'lost') THEN 1 END), 0) * 100, 
        2
    ) as win_rate_pct,
    ROUND(SUM(COALESCE(actual_profit_usd, 0))::NUMERIC, 2) as total_pnl,
    ROUND(AVG(COALESCE(actual_profit_usd, 0))::NUMERIC, 4) as avg_trade_pnl,
    ROUND(MAX(COALESCE(actual_profit_usd, 0))::NUMERIC, 4) as best_trade,
    ROUND(MIN(COALESCE(actual_profit_usd, 0))::NUMERIC, 4) as worst_trade,
    ROUND(SUM(COALESCE(position_size_usd, 0))::NUMERIC, 2) as total_volume,
    MIN(created_at) as first_trade_at,
    MAX(created_at) as last_trade_at
FROM polybot_simulated_trades
WHERE outcome IN ('won', 'lost')
GROUP BY trading_mode, COALESCE(strategy_type, arbitrage_type, trade_type)
ORDER BY trading_mode, total_pnl DESC;

-- Create a view for daily P&L tracking
CREATE OR REPLACE VIEW polybot_daily_pnl AS
SELECT 
    trading_mode,
    DATE(created_at) as trade_date,
    COALESCE(strategy_type, arbitrage_type, trade_type) as strategy,
    COUNT(*) as trades,
    COUNT(CASE WHEN outcome = 'won' THEN 1 END) as wins,
    COUNT(CASE WHEN outcome = 'lost' THEN 1 END) as losses,
    ROUND(SUM(COALESCE(actual_profit_usd, 0))::NUMERIC, 2) as daily_pnl,
    ROUND(SUM(COALESCE(position_size_usd, 0))::NUMERIC, 2) as daily_volume
FROM polybot_simulated_trades
WHERE outcome IN ('won', 'lost')
GROUP BY trading_mode, DATE(created_at), COALESCE(strategy_type, arbitrage_type, trade_type)
ORDER BY trade_date DESC, trading_mode, strategy;

-- Create function to get strategy summary
CREATE OR REPLACE FUNCTION get_strategy_summary(
    p_trading_mode TEXT DEFAULT NULL,
    p_strategy TEXT DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    trading_mode TEXT,
    strategy TEXT,
    total_trades BIGINT,
    win_rate NUMERIC,
    total_pnl NUMERIC,
    avg_pnl NUMERIC,
    roi_pct NUMERIC,
    sharpe_ratio NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.trading_mode,
        COALESCE(t.strategy_type, t.arbitrage_type, t.trade_type) as strategy,
        COUNT(*)::BIGINT as total_trades,
        ROUND(
            COUNT(CASE WHEN t.outcome = 'won' THEN 1 END)::NUMERIC / 
            NULLIF(COUNT(CASE WHEN t.outcome IN ('won', 'lost') THEN 1 END), 0) * 100, 
            2
        ) as win_rate,
        ROUND(SUM(COALESCE(t.actual_profit_usd, 0))::NUMERIC, 2) as total_pnl,
        ROUND(AVG(COALESCE(t.actual_profit_usd, 0))::NUMERIC, 4) as avg_pnl,
        ROUND(
            SUM(COALESCE(t.actual_profit_usd, 0))::NUMERIC / 
            NULLIF(SUM(COALESCE(t.position_size_usd, 0)), 0) * 100, 
            2
        ) as roi_pct,
        -- Simple Sharpe approximation: avg / stddev
        ROUND(
            AVG(COALESCE(t.actual_profit_usd, 0))::NUMERIC / 
            NULLIF(STDDEV(COALESCE(t.actual_profit_usd, 0)), 0), 
            4
        ) as sharpe_ratio
    FROM polybot_simulated_trades t
    WHERE t.outcome IN ('won', 'lost')
      AND t.created_at >= NOW() - (p_days || ' days')::INTERVAL
      AND (p_trading_mode IS NULL OR t.trading_mode = p_trading_mode)
      AND (p_strategy IS NULL OR COALESCE(t.strategy_type, t.arbitrage_type, t.trade_type) = p_strategy)
    GROUP BY t.trading_mode, COALESCE(t.strategy_type, t.arbitrage_type, t.trade_type)
    ORDER BY total_pnl DESC;
END;
$$ LANGUAGE plpgsql;

-- Update existing records to have trading_mode = 'paper' if null
UPDATE polybot_simulated_trades 
SET trading_mode = 'paper' 
WHERE trading_mode IS NULL;

-- Update strategy_type from arbitrage_type where available
UPDATE polybot_simulated_trades 
SET strategy_type = arbitrage_type 
WHERE strategy_type IS NULL AND arbitrage_type IS NOT NULL;

-- Update strategy_type from trade_type where arbitrage_type not available
UPDATE polybot_simulated_trades 
SET strategy_type = trade_type 
WHERE strategy_type IS NULL AND trade_type IS NOT NULL;

SELECT 'Trading mode columns and analytics views created successfully!' AS status;
