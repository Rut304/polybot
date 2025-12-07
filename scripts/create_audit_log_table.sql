-- Create audit log table for tracking all admin actions
-- Run this in Supabase SQL Editor

-- Audit log table
CREATE TABLE IF NOT EXISTS polybot_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON polybot_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON polybot_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON polybot_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON polybot_audit_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON polybot_audit_log(severity);

-- Enable RLS
ALTER TABLE polybot_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (service role bypasses RLS)
DROP POLICY IF EXISTS "Admins can read audit logs" ON polybot_audit_log;
CREATE POLICY "Admins can read audit logs" ON polybot_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM polybot_user_profiles
            WHERE polybot_user_profiles.id = auth.uid()
            AND polybot_user_profiles.role = 'admin'
        )
    );

-- Only service role can insert (from API routes)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON polybot_audit_log;
CREATE POLICY "Service role can insert audit logs" ON polybot_audit_log
    FOR INSERT
    WITH CHECK (true);

-- Bot activity log for autonomous operation monitoring
CREATE TABLE IF NOT EXISTS polybot_bot_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    level TEXT DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
    component TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    session_id TEXT,
    trade_id TEXT
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON polybot_bot_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON polybot_bot_logs(level);
CREATE INDEX IF NOT EXISTS idx_bot_logs_component ON polybot_bot_logs(component);
CREATE INDEX IF NOT EXISTS idx_bot_logs_session_id ON polybot_bot_logs(session_id);

-- Enable RLS
ALTER TABLE polybot_bot_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read bot logs
DROP POLICY IF EXISTS "Admins can read bot logs" ON polybot_bot_logs;
CREATE POLICY "Admins can read bot logs" ON polybot_bot_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM polybot_user_profiles
            WHERE polybot_user_profiles.id = auth.uid()
            AND polybot_user_profiles.role = 'admin'
        )
    );

-- Service role can insert bot logs
DROP POLICY IF EXISTS "Service role can insert bot logs" ON polybot_bot_logs;
CREATE POLICY "Service role can insert bot logs" ON polybot_bot_logs
    FOR INSERT
    WITH CHECK (true);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS polybot_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INT DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(identifier, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON polybot_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON polybot_rate_limits(window_start);

-- Auto-cleanup old audit logs (keep 90 days)
-- Run this as a scheduled job or trigger
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM polybot_audit_log WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM polybot_bot_logs WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM polybot_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Verify tables created
SELECT 'polybot_audit_log' as table_name, COUNT(*) as rows FROM polybot_audit_log
UNION ALL
SELECT 'polybot_bot_logs', COUNT(*) FROM polybot_bot_logs
UNION ALL
SELECT 'polybot_rate_limits', COUNT(*) FROM polybot_rate_limits;
