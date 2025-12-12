-- Add skip_same_platform_overlap config to enable overlapping arbitrage trades
-- December 12, 2025

-- Add the column
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS skip_same_platform_overlap BOOLEAN DEFAULT false;

-- Set to FALSE to ENABLE overlapping arbitrage (same-platform correlation trades)
-- Note: Setting to FALSE means we ALLOW these trades
UPDATE polybot_config SET skip_same_platform_overlap = false WHERE id = 1;

-- Log the change
INSERT INTO polybot_config_history (change_type, parameter_name, old_value, new_value, reason, changed_by)
VALUES 
    ('manual', 'skip_same_platform_overlap', 'true (hardcoded)', 'false', 'Enable overlapping arb - same-platform correlation trades now allowed', 'admin');

SELECT 'Added skip_same_platform_overlap = false (overlapping arb ENABLED)' as status;
