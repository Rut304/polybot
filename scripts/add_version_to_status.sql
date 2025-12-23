-- Add version column to polybot_status table
-- This allows the dashboard to display the running bot version
-- Note: polybot_status.id is UUID type, not integer

-- 1. Add version column if it doesn't exist
ALTER TABLE polybot_status 
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'unknown';

-- 2. Update all rows with current version (will be overwritten when bot starts)
-- Using updated_at column which already exists (not last_updated)
UPDATE polybot_status 
SET version = '1.1.25', 
    updated_at = NOW();

-- 3. Create index on updated_at for efficient queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_polybot_status_updated 
ON polybot_status(updated_at DESC);

SELECT 'Version column added to polybot_status!' as status;
