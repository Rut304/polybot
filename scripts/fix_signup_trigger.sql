-- Fix Signup Trigger Issue
-- The current triggers for new user signup may be conflicting
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Check and fix existing triggers
-- ============================================

-- First, let's see what triggers exist on auth.users
-- SELECT tgname, tgrelid::regclass, tgenabled 
-- FROM pg_trigger 
-- WHERE tgrelid = 'auth.users'::regclass;

-- ============================================
-- STEP 2: Drop potentially conflicting triggers
-- ============================================

-- Drop the old user profile trigger (we'll recreate a better one)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================
-- STEP 3: Create a unified signup handler
-- This handles BOTH profile creation AND team creation
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    user_display_name TEXT;
    new_team_id UUID;
BEGIN
    -- Get display name from metadata or email
    user_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        split_part(NEW.email, '@', 1)
    );

    -- 1. Create user profile in polybot_profiles (main profile table)
    INSERT INTO public.polybot_profiles (
        id,
        email,
        subscription_tier,
        subscription_status,
        monthly_trades_used,
        monthly_trades_limit,
        onboarding_completed,
        is_simulation,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        'free',
        'inactive',
        0,
        100,  -- Free tier limit
        false,
        true, -- Start in simulation mode
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create user profile in polybot_user_profiles (legacy/role table) if it exists
    BEGIN
        INSERT INTO public.polybot_user_profiles (id, email, role)
        VALUES (NEW.id, NEW.email, 'viewer')
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist, skip
            NULL;
    END;

    -- 3. Create personal team
    BEGIN
        INSERT INTO public.polybot_teams (name, owner_id)
        VALUES (user_display_name || '''s Team', NEW.id)
        RETURNING id INTO new_team_id;

        -- Add user as owner of their team
        INSERT INTO public.polybot_team_members (team_id, user_id, role)
        VALUES (new_team_id, NEW.id, 'owner');
    EXCEPTION
        WHEN undefined_table THEN
            -- Teams table doesn't exist, skip
            NULL;
        WHEN others THEN
            -- Log error but don't fail signup
            RAISE WARNING 'Could not create team for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Create the unified trigger
-- ============================================

-- Remove any existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_team ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

-- Create single unified trigger
CREATE TRIGGER on_auth_user_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================
-- STEP 5: Ensure polybot_profiles table exists and has correct structure
-- ============================================

-- Create if not exists
CREATE TABLE IF NOT EXISTS public.polybot_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    privy_user_id TEXT,
    wallet_address TEXT,
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

-- Enable RLS
ALTER TABLE public.polybot_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.polybot_profiles;

-- Create policies
CREATE POLICY "Users can view own profile" ON public.polybot_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.polybot_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role full access profiles" ON public.polybot_profiles
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow inserts from trigger (runs as SECURITY DEFINER)
CREATE POLICY "Allow trigger inserts" ON public.polybot_profiles
    FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 6: Grant necessary permissions
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON public.polybot_profiles TO authenticated;
GRANT SELECT ON public.polybot_profiles TO anon;

-- ============================================
-- Done! Test signup should now work
-- ============================================

COMMIT;
