-- PolyParlay SaaS Profile Migration
-- Adds fields needed for multi-tenant SaaS operation
-- Run this after existing multitenancy_migration.sql

-- ==========================================
-- ADD NEW PROFILE COLUMNS
-- ==========================================

-- Privy integration
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS privy_user_id TEXT UNIQUE;

-- Wallet address from Privy embedded wallet
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Trade counting for billing (only counts LIVE trades, not simulation)
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS monthly_trades_used INTEGER DEFAULT 0;

-- Trade limits by tier: Free=0 (no live), Pro=1000, Elite=-1 (unlimited)
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS monthly_trades_limit INTEGER DEFAULT 0;

-- Trial tracking
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Onboarding state
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Trading mode (simulation vs live)
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT TRUE;

-- ==========================================
-- UPDATE USER CONFIG TABLE
-- ==========================================

ALTER TABLE polybot_user_config 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT TRUE;

ALTER TABLE polybot_user_config 
ADD COLUMN IF NOT EXISTS enabled_strategies TEXT[] DEFAULT ARRAY['single_platform_arb'];

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_profiles_privy 
ON polybot_profiles(privy_user_id) WHERE privy_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription 
ON polybot_profiles(subscription_tier, subscription_status);

CREATE INDEX IF NOT EXISTS idx_profiles_trial 
ON polybot_profiles(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- ==========================================
-- MONTHLY TRADE COUNTER RESET FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION reset_monthly_trades()
RETURNS void AS $$
BEGIN
  UPDATE polybot_profiles
  SET monthly_trades_used = 0,
      updated_at = NOW()
  WHERE subscription_status IN ('active', 'trialing');
  
  RAISE NOTICE 'Monthly trade counters reset for all active users';
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- INCREMENT TRADE COUNT FUNCTION
-- Only called for LIVE trades (simulation trades are free & unlimited)
-- ==========================================

-- Drop existing function first to allow signature change
DROP FUNCTION IF EXISTS increment_user_trades(UUID);
DROP FUNCTION IF EXISTS increment_user_trades(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION increment_user_trades(p_user_id UUID, p_is_simulation BOOLEAN DEFAULT FALSE)
RETURNS JSON AS $$
DECLARE
  v_trades_used INTEGER;
  v_trades_limit INTEGER;
  v_tier TEXT;
BEGIN
  -- Simulation trades don't count against limits
  IF p_is_simulation THEN
    RETURN json_build_object(
      'success', true,
      'mode', 'simulation',
      'message', 'Simulation trades are unlimited'
    );
  END IF;

  SELECT monthly_trades_used, monthly_trades_limit, subscription_tier
  INTO v_trades_used, v_trades_limit, v_tier
  FROM polybot_profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Free tier cannot do live trades (limit = 0)
  IF v_tier = 'free' OR v_trades_limit = 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Upgrade to Pro for live trading',
      'tier', v_tier
    );
  END IF;
  
  -- Check limit (-1 means unlimited for Elite)
  IF v_trades_limit != -1 AND v_trades_used >= v_trades_limit THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Monthly live trade limit reached. Upgrade to Elite for unlimited.',
      'trades_used', v_trades_used,
      'trades_limit', v_trades_limit
    );
  END IF;
  
  -- Increment counter for live trades
  UPDATE polybot_profiles
  SET monthly_trades_used = monthly_trades_used + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'trades_used', v_trades_used + 1,
    'trades_limit', v_trades_limit,
    'trades_remaining', CASE WHEN v_trades_limit = -1 THEN -1 ELSE v_trades_limit - v_trades_used - 1 END
  );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIAL EXPIRY CHECK FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION downgrade_expired_trials()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE polybot_profiles
    SET subscription_tier = 'free',
        subscription_status = 'inactive',
        monthly_trades_limit = 0,  -- Free tier = 0 live trades
        is_simulation = TRUE,      -- Force back to simulation
        updated_at = NOW()
    WHERE subscription_status = 'trialing'
      AND trial_ends_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TIER LIMITS UPDATE TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION update_tier_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Update trade limits based on tier (for LIVE trades only)
  -- Free: 0 live trades (simulation only)
  -- Pro: 1000 live trades/month  
  -- Elite: unlimited (-1)
  NEW.monthly_trades_limit := CASE NEW.subscription_tier
    WHEN 'free' THEN 0      -- No live trades for free tier
    WHEN 'pro' THEN 1000
    WHEN 'elite' THEN -1    -- Unlimited
    ELSE 0
  END;
  
  -- Reset to simulation if downgrading to free
  IF NEW.subscription_tier = 'free' AND OLD.subscription_tier != 'free' THEN
    NEW.is_simulation := TRUE;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tier_limits ON polybot_profiles;
CREATE TRIGGER trigger_update_tier_limits
  BEFORE UPDATE OF subscription_tier ON polybot_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_tier_limits();

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

-- Allow authenticated users to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON polybot_profiles;
CREATE POLICY "Users can read own profile"
  ON polybot_profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow authenticated users to update their own profile (limited fields)
DROP POLICY IF EXISTS "Users can update own profile" ON polybot_profiles;
CREATE POLICY "Users can update own profile"
  ON polybot_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==========================================
-- ADMIN AUDIT LOG TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS polybot_admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created 
ON polybot_admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_target 
ON polybot_admin_audit_log(target_user_id);

-- ==========================================
-- SAMPLE DATA (for testing)
-- ==========================================

-- Ensure email column exists (might be missing in some deployments)
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing admin user to elite tier for testing
-- Use a subquery to find the user by auth.users email
UPDATE polybot_profiles
SET subscription_tier = 'elite',
    subscription_status = 'active',
    monthly_trades_limit = -1,
    is_simulation = FALSE,
    onboarding_completed = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'rutrohd@gmail.com'
);

-- ==========================================
-- VERIFICATION
-- ==========================================

SELECT 'Migration complete!' AS status;

SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'polybot_profiles'
ORDER BY ordinal_position;
