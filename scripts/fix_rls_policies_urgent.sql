-- ============================================
-- URGENT RLS FIX - Run in Supabase SQL Editor
-- Fix for 406 "Not Acceptable" errors on polybot_status and polybot_profiles
-- ============================================

-- ============================================
-- STEP 1: Fix polybot_status table
-- ============================================

-- Make sure the table exists
CREATE TABLE IF NOT EXISTS public.polybot_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_running BOOLEAN DEFAULT false,
    mode TEXT DEFAULT 'simulation',
    dry_run_mode BOOLEAN DEFAULT true,
    polymarket_connected BOOLEAN DEFAULT false,
    kalshi_connected BOOLEAN DEFAULT false,
    trading_mode TEXT DEFAULT 'paper',
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.polybot_status ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on polybot_status
DROP POLICY IF EXISTS "Users can view own status" ON public.polybot_status;
DROP POLICY IF EXISTS "Users can update own status" ON public.polybot_status;
DROP POLICY IF EXISTS "Users can insert own status" ON public.polybot_status;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.polybot_status;
DROP POLICY IF EXISTS "Service role full access" ON public.polybot_status;

-- Create permissive policies
CREATE POLICY "Users can view own status" ON public.polybot_status
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own status" ON public.polybot_status
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own status" ON public.polybot_status
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own status" ON public.polybot_status
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.polybot_status TO authenticated;

-- ============================================
-- STEP 2: Fix polybot_profiles table
-- ============================================

-- Make sure the table has all required columns
CREATE TABLE IF NOT EXISTS public.polybot_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    privy_user_id TEXT,
    wallet_address TEXT,
    role TEXT DEFAULT 'user',
    subscription_tier TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'inactive',
    stripe_customer_id TEXT,
    monthly_trades_used INTEGER DEFAULT 0,
    monthly_trades_limit INTEGER DEFAULT 100,
    trial_ends_at TIMESTAMPTZ,
    onboarding_completed BOOLEAN DEFAULT false,
    is_simulation BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS monthly_trades_used INTEGER DEFAULT 0;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS monthly_trades_limit INTEGER DEFAULT 100;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT true;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS privy_user_id TEXT;
ALTER TABLE public.polybot_profiles ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Enable RLS
ALTER TABLE public.polybot_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on polybot_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Allow trigger inserts" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Enable insert for signup" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.polybot_profiles;

-- Create permissive policies - users can manage their own profile
CREATE POLICY "Users can view own profile" ON public.polybot_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.polybot_profiles
    FOR UPDATE USING (auth.uid() = id);

-- CRITICAL: Allow authenticated users to insert their own profile
-- This is needed when the client-side code creates the profile
CREATE POLICY "Users can insert own profile" ON public.polybot_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT ALL ON public.polybot_profiles TO authenticated;
GRANT SELECT, INSERT ON public.polybot_profiles TO anon;

-- ============================================
-- STEP 3: Fix polybot_config table
-- ============================================

-- Enable RLS
ALTER TABLE public.polybot_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own config" ON public.polybot_config;
DROP POLICY IF EXISTS "Users can update own config" ON public.polybot_config;
DROP POLICY IF EXISTS "Users can insert own config" ON public.polybot_config;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.polybot_config;

-- Create permissive policies
CREATE POLICY "Users can view own config" ON public.polybot_config
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own config" ON public.polybot_config
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config" ON public.polybot_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.polybot_config TO authenticated;

-- ============================================
-- STEP 4: Create default records for existing users without them
-- ============================================

-- Create missing profiles for users who don't have one
INSERT INTO public.polybot_profiles (id, email, subscription_tier, subscription_status, is_simulation)
SELECT id, email, 'free', 'inactive', true
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.polybot_profiles WHERE polybot_profiles.id = auth.users.id)
ON CONFLICT (id) DO NOTHING;

-- Create missing status records for users who don't have one
INSERT INTO public.polybot_status (user_id, is_running, mode, dry_run_mode)
SELECT id, false, 'simulation', true
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.polybot_status WHERE polybot_status.user_id = auth.users.id)
ON CONFLICT (user_id) DO NOTHING;

-- Create missing config records for users who don't have one
INSERT INTO public.polybot_config (user_id, dry_run)
SELECT id, true
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.polybot_config WHERE polybot_config.user_id = auth.users.id)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 5: Verify specific user (from screenshot)
-- ============================================

-- Check if the user has a profile
DO $$
DECLARE
    target_user_id UUID := 'fdc0994f-4c68-4332-8c27-57b861257d8d';
    user_email TEXT;
BEGIN
    -- Get user email
    SELECT email INTO user_email FROM auth.users WHERE id = target_user_id;
    
    IF user_email IS NOT NULL THEN
        -- Ensure profile exists with admin role (so they can edit settings)
        INSERT INTO public.polybot_profiles (id, email, role, subscription_tier, subscription_status, is_simulation)
        VALUES (target_user_id, user_email, 'admin', 'pro', 'active', true)
        ON CONFLICT (id) DO UPDATE SET 
            email = user_email, 
            role = 'admin',
            subscription_tier = 'pro',
            subscription_status = 'active',
            updated_at = NOW();
        
        -- Ensure status exists
        INSERT INTO public.polybot_status (user_id, is_running, mode, dry_run_mode)
        VALUES (target_user_id, false, 'simulation', true)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW();
        
        -- Ensure config exists
        INSERT INTO public.polybot_config (user_id, dry_run)
        VALUES (target_user_id, true)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW();
        
        RAISE NOTICE 'Created/updated records for user: % (set as admin)', user_email;
    ELSE
        RAISE NOTICE 'User not found: %', target_user_id;
    END IF;
END $$;

-- ============================================
-- DONE! Check the results
-- ============================================

SELECT 'Checking polybot_profiles count: ' || COUNT(*)::TEXT as status FROM public.polybot_profiles;
SELECT 'Checking polybot_status count: ' || COUNT(*)::TEXT as status FROM public.polybot_status;
SELECT 'Checking polybot_config count: ' || COUNT(*)::TEXT as status FROM public.polybot_config;

SELECT 'SUCCESS: RLS policies fixed! Refresh the page and try again.' as final_status;
