-- Add 'trader' role to polybot_user_profiles
-- Run this migration to support the new Trader role

-- First, see what roles currently exist
SELECT DISTINCT role, COUNT(*) FROM polybot_user_profiles GROUP BY role;

-- Normalize existing roles BEFORE dropping the constraint
-- Map any non-standard roles to valid ones:
-- 'user' -> 'trader' (standard users who can trade)
-- 'read_only', 'readonly' -> 'viewer'
-- NULL -> 'viewer'
UPDATE polybot_user_profiles SET role = 'trader' WHERE role = 'user';
UPDATE polybot_user_profiles SET role = 'viewer' WHERE role IN ('read_only', 'readonly');
UPDATE polybot_user_profiles SET role = 'viewer' WHERE role IS NULL;

-- Now drop existing constraint
ALTER TABLE polybot_user_profiles DROP CONSTRAINT IF EXISTS polybot_user_profiles_role_check;

-- Add new constraint that includes 'trader'
ALTER TABLE polybot_user_profiles 
ADD CONSTRAINT polybot_user_profiles_role_check 
CHECK (role IN ('admin', 'trader', 'viewer'));

-- Verify the change
SELECT DISTINCT role, COUNT(*) FROM polybot_user_profiles GROUP BY role;
