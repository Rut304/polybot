-- PolyParlay Feature Flags Schema
-- Admin Feature Control Panel - Global and Per-User Feature Toggles
-- Run this to create the feature flags infrastructure

BEGIN;

-- ============================================
-- GLOBAL FEATURE FLAGS TABLE
-- ============================================
-- Controls system-wide feature availability
CREATE TABLE IF NOT EXISTS public.polybot_feature_flags (
    id SERIAL PRIMARY KEY,
    flag_key TEXT NOT NULL UNIQUE,
    flag_name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    category TEXT DEFAULT 'general',  -- 'general', 'trading', 'ui', 'beta', 'maintenance'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default feature flags
INSERT INTO public.polybot_feature_flags (flag_key, flag_name, description, enabled, category) VALUES
    -- System Features
    ('maintenance_mode', 'Maintenance Mode', 'Enable to show maintenance page to all non-admin users', false, 'maintenance'),
    ('new_signups_enabled', 'New Signups', 'Allow new user registrations', true, 'general'),
    ('live_trading_enabled', 'Live Trading', 'Global kill switch for all live trading', true, 'trading'),
    
    -- Trading Features
    ('cross_platform_arb', 'Cross-Platform Arbitrage', 'Enable cross-platform arbitrage strategy', true, 'trading'),
    ('kalshi_trading', 'Kalshi Trading', 'Enable Kalshi market trading', true, 'trading'),
    ('polymarket_trading', 'Polymarket Trading', 'Enable Polymarket trading', true, 'trading'),
    ('stock_trading', 'Stock Trading', 'Enable stock market strategies', false, 'trading'),
    ('crypto_trading', 'Crypto Trading', 'Enable cryptocurrency strategies', false, 'trading'),
    
    -- UI Features
    ('missed_opportunities', 'Missed Opportunities Page', 'Show missed money/opportunities page', true, 'ui'),
    ('leaderboard', 'Leaderboard', 'Show trading leaderboard', true, 'ui'),
    ('advanced_analytics', 'Advanced Analytics', 'Show advanced analytics dashboards', true, 'ui'),
    ('strategy_builder', 'Strategy Builder', 'Show custom strategy builder', false, 'ui'),
    
    -- Beta Features
    ('ai_assistant', 'AI Trading Assistant', 'Enable AI-powered trading assistant', false, 'beta'),
    ('social_trading', 'Social Trading', 'Enable copy trading and social features', false, 'beta'),
    ('auto_rebalancing', 'Auto Rebalancing', 'Enable automatic portfolio rebalancing', false, 'beta'),
    ('congressional_tracker', 'Congressional Trading Tracker', 'Track congressional trading activity', false, 'beta')
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================
-- USER FEATURE OVERRIDES TABLE
-- ============================================
-- Per-user feature flag overrides (for beta testing, etc.)
CREATE TABLE IF NOT EXISTS public.polybot_user_feature_overrides (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flag_key TEXT NOT NULL REFERENCES public.polybot_feature_flags(flag_key) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL,
    reason TEXT,  -- Why this user has an override (e.g., 'beta tester', 'bug fix', 'special request')
    granted_by TEXT,  -- Admin email who granted the override
    expires_at TIMESTAMPTZ,  -- Optional expiration for temporary overrides
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, flag_key)
);

