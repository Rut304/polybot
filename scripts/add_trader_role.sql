-- Add 'trader' role to polybot_user_profiles
-- Run this migration to support the new Trader role

-- Drop existing constraint
ALTER TABLE polybot_user_profiles DROP CONSTRAINT IF EXISTS polybot_user_profiles_role_check;

-- Add new constraint that includes 'trader'
ALTER TABLE polybot_user_profiles 
ADD CONSTRAINT polybot_user_profiles_role_check 
CHECK (role IN ('admin', 'trader', 'viewer'));

-- Update any legacy 'user' roles to 'trader' (if any exist)
UPDATE polybot_user_profiles SET role = 'trader' WHERE role = 'user';

-- Verify the change
SELECT DISTINCT role FROM polybot_user_profiles;
