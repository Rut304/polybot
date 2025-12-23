-- PolyBot Multitenancy Database Migration
-- Creates enhanced user profiles, per-user secrets, and per-user config tables
-- 
-- Run this in Supabase SQL Editor
-- Note: Run each section separately if you encounter errors

-- ============================================================
-- 1. Enhanced User Profiles
-- ============================================================

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Users can view own profile" ON polybot_user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON polybot_user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON polybot_user_profiles;

CREATE TABLE IF NOT EXISTS polybot_user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    
    -- Subscription/Billing
    subscription_tier TEXT DEFAULT 'free' 
        CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
    subscription_expires_at TIMESTAMPTZ,
    monthly_trade_limit INT DEFAULT 100,
    trades_this_month INT DEFAULT 0,
    trades_month_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),
    
    -- Trading Limits (overrides for subscription tier defaults)
    max_trade_size_usd DECIMAL(10, 2) DEFAULT 50.00,
    max_daily_loss_usd DECIMAL(10, 2) DEFAULT 100.00,
    max_positions INT DEFAULT 5,
    max_daily_trades INT DEFAULT 50,
    
    -- Feature Flags (per-user overrides)
    features_enabled JSONB DEFAULT '{
        "copy_trading": false,
        "news_arbitrage": true,
        "cross_platform": false,
        "single_platform": true,
        "overlapping_arb": false,
        "live_trading": false
    }'::jsonb,
    
    -- Notification Preferences
    notification_prefs JSONB DEFAULT '{
        "email": true,
        "discord": false,
        "telegram": false,
        "on_trade": true,
        "on_opportunity": false,
        "daily_summary": true
    }'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    
    -- Onboarding
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INT DEFAULT 0,
    accepted_terms_at TIMESTAMPTZ,
    
    -- Referral/Attribution
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES polybot_user_profiles(id)
);

-- Add columns if table already exists (for upgrades)
DO $$
BEGIN
    -- Add subscription_tier if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    END IF;
    
    -- Add monthly_trade_limit if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'monthly_trade_limit'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN monthly_trade_limit INT DEFAULT 100;
    END IF;
    
    -- Add trades_this_month if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'trades_this_month'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN trades_this_month INT DEFAULT 0;
    END IF;
    
    -- Add trades_month_reset_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'trades_month_reset_at'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN trades_month_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    END IF;
    
    -- Add features_enabled if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'features_enabled'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN features_enabled JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add last_active_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'last_active_at'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN last_active_at TIMESTAMPTZ;
    END IF;
    
    -- Add onboarding_completed if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add referral_code if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_user_profiles' AND column_name = 'referral_code'
    ) THEN
        ALTER TABLE polybot_user_profiles ADD COLUMN referral_code TEXT UNIQUE;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier 
    ON polybot_user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active 
    ON polybot_user_profiles(last_active_at DESC);

-- RLS
ALTER TABLE polybot_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON polybot_user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON polybot_user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON polybot_user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Grant service role full access
GRANT ALL ON polybot_user_profiles TO service_role;


-- ============================================================
-- 2. Per-User Secrets (API Keys)
-- ============================================================

-- Create table first, then handle policies
CREATE TABLE IF NOT EXISTS polybot_user_secrets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL 
        CHECK (platform IN ('polymarket', 'kalshi', 'alpaca', 'ibkr', 'binance', 'coinbase')),
    
    -- Encrypted key storage
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    private_key_encrypted TEXT,
    wallet_address TEXT,
    
    -- Additional platform-specific config
    additional_config JSONB DEFAULT '{}'::jsonb,
    
    -- Key metadata
    is_paper BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    label TEXT,
    
    -- Validation
    last_validated_at TIMESTAMPTZ,
    validation_status TEXT DEFAULT 'pending'
        CHECK (validation_status IN ('pending', 'valid', 'invalid', 'expired')),
    validation_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, platform, is_paper)
);

-- Now drop existing policy if exists (table exists now)
DROP POLICY IF EXISTS "Users can manage own secrets" ON polybot_user_secrets;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_secrets_user 
    ON polybot_user_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_secrets_platform 
    ON polybot_user_secrets(platform);