-- ============================================
-- BETA TESTER TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS public.polybot_beta_testers (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    invited_by TEXT,
    beta_group TEXT DEFAULT 'general',  -- 'general', 'vip', 'early_access', etc.
    notes TEXT,
    features_enabled TEXT[],  -- Array of feature keys enabled for this beta tester
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN SETTINGS TABLE (for misc admin config)
-- ============================================
CREATE TABLE IF NOT EXISTS public.polybot_admin_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO public.polybot_admin_settings (setting_key, setting_value, description) VALUES
    ('rate_limits', '{"default_requests_per_minute": 60, "pro_requests_per_minute": 200, "elite_requests_per_minute": 1000}', 'API rate limits by tier'),
    ('trading_limits', '{"max_position_usd": 100, "max_daily_trades": 50, "cooldown_seconds": 300}', 'Default trading limits'),
    ('notification_settings', '{"email_enabled": true, "slack_enabled": false, "telegram_enabled": false}', 'Admin notification channels'),
    ('signup_settings', '{"require_email_verification": true, "default_trial_days": 7, "auto_simulation_mode": true}', 'New user signup settings')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.polybot_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polybot_user_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polybot_beta_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polybot_admin_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Feature flags: Anyone can read (for UI checks), only service role can modify
DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.polybot_feature_flags;
DROP POLICY IF EXISTS "Service role can manage feature flags" ON public.polybot_feature_flags;

CREATE POLICY "Anyone can read feature flags" ON public.polybot_feature_flags
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage feature flags" ON public.polybot_feature_flags
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- User overrides: Users can see their own, service role full access
DROP POLICY IF EXISTS "Users can view own overrides" ON public.polybot_user_feature_overrides;
DROP POLICY IF EXISTS "Service role can manage overrides" ON public.polybot_user_feature_overrides;

CREATE POLICY "Users can view own overrides" ON public.polybot_user_feature_overrides
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage overrides" ON public.polybot_user_feature_overrides
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Beta testers: Users can check if they're a tester, service role full access
DROP POLICY IF EXISTS "Users can view own beta status" ON public.polybot_beta_testers;
DROP POLICY IF EXISTS "Service role can manage beta testers" ON public.polybot_beta_testers;

CREATE POLICY "Users can view own beta status" ON public.polybot_beta_testers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage beta testers" ON public.polybot_beta_testers
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Admin settings: Only service role
DROP POLICY IF EXISTS "Service role can manage admin settings" ON public.polybot_admin_settings;

CREATE POLICY "Service role can manage admin settings" ON public.polybot_admin_settings
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT ON public.polybot_feature_flags TO authenticated, anon;
GRANT SELECT ON public.polybot_user_feature_overrides TO authenticated;
GRANT SELECT ON public.polybot_beta_testers TO authenticated;

-- ============================================
-- HELPER FUNCTION: Check if feature enabled for user
-- ============================================
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
    p_flag_key TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_global_enabled BOOLEAN;
    v_rollout_pct INTEGER;
    v_override_enabled BOOLEAN;
    v_override_expires TIMESTAMPTZ;
BEGIN
    -- Get global flag status
    SELECT enabled, rollout_percentage
    INTO v_global_enabled, v_rollout_pct
    FROM public.polybot_feature_flags
    WHERE flag_key = p_flag_key;
    
    IF NOT FOUND THEN
        RETURN false;  -- Unknown flag = disabled
    END IF;
    
    -- Check for user-specific override
    IF p_user_id IS NOT NULL THEN
        SELECT enabled, expires_at
        INTO v_override_enabled, v_override_expires
        FROM public.polybot_user_feature_overrides
        WHERE user_id = p_user_id AND flag_key = p_flag_key;
        
        IF FOUND THEN
            -- Check if override has expired
            IF v_override_expires IS NOT NULL AND v_override_expires < NOW() THEN
                -- Override expired, use global setting
                NULL;
            ELSE
                RETURN v_override_enabled;
            END IF;
        END IF;
    END IF;
    
    -- No override, check global + rollout
    IF NOT v_global_enabled THEN
        RETURN false;
    END IF;
    
    -- Rollout percentage check (deterministic based on user_id)
    IF v_rollout_pct < 100 AND p_user_id IS NOT NULL THEN
        -- Use hash of user_id for deterministic rollout
        IF (abs(hashtext(p_user_id::text)) % 100) >= v_rollout_pct THEN
            RETURN false;
        END IF;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Feature flags created:' as status, COUNT(*) as count FROM public.polybot_feature_flags;
SELECT 'Admin settings created:' as status, COUNT(*) as count FROM public.polybot_admin_settings;
