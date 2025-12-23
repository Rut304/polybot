-- Add version column to polybot_status table
-- This allows the dashboard to display the running bot version

-- 1. Add version column if it doesn't exist
ALTER TABLE polybot_status 
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'unknown';

-- 2. Add last_updated column if it doesn't exist (for sorting)
ALTER TABLE polybot_status 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Update the default row with current version (will be overwritten when bot starts)
UPDATE polybot_status 
SET version = '1.1.25', 
    last_updated = NOW()
WHERE id = 1;

-- 4. Create index on last_updated for efficient queries
CREATE INDEX IF NOT EXISTS idx_polybot_status_updated 
ON polybot_status(last_updated DESC);

SELECT 'Version column added to polybot_status!' as status;