CREATE INDEX IF NOT EXISTS idx_user_secrets_active 
    ON polybot_user_secrets(user_id, is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE polybot_user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own secrets"
    ON polybot_user_secrets FOR ALL
    USING (auth.uid() = user_id);

-- Grant service role full access
GRANT ALL ON polybot_user_secrets TO service_role;
GRANT USAGE, SELECT ON SEQUENCE polybot_user_secrets_id_seq TO service_role;


-- ============================================================
-- 3. Per-User Configuration
-- ============================================================

-- Create table first
CREATE TABLE IF NOT EXISTS polybot_user_config (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Core Trading Config
    dry_run BOOLEAN DEFAULT TRUE,
    simulation_starting_balance DECIMAL(12, 2) DEFAULT 10000.00,
    
    -- Profit/Loss Thresholds
    min_profit_pct DECIMAL(8, 4) DEFAULT 1.0,
    max_trade_size_usd DECIMAL(10, 2) DEFAULT 50.00,
    max_daily_loss_usd DECIMAL(10, 2) DEFAULT 100.00,
    max_loss_per_trade_pct DECIMAL(8, 4) DEFAULT 10.0,
    
    -- Position Management
    max_open_positions INT DEFAULT 5,
    position_timeout_hours INT DEFAULT 72,
    auto_close_losing_positions BOOLEAN DEFAULT FALSE,
    
    -- Strategy Toggles
    enable_copy_trading BOOLEAN DEFAULT FALSE,
    enable_single_platform_arb BOOLEAN DEFAULT TRUE,
    enable_cross_platform_arb BOOLEAN DEFAULT FALSE,
    enable_overlapping_arb BOOLEAN DEFAULT FALSE,
    enable_news_arbitrage BOOLEAN DEFAULT TRUE,
    enable_market_making BOOLEAN DEFAULT FALSE,
    
    -- Platform Toggles
    enable_polymarket BOOLEAN DEFAULT TRUE,
    enable_kalshi BOOLEAN DEFAULT TRUE,
    enable_alpaca BOOLEAN DEFAULT FALSE,
    enable_ibkr BOOLEAN DEFAULT FALSE,
    enable_crypto_exchanges BOOLEAN DEFAULT FALSE,
    
    -- Risk Settings
    circuit_breaker_enabled BOOLEAN DEFAULT TRUE,
    circuit_breaker_daily_loss DECIMAL(10, 2) DEFAULT 500.00,
    circuit_breaker_hourly_trades INT DEFAULT 20,
    require_manual_approval BOOLEAN DEFAULT FALSE,
    approval_threshold_usd DECIMAL(10, 2) DEFAULT 100.00,
    
    -- Schedule
    trading_hours_enabled BOOLEAN DEFAULT FALSE,
    trading_hours_start TIME DEFAULT '09:00',
    trading_hours_end TIME DEFAULT '17:00',
    trading_days JSONB DEFAULT '["mon", "tue", "wed", "thu", "fri"]'::jsonb,
    trading_timezone TEXT DEFAULT 'America/New_York',
    
    -- Advanced
    advanced_config JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now drop existing policy if exists (table exists now)
DROP POLICY IF EXISTS "Users can manage own config" ON polybot_user_config;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_config_user 
    ON polybot_user_config(user_id);

-- RLS
ALTER TABLE polybot_user_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own config"
    ON polybot_user_config FOR ALL
    USING (auth.uid() = user_id);

-- Grant service role full access
GRANT ALL ON polybot_user_config TO service_role;
GRANT USAGE, SELECT ON SEQUENCE polybot_user_config_id_seq TO service_role;


-- ============================================================
-- 4. Helper Functions
-- ============================================================

-- Function to increment trade count and check limits
CREATE OR REPLACE FUNCTION increment_user_trades(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_trades_this_month INT;
    v_monthly_limit INT;
    v_reset_at TIMESTAMPTZ;
    v_at_limit BOOLEAN;
BEGIN
    -- Get current values
    SELECT 
        COALESCE(trades_this_month, 0),
        COALESCE(monthly_trade_limit, 100),
        trades_month_reset_at
    INTO v_trades_this_month, v_monthly_limit, v_reset_at
    FROM polybot_user_profiles 
    WHERE id = p_user_id;
    
    -- Check if profile exists
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Profile not found'
        );
    END IF;
    
    -- Check if we need to reset monthly counter
    IF v_reset_at IS NULL OR v_reset_at <= NOW() THEN
        UPDATE polybot_user_profiles SET
            trades_this_month = 1,
            trades_month_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month'),
            updated_at = NOW()
        WHERE id = p_user_id;
        
        RETURN jsonb_build_object(
            'success', TRUE,
            'trades_this_month', 1,
            'monthly_limit', v_monthly_limit,
            'at_limit', FALSE,
            'month_reset', TRUE
        );
    END IF;
    
    -- Check if at limit
    v_at_limit := v_trades_this_month >= v_monthly_limit;
    
    IF v_at_limit THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Monthly trade limit reached',
            'trades_this_month', v_trades_this_month,
            'monthly_limit', v_monthly_limit,
            'at_limit', TRUE
        );
    END IF;
    
    -- Increment counter
    UPDATE polybot_user_profiles SET
        trades_this_month = trades_this_month + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'trades_this_month', v_trades_this_month + 1,
        'monthly_limit', v_monthly_limit,
        'at_limit', (v_trades_this_month + 1) >= v_monthly_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to create user profile on signup (if not using existing trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO polybot_user_profiles (id, email, display_name)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Also create default config
    INSERT INTO polybot_user_config (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- Function to get subscription tier limits
CREATE OR REPLACE FUNCTION get_tier_limits(p_tier TEXT)
RETURNS JSONB AS $$
BEGIN
    CASE p_tier
        WHEN 'free' THEN
            RETURN jsonb_build_object(
                'monthly_trades', 100,
                'max_trade_size', 50,
                'max_daily_loss', 100,
                'features', ARRAY['single_platform', 'news_arbitrage']
            );
        WHEN 'basic' THEN
            RETURN jsonb_build_object(
                'monthly_trades', 500,
                'max_trade_size', 200,
                'max_daily_loss', 500,
                'features', ARRAY['single_platform', 'news_arbitrage', 'cross_platform']
            );
        WHEN 'pro' THEN
            RETURN jsonb_build_object(
                'monthly_trades', 2000,
                'max_trade_size', 1000,
                'max_daily_loss', 2000,
                'features', ARRAY['single_platform', 'news_arbitrage', 'cross_platform', 'overlapping_arb', 'copy_trading']
            );
        WHEN 'enterprise' THEN
            RETURN jsonb_build_object(
                'monthly_trades', -1,
                'max_trade_size', 10000,
                'max_daily_loss', 10000,
                'features', ARRAY['all']
            );
        ELSE
            RETURN get_tier_limits('free');
    END CASE;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 5. Audit Trail for Config Changes
-- ============================================================

-- Create table first, then drop existing policy
CREATE TABLE IF NOT EXISTS polybot_config_audit (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT
);

-- Now safe to drop policy (table exists)
DROP POLICY IF EXISTS "Users can view own audit logs" ON polybot_config_audit;

CREATE INDEX IF NOT EXISTS idx_config_audit_user 
    ON polybot_config_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_config_audit_time 
    ON polybot_config_audit(changed_at DESC);

-- RLS
ALTER TABLE polybot_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
    ON polybot_config_audit FOR SELECT
    USING (auth.uid() = user_id);

GRANT ALL ON polybot_config_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE polybot_config_audit_id_seq TO service_role;


-- ============================================================
-- 6. Comments
-- ============================================================

COMMENT ON TABLE polybot_user_profiles IS 
    'Extended user profiles with subscription and trading limits';
COMMENT ON TABLE polybot_user_secrets IS 
    'Per-user API keys and secrets (encrypted)';
COMMENT ON TABLE polybot_user_config IS 
    'Per-user trading configuration';
COMMENT ON TABLE polybot_config_audit IS 
    'Audit trail for configuration changes';

COMMENT ON FUNCTION increment_user_trades IS 
    'Increments trade count and checks subscription limits';
COMMENT ON FUNCTION handle_new_user IS 
    'Auto-creates profile and default config on user signup';
COMMENT ON FUNCTION get_tier_limits IS 
    'Returns default limits for a subscription tier';
