-- ============================================================================
-- Trading Sessions Migration
-- ============================================================================
-- This migration adds:
-- 1. trading_mode column to polybot_opportunities for filtering
-- 2. trading_sessions table to track when user switches between live/paper
-- 3. Auto-save of session stats when switching modes
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- ============================================================================
-- 1. Add trading_mode to opportunities table
-- ============================================================================
ALTER TABLE polybot_opportunities 
ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'paper';

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_trading_mode 
ON polybot_opportunities(trading_mode);

-- Set existing rows to paper (historical data is from simulation)
UPDATE polybot_opportunities 
SET trading_mode = 'paper' 
WHERE trading_mode IS NULL;

COMMENT ON COLUMN polybot_opportunities.trading_mode IS 
'Trading mode when opportunity was detected: paper (simulation) or live (real money)';

-- ============================================================================
-- 2. Add trading_mode to simulated_trades table (for proper filtering)
-- ============================================================================
ALTER TABLE polybot_simulated_trades
ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'paper';

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_trades_trading_mode 
ON polybot_simulated_trades(trading_mode);

-- Set existing rows to paper
UPDATE polybot_simulated_trades 
SET trading_mode = 'paper' 
WHERE trading_mode IS NULL;

COMMENT ON COLUMN polybot_simulated_trades.trading_mode IS 
'Trading mode when trade was executed: paper (simulation) or live (real money)';

-- ============================================================================
-- 3. Create trading_sessions table to track mode switches
-- ============================================================================
CREATE TABLE IF NOT EXISTS polybot_trading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session info
    session_mode TEXT NOT NULL CHECK (session_mode IN ('paper', 'live')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- Session stats (captured when session ends)
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    total_pnl DECIMAL(20, 8) DEFAULT 0,
    roi_percent DECIMAL(10, 4) DEFAULT 0,
    starting_balance DECIMAL(20, 8),
    ending_balance DECIMAL(20, 8),
    opportunities_detected INTEGER DEFAULT 0,
    opportunities_executed INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_id ON polybot_trading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_mode ON polybot_trading_sessions(session_mode);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_started ON polybot_trading_sessions(started_at);

-- RLS Policies
ALTER TABLE polybot_trading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON polybot_trading_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON polybot_trading_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON polybot_trading_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Add session_id to trades and opportunities for correlation
-- ============================================================================
ALTER TABLE polybot_simulated_trades
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES polybot_trading_sessions(id);

ALTER TABLE polybot_opportunities
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES polybot_trading_sessions(id);

-- ============================================================================
-- 5. Function to get current active session for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_trading_session(p_user_id UUID)
RETURNS polybot_trading_sessions AS $$
    SELECT * FROM polybot_trading_sessions 
    WHERE user_id = p_user_id 
      AND ended_at IS NULL 
    ORDER BY started_at DESC 
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- 6. Function to end current session and start new one
-- ============================================================================
CREATE OR REPLACE FUNCTION switch_trading_mode(
    p_user_id UUID,
    p_new_mode TEXT,
    p_ending_balance DECIMAL DEFAULT NULL,
    p_total_trades INTEGER DEFAULT 0,
    p_winning_trades INTEGER DEFAULT 0,
    p_losing_trades INTEGER DEFAULT 0,
    p_total_pnl DECIMAL DEFAULT 0,
    p_opportunities_detected INTEGER DEFAULT 0,
    p_opportunities_executed INTEGER DEFAULT 0
)
RETURNS polybot_trading_sessions AS $$
DECLARE
    v_old_session polybot_trading_sessions;
    v_new_session polybot_trading_sessions;
BEGIN
    -- End current active session if exists
    UPDATE polybot_trading_sessions 
    SET 
        ended_at = NOW(),
        ending_balance = p_ending_balance,
        total_trades = p_total_trades,
        winning_trades = p_winning_trades,
        losing_trades = p_losing_trades,
        total_pnl = p_total_pnl,
        opportunities_detected = p_opportunities_detected,
        opportunities_executed = p_opportunities_executed,
        updated_at = NOW()
    WHERE user_id = p_user_id 
      AND ended_at IS NULL
    RETURNING * INTO v_old_session;
    
    -- Create new session
    INSERT INTO polybot_trading_sessions (
        user_id, 
        session_mode, 
        starting_balance
    ) VALUES (
        p_user_id, 
        p_new_mode, 
        p_ending_balance
    )
    RETURNING * INTO v_new_session;
    
    RETURN v_new_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION switch_trading_mode IS 
'Ends current trading session with stats and starts a new session in the specified mode';

-- ============================================================================
-- Done! Now the app can:
-- 1. Filter opportunities/trades by trading_mode
-- 2. Track sessions when user switches modes
-- 3. Save historical stats for each session
-- ============================================================================
