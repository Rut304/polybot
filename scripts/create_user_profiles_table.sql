-- Run this in the Supabase SQL Editor to create the user profiles table
-- This table stores user roles for authentication

-- Drop if exists (for clean re-creation)
DROP TABLE IF EXISTS polybot_user_profiles CASCADE;

-- User profiles table for role-based access
CREATE TABLE polybot_user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE polybot_user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
    ON polybot_user_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Allow admins to read all profiles  
CREATE POLICY "Admins can read all profiles"
    ON polybot_user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM polybot_user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can modify profiles
CREATE POLICY "Admins can update profiles"
    ON polybot_user_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM polybot_user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.polybot_user_profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'viewer');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- IMPORTANT: After running this SQL, go to Supabase Dashboard:
-- 1. Authentication > Users > Add User
-- 2. Create your admin user with email/password
-- 3. Then run this to make them admin:
--    UPDATE polybot_user_profiles SET role = 'admin' WHERE email = 'your-email@example.com';
-- ============================================
