-- Add Robinhood and Webull platform enable columns to polybot_config
-- Run this in Supabase SQL Editor

-- Platform enable flags
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_robinhood BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_webull BOOLEAN DEFAULT false;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
AND column_name IN ('enable_robinhood', 'enable_webull')
ORDER BY column_name;
