-- ============================================
-- BACKFILL EXISTING USERS FOR MULTI-TENANCY
-- December 28, 2025
-- ============================================
-- This script backfills teams, configs, and profiles for existing users
-- who signed up before the team system was added.

-- ============================================
-- STEP 1: Create Personal Teams for Existing Users
-- ============================================

-- Create teams for users who don't have one yet
INSERT INTO polybot_teams (name, owner_id)
SELECT 
    COALESCE(
        (SELECT display_name FROM polybot_user_profiles WHERE id = u.id),
        split_part(u.email, '@', 1)
    ) || '''s Team',
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM polybot_teams t WHERE t.owner_id = u.id
);

-- Add users as owners of their teams
INSERT INTO polybot_team_members (team_id, user_id, role)
SELECT t.id, t.owner_id, 'owner'
FROM polybot_teams t
WHERE NOT EXISTS (
    SELECT 1 FROM polybot_team_members tm 
    WHERE tm.team_id = t.id AND tm.user_id = t.owner_id
);

-- ============================================
-- STEP 2: Create Missing polybot_profiles
-- ============================================

-- Ensure all auth users have a polybot_profiles entry
INSERT INTO polybot_profiles (id, email, subscription_tier, subscription_status)
SELECT 
    u.id,
    u.email,
    COALESCE(up.subscription_tier, 'free'),
    'active'
FROM auth.users u
LEFT JOIN polybot_user_profiles up ON u.id = up.id
WHERE NOT EXISTS (
    SELECT 1 FROM polybot_profiles p WHERE p.id = u.id
);

-- ============================================
-- STEP 3: Create Missing polybot_config Entries
-- ============================================

-- Ensure all auth users have a config entry
INSERT INTO polybot_config (user_id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM polybot_config c WHERE c.user_id = u.id
);

-- ============================================
-- STEP 4: Create Missing polybot_status Entries
-- ============================================

-- Ensure all auth users have a status entry
INSERT INTO polybot_status (user_id, is_running)
SELECT u.id, false
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM polybot_status s WHERE s.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 5: Fix polybot_trades user_id column
-- ============================================

-- Add user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_trades' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_trades 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_id column to polybot_trades';
    END IF;
END $$;

-- Assign existing trades to rutrohd (the admin)
UPDATE polybot_trades 
SET user_id = 'b2629537-3a31-4fa1-b05a-a9d523a008aa'
WHERE user_id IS NULL;

-- ============================================
-- STEP 6: Fix polybot_opportunities user_id column
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_opportunities' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_opportunities 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_id column to polybot_opportunities';
    END IF;
END $$;

UPDATE polybot_opportunities 
SET user_id = 'b2629537-3a31-4fa1-b05a-a9d523a008aa'
WHERE user_id IS NULL;

-- ============================================
-- STEP 7: Create polybot_key_vault if missing
-- ============================================

CREATE TABLE IF NOT EXISTS polybot_key_vault (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    key_id UUID DEFAULT gen_random_uuid(),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key_name)
);

-- Enable RLS
ALTER TABLE polybot_key_vault ENABLE ROW LEVEL SECURITY;

-- RLS Policies for key_vault
DROP POLICY IF EXISTS "Users can view own keys" ON polybot_key_vault;
CREATE POLICY "Users can view own keys" ON polybot_key_vault 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own keys" ON polybot_key_vault;
CREATE POLICY "Users can insert own keys" ON polybot_key_vault 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own keys" ON polybot_key_vault;
CREATE POLICY "Users can update own keys" ON polybot_key_vault 
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own keys" ON polybot_key_vault;
CREATE POLICY "Users can delete own keys" ON polybot_key_vault 
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role keys access" ON polybot_key_vault;
CREATE POLICY "Service role keys access" ON polybot_key_vault 
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STEP 8: Migrate existing API keys to rutrohd's vault
-- ============================================

-- This migrates any loose API keys from polybot_secrets to the key_vault
-- First check if polybot_secrets exists and has data
DO $$
DECLARE
    v_user_id UUID := 'b2629537-3a31-4fa1-b05a-a9d523a008aa'; -- rutrohd
BEGIN
    -- Check if polybot_secrets table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'polybot_secrets') THEN
        -- Migrate each secret that isn't already in the vault
        INSERT INTO polybot_key_vault (user_id, key_name, encrypted_value, description)
        SELECT 
            v_user_id,
            key_name,
            encrypted_value,
            'Migrated from polybot_secrets'
        FROM polybot_secrets
        WHERE NOT EXISTS (
            SELECT 1 FROM polybot_key_vault 
            WHERE user_id = v_user_id AND key_name = polybot_secrets.key_name
        )
        ON CONFLICT (user_id, key_name) DO NOTHING;
        
        RAISE NOTICE 'Migrated secrets to key_vault for rutrohd';
    END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Teams created:' as check_type, COUNT(*) as count FROM polybot_teams;
SELECT 'Team members:' as check_type, COUNT(*) as count FROM polybot_team_members;
SELECT 'Profiles:' as check_type, COUNT(*) as count FROM polybot_profiles;
SELECT 'User profiles:' as check_type, COUNT(*) as count FROM polybot_user_profiles;
SELECT 'Configs:' as check_type, COUNT(*) as count FROM polybot_config;

SELECT '✅ Multi-tenancy backfill complete!' as status;
