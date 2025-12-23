-- Add executed_at column to polybot_opportunities table
-- This column is needed for tracking when opportunities were executed
-- Run this in Supabase SQL Editor

-- Check if column exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_opportunities' 
        AND column_name = 'executed_at'
    ) THEN
        ALTER TABLE polybot_opportunities 
        ADD COLUMN executed_at TIMESTAMPTZ DEFAULT NULL;
        
        COMMENT ON COLUMN polybot_opportunities.executed_at IS 'Timestamp when the opportunity was executed';
        
        RAISE NOTICE 'Column executed_at added successfully';
    ELSE
        RAISE NOTICE 'Column executed_at already exists';
    END IF;
END $$;

-- Create index for executed_at queries
CREATE INDEX IF NOT EXISTS idx_polybot_opportunities_executed_at 
ON polybot_opportunities(executed_at) 
WHERE executed_at IS NOT NULL;
