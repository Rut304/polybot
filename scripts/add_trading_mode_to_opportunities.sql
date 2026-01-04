-- Add trading_mode column to polybot_opportunities table
-- This allows filtering opportunities by live vs paper mode

-- Add the column with a default of 'paper' (most opportunities are from paper trading)
ALTER TABLE polybot_opportunities 
ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'paper';

-- Create an index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_trading_mode 
ON polybot_opportunities(trading_mode);

-- Update existing rows: Set to 'paper' for all existing opportunities
-- (they were all generated during simulation mode)
UPDATE polybot_opportunities 
SET trading_mode = 'paper' 
WHERE trading_mode IS NULL;

-- Add a comment for documentation
COMMENT ON COLUMN polybot_opportunities.trading_mode IS 'Trading mode: paper (simulation) or live (real money)';
