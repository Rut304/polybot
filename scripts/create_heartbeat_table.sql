-- Create heartbeat table for bot health monitoring
-- Run this in Supabase SQL Editor

-- Drop if exists
DROP TABLE IF EXISTS polybot_heartbeat;

-- Create heartbeat table
CREATE TABLE polybot_heartbeat (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    scan_count INTEGER DEFAULT 0,
    active_strategies TEXT[] DEFAULT '{}',
    memory_usage_mb FLOAT,
    cpu_percent FLOAT,
    version TEXT,
    build INTEGER,
    is_dry_run BOOLEAN DEFAULT true,
    errors_last_hour INTEGER DEFAULT 0,
    trades_last_hour INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT heartbeat_timestamp_idx UNIQUE (user_id, timestamp)
);

-- Create index for fast lookups
CREATE INDEX idx_heartbeat_timestamp ON polybot_heartbeat(timestamp DESC);
CREATE INDEX idx_heartbeat_user ON polybot_heartbeat(user_id);

-- Enable RLS
ALTER TABLE polybot_heartbeat ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role can do everything
CREATE POLICY "Service role full access" ON polybot_heartbeat
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Users can read their own heartbeats
CREATE POLICY "Users can view own heartbeats" ON polybot_heartbeat
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admin can view all heartbeats
CREATE POLICY "Admin can view all heartbeats" ON polybot_heartbeat
    FOR SELECT
    TO authenticated
    USING (
        auth.jwt() ->> 'email' = 'rutrohd@gmail.com'
    );

-- Clean up old heartbeats (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_heartbeats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM polybot_heartbeat
    WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create a scheduled job to clean up old heartbeats (requires pg_cron extension)
-- If pg_cron is available:
-- SELECT cron.schedule('cleanup-heartbeats', '0 * * * *', $$SELECT cleanup_old_heartbeats()$$);

COMMENT ON TABLE polybot_heartbeat IS 'Stores periodic heartbeat signals from the trading bot for health monitoring';
COMMENT ON COLUMN polybot_heartbeat.scan_count IS 'Total number of market scans since bot started';
COMMENT ON COLUMN polybot_heartbeat.active_strategies IS 'Array of currently active strategy names';
COMMENT ON COLUMN polybot_heartbeat.errors_last_hour IS 'Count of errors in the last hour';
COMMENT ON COLUMN polybot_heartbeat.trades_last_hour IS 'Count of trades executed in the last hour';
