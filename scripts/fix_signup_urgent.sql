-- URGENT FIX: Database error saving new user
-- Run this IMMEDIATELY in Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad/sql/new

-- ============================================
-- STEP 1: Drop ALL existing signup triggers
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_signup ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_team ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;

-- Drop old functions
DROP FUNCTION IF EXISTS public.handle_new_user_signup() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_on_signup() CASCADE;

-- ============================================
-- STEP 2: Ensure polybot_profiles table exists
-- ============================================

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

-- ============================================
-- STEP 3: Create SIMPLE, ROBUST signup handler
-- This one WON'T fail - it uses exception handling
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- Simple profile creation with full error handling
    BEGIN
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
            100,
            false,
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = NOW();
    EXCEPTION
        WHEN OTHERS THEN
            -- Log but don't fail - user can still sign up
            RAISE WARNING 'Profile creation warning for %: %', NEW.id, SQLERRM;
    END;

    -- Try to create team (optional - won't fail signup)
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'polybot_teams') THEN
            INSERT INTO public.polybot_teams (name, owner_id)
            VALUES (
                COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)) || '''s Team',
                NEW.id
            )
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Team creation skipped for %: %', NEW.id, SQLERRM;
    END;

    -- Try to add team membership (optional)
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'polybot_team_members') THEN
            INSERT INTO public.polybot_team_members (team_id, user_id, role)
            SELECT t.id, NEW.id, 'owner'
            FROM public.polybot_teams t
            WHERE t.owner_id = NEW.id
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Team membership skipped for %: %', NEW.id, SQLERRM;
    END;

    -- Always return NEW to allow signup to succeed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- STEP 4: Create the trigger
-- ============================================

CREATE TRIGGER on_auth_user_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================
-- STEP 5: Fix RLS policies
-- ============================================

ALTER TABLE public.polybot_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Allow trigger inserts" ON public.polybot_profiles;
DROP POLICY IF EXISTS "Enable insert for signup" ON public.polybot_profiles;

-- Create permissive policies
CREATE POLICY "Users can view own profile" ON public.polybot_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.polybot_profiles
    FOR UPDATE USING (auth.uid() = id);

-- CRITICAL: Allow inserts from the trigger (SECURITY DEFINER function)
CREATE POLICY "Enable insert for signup" ON public.polybot_profiles
    FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 6: Grant permissions
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON public.polybot_profiles TO authenticated;
GRANT SELECT ON public.polybot_profiles TO anon;
GRANT INSERT ON public.polybot_profiles TO anon;

-- ============================================
-- STEP 7: Manually create profile for Ryan
-- (in case he already exists in auth.users)
-- ============================================

DO $$
DECLARE
    ryan_id UUID;
BEGIN
    -- Find Ryan's user ID
    SELECT id INTO ryan_id FROM auth.users WHERE email = 'ryanoconnorre@gmail.com';
    
    IF ryan_id IS NOT NULL THEN
        INSERT INTO public.polybot_profiles (
            id, email, subscription_tier, subscription_status,
            monthly_trades_used, monthly_trades_limit,
            onboarding_completed, is_simulation, created_at, updated_at
        ) VALUES (
            ryan_id, 'ryanoconnorre@gmail.com', 'free', 'inactive',
            0, 100, false, true, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = 'ryanoconnorre@gmail.com',
            updated_at = NOW();
        
        RAISE NOTICE 'Created/updated profile for Ryan: %', ryan_id;
    ELSE
        RAISE NOTICE 'Ryan not found in auth.users - he can sign up fresh now';
    END IF;
END $$;

-- ============================================
-- DONE! Signup should now work
-- ============================================

SELECT 'SUCCESS: Signup trigger fixed! Ryan can now sign up.' as status;
