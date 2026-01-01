-- ============================================
-- MIGRATE TO MULTI-TENANT SCHEMA
-- One-time migration to standardize all tables on user_id
-- ============================================

-- ============================================
-- STEP 1: Backup existing data (just in case)
-- ============================================
CREATE TABLE IF NOT EXISTS _backup_polybot_config AS 
SELECT * FROM public.polybot_config;

CREATE TABLE IF NOT EXISTS _backup_polybot_status AS 
SELECT * FROM public.polybot_status;

-- ============================================
-- STEP 2: Fix polybot_config - make user_id the primary identifier
-- ============================================

-- Add user_id column if it doesn't exist
ALTER TABLE public.polybot_config 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- If there's existing data with id=1 but no user_id, assign it to the admin user
UPDATE public.polybot_config 
SET user_id = 'fdc0994f-4c68-4332-8c27-57b861257d8d'
WHERE user_id IS NULL;

-- Drop the old id-based primary key constraint if it exists
-- and create unique constraint on user_id
DO $$
BEGIN
    -- Drop old primary key if it exists and is on 'id'
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'polybot_config' 
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name = 'polybot_config_pkey'
    ) THEN
        -- Check if primary key is on 'id' column (not user_id)
        IF EXISTS (
            SELECT 1 FROM information_schema.key_column_usage
            WHERE table_name = 'polybot_config'
            AND constraint_name = 'polybot_config_pkey'
            AND column_name = 'id'
        ) THEN
            ALTER TABLE public.polybot_config DROP CONSTRAINT polybot_config_pkey;
        END IF;
    END IF;
    
    -- Add unique constraint on user_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'polybot_config' 
        AND constraint_name = 'polybot_config_user_id_key'
    ) THEN
        ALTER TABLE public.polybot_config ADD CONSTRAINT polybot_config_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Make user_id NOT NULL (required for multi-tenant)
-- First delete any orphaned rows without user_id
DELETE FROM public.polybot_config WHERE user_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.polybot_config ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- STEP 3: Fix polybot_status - ensure user_id based
-- ============================================

-- Add user_id column if it doesn't exist
ALTER TABLE public.polybot_status 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrate existing rows to admin user if no user_id
UPDATE public.polybot_status 
SET user_id = 'fdc0994f-4c68-4332-8c27-57b861257d8d'
WHERE user_id IS NULL;

-- Add unique constraint on user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'polybot_status' 
        AND constraint_name = 'polybot_status_user_id_key'
    ) THEN
        ALTER TABLE public.polybot_status ADD CONSTRAINT polybot_status_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- ============================================
-- STEP 4: Ensure polybot_profiles exists with correct schema
-- ============================================

CREATE TABLE IF NOT EXISTS public.polybot_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    subscription_tier TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'inactive',
    stripe_customer_id TEXT,
    monthly_trades_used INTEGER DEFAULT 0,
    monthly_trades_limit INTEGER DEFAULT 100,
    trial_ends_at TIMESTAMPTZ,
    onboarding_completed BOOLEAN DEFAULT false,
    is_simulation BOOLEAN DEFAULT true,
    privy_user_id TEXT,
    wallet_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any missing columns
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS monthly_trades_used INTEGER DEFAULT 0;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS monthly_trades_limit INTEGER DEFAULT 100;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT true;

-- ============================================
-- STEP 5: Set up RLS policies (multi-tenant)
-- ============================================

-- polybot_config
ALTER TABLE public.polybot_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own config" ON public.polybot_config;
DROP POLICY IF EXISTS "Users can update own config" ON public.polybot_config;
DROP POLICY IF EXISTS "Users can insert own config" ON public.polybot_config;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.polybot_config;

CREATE POLICY "Users can view own config" ON public.polybot_config
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.polybot_config
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON public.polybot_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.polybot_config TO authenticated;

-- polybot_status
ALTER TABLE public.polybot_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own status" ON public.polybot_status;
DROP POLICY IF EXISTS "Users can update own status" ON public.polybot_status;
DROP POLICY IF EXISTS "Users can insert own status" ON public.polybot_status;
DROP POLICY IF EXISTS "Users can delete own status" ON public.polybot_status;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.polybot_status;

CREATE POLICY "Users can view own status" ON public.polybot_status
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own status" ON public.polybot_status
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own status" ON public.polybot_status
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own status" ON public.polybot_status
    FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.polybot_status TO authenticated;

-- polybot_profiles
ALTER TABLE public.polybot_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.polybot_profiles;

CREATE POLICY "Users can view own profile" ON public.polybot_profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.polybot_profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.polybot_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

GRANT ALL ON public.polybot_profiles TO authenticated;
GRANT SELECT, INSERT ON public.polybot_profiles TO anon;

-- ============================================
-- STEP 6: Create records for all existing users
-- ============================================

-- Profiles (keyed by user id directly)
INSERT INTO public.polybot_profiles (id, email, subscription_tier, subscription_status, is_simulation)
SELECT id, email, 'free', 'inactive', true
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.polybot_profiles WHERE polybot_profiles.id = auth.users.id)
ON CONFLICT (id) DO NOTHING;

-- Status (keyed by user_id)
INSERT INTO public.polybot_status (user_id, is_running)
SELECT id, false
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.polybot_status WHERE polybot_status.user_id = auth.users.id)
ON CONFLICT (user_id) DO NOTHING;

-- Config (keyed by user_id) - just insert user_id, other columns are dynamic
INSERT INTO public.polybot_config (user_id)
SELECT id
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.polybot_config WHERE polybot_config.user_id = auth.users.id)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 7: Set admin user to pro tier
-- ============================================

UPDATE public.polybot_profiles 
SET role = 'admin', 
    subscription_tier = 'pro', 
    subscription_status = 'active',
    updated_at = NOW()
WHERE id = 'fdc0994f-4c68-4332-8c27-57b861257d8d';

-- ============================================
-- DONE! Verify results
-- ============================================

SELECT 'polybot_profiles: ' || COUNT(*)::TEXT as count FROM public.polybot_profiles;
SELECT 'polybot_status: ' || COUNT(*)::TEXT as count FROM public.polybot_status;
SELECT 'polybot_config: ' || COUNT(*)::TEXT as count FROM public.polybot_config;

-- Show schema info to confirm multi-tenant structure
SELECT 'polybot_config schema:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'SUCCESS: Migrated to multi-tenant schema!' as final_status;
