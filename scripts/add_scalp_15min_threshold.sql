-- Add missing scalp_15min_entry_threshold column to polybot_config
-- This column was added to the frontend but never to the database schema
-- Run this in Supabase SQL Editor

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS scalp_15min_entry_threshold DECIMAL(5, 4) DEFAULT 0.45;

-- Verify it was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config'
AND column_name = 'scalp_15min_entry_threshold';
