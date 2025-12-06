-- Simulation Sessions History
-- This table stores snapshots of simulation runs for historical analysis

-- Create simulation_sessions table to track each simulation run
CREATE TABLE IF NOT EXISTS polybot_simulation_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, archived
    
    -- Starting conditions
    starting_balance DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
    
    -- Final results (populated when session ends)
    ending_balance DECIMAL(15, 2),
    total_pnl DECIMAL(15, 4),
    roi_pct DECIMAL(8, 4),
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    failed_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2),
    
    -- Strategy performance breakdown (JSON)
    strategies_used JSONB DEFAULT '{}',
    strategy_performance JSONB DEFAULT '{}',
    
    -- Configuration at time of run
    config_snapshot JSONB DEFAULT '{}',
    
    -- AI Analysis
    ai_analysis TEXT,
    ai_recommendations JSONB DEFAULT '[]',
    analysis_generated_at TIMESTAMPTZ,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sim_sessions_status ON polybot_simulation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sim_sessions_started_at ON polybot_simulation_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_sessions_ended_at ON polybot_simulation_sessions(ended_at DESC);

-- Create session_trades table to preserve trades when archiving
CREATE TABLE IF NOT EXISTS polybot_session_trades (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES polybot_simulation_sessions(session_id) ON DELETE CASCADE,
    original_trade_id INTEGER,
    position_id VARCHAR(50),
    created_at TIMESTAMPTZ,
    
    -- Market info
    platform VARCHAR(50),
    market_id VARCHAR(255),
    market_title TEXT,
    
    -- Trade details
    trade_type VARCHAR(50),
    arbitrage_type VARCHAR(50),
    side VARCHAR(10),
    position_size_usd DECIMAL(15, 2),
    
    -- Prices
    yes_price DECIMAL(8, 6),
    no_price DECIMAL(8, 6),
    
    -- Results
    expected_profit_pct DECIMAL(8, 4),
    expected_profit_usd DECIMAL(15, 4),
    actual_profit_usd DECIMAL(15, 4),
    outcome VARCHAR(30),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    
    -- Raw trade data
    raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_session_trades_session ON polybot_session_trades(session_id);
CREATE INDEX IF NOT EXISTS idx_session_trades_outcome ON polybot_session_trades(outcome);

-- Function to archive current simulation and start new session
CREATE OR REPLACE FUNCTION archive_simulation_session(
    p_ending_balance DECIMAL,
    p_total_pnl DECIMAL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_trades_count INTEGER;
    v_winning INTEGER;
    v_losing INTEGER;
    v_failed INTEGER;
BEGIN
    -- Generate new session ID
    v_session_id := gen_random_uuid();
    
    -- Count trades
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE outcome = 'won'),
        COUNT(*) FILTER (WHERE outcome = 'lost'),
        COUNT(*) FILTER (WHERE outcome = 'failed_execution')
    INTO v_trades_count, v_winning, v_losing, v_failed
    FROM polybot_simulated_trades;
    
    -- Create session record
    INSERT INTO polybot_simulation_sessions (
        session_id,
        started_at,
        ended_at,
        status,
        starting_balance,
        ending_balance,
        total_pnl,
        roi_pct,
        total_trades,
        winning_trades,
        losing_trades,
        failed_trades,
        win_rate,
        notes
    )
    SELECT 
        v_session_id,
        MIN(created_at),
        NOW(),
        'completed',
        5000.00,
        p_ending_balance,
        p_total_pnl,
        (p_total_pnl / 5000.00) * 100,
        v_trades_count,
        v_winning,
        v_losing,
        v_failed,
        CASE WHEN (v_winning + v_losing) > 0 
            THEN (v_winning::DECIMAL / (v_winning + v_losing)::DECIMAL) * 100 
            ELSE 0 
        END,
        p_notes
    FROM polybot_simulated_trades
    WHERE id > 0
    HAVING COUNT(*) > 0;
    
    -- If no trades, still create a session record
    IF NOT FOUND THEN
        INSERT INTO polybot_simulation_sessions (
            session_id, ended_at, status, ending_balance, total_pnl, roi_pct, notes
        ) VALUES (
            v_session_id, NOW(), 'completed', p_ending_balance, p_total_pnl, 
            (p_total_pnl / 5000.00) * 100, p_notes
        );
    END IF;
    
    -- Copy trades to session_trades
    INSERT INTO polybot_session_trades (
        session_id, original_trade_id, position_id, created_at,
        platform, market_id, market_title, trade_type, arbitrage_type,
        side, position_size_usd, yes_price, no_price,
        expected_profit_pct, expected_profit_usd, actual_profit_usd,
        outcome, resolution_notes, resolved_at, raw_data
    )
    SELECT 
        v_session_id,
        id,
        position_id,
        created_at,
        CASE 
            WHEN arbitrage_type LIKE '%kalshi%' THEN 'Kalshi'
            WHEN arbitrage_type LIKE '%poly%' THEN 'Polymarket'
            ELSE 'Unknown'
        END,
        COALESCE(polymarket_token_id, kalshi_ticker),
        COALESCE(polymarket_market_title, kalshi_market_title),
        trade_type,
        arbitrage_type,
        CASE WHEN polymarket_yes_price > 0 THEN 'yes' ELSE 'no' END,
        position_size_usd,
        polymarket_yes_price,
        polymarket_no_price,
        expected_profit_pct,
        expected_profit_usd,
        actual_profit_usd,
        outcome,
        resolution_notes,
        resolved_at,
        NULL
    FROM polybot_simulated_trades;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE polybot_simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_session_trades ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on sessions" ON polybot_simulation_sessions
    FOR ALL USING (auth.role() = 'service_role');
    
CREATE POLICY "Service role full access on session_trades" ON polybot_session_trades
    FOR ALL USING (auth.role() = 'service_role');

-- Allow anon key to read
CREATE POLICY "Anon can read sessions" ON polybot_simulation_sessions
    FOR SELECT USING (true);
    
CREATE POLICY "Anon can read session_trades" ON polybot_session_trades
    FOR SELECT USING (true);

COMMENT ON TABLE polybot_simulation_sessions IS 'Stores archived simulation runs for historical analysis';
COMMENT ON TABLE polybot_session_trades IS 'Stores trades from archived simulation sessions';
COMMENT ON FUNCTION archive_simulation_session IS 'Archives current simulation data and returns session ID';
