-- Fix all missing columns and add standard user role
-- Run this in Supabase SQL Editor
-- December 29, 2025

-- ============================================
-- FIX polybot_profiles TABLE - Add missing columns
-- ============================================

ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS custom_price NUMERIC;
ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS discount_percent INTEGER;
ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- ============================================
-- FIX polybot_user_profiles TABLE - Add 'user' role option
-- ============================================

-- The role column likely has a check constraint limiting values
-- First, let's see what constraints exist and update them

-- Drop existing constraint if it exists
DO $$
BEGIN
    ALTER TABLE polybot_user_profiles DROP CONSTRAINT IF EXISTS polybot_user_profiles_role_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with 'user' as an option
ALTER TABLE polybot_user_profiles 
ADD CONSTRAINT polybot_user_profiles_role_check 
CHECK (role IN ('admin', 'user', 'viewer', 'read_only', 'readonly'));

-- ============================================
-- FIX polybot_secrets TABLE - Add encryption support columns
-- ============================================

ALTER TABLE polybot_secrets ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT false;
ALTER TABLE polybot_secrets ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 0;

-- ============================================
-- VERIFY ALL COLUMNS
-- ============================================

SELECT 'polybot_profiles' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_profiles'
AND column_name IN ('custom_price', 'discount_percent', 'admin_notes')

UNION ALL

SELECT 'polybot_user_profiles' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_user_profiles'
AND column_name = 'role'

UNION ALL

SELECT 'polybot_secrets' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_secrets'
AND column_name IN ('encrypted', 'encryption_version');

-- Show constraint info
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'polybot_user_profiles'::regclass;
