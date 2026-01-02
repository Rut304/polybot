-- ============================================================================
-- ADD PLATFORM COLUMNS TO SIMULATED TRADES
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add buy_platform and sell_platform columns to polybot_simulated_trades
-- These are used by the bot when recording arbitrage trades

ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS buy_platform TEXT;

ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS sell_platform TEXT;

-- Add platform column (single platform trades)
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add arbitrage_type for tracking strategy type
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS arbitrage_type TEXT;

-- Add strategy_type for more detailed categorization  
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS strategy_type TEXT;

-- Add trading_mode (paper vs live)
ALTER TABLE polybot_simulated_trades 
ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'paper';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_simulated_trades_buy_platform 
    ON polybot_simulated_trades(buy_platform);
CREATE INDEX IF NOT EXISTS idx_simulated_trades_sell_platform 
    ON polybot_simulated_trades(sell_platform);
CREATE INDEX IF NOT EXISTS idx_simulated_trades_platform 
    ON polybot_simulated_trades(platform);
CREATE INDEX IF NOT EXISTS idx_simulated_trades_arbitrage_type 
    ON polybot_simulated_trades(arbitrage_type);

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'polybot_simulated_trades' 
  AND column_name IN ('buy_platform', 'sell_platform', 'platform', 'arbitrage_type', 'strategy_type', 'trading_mode')
ORDER BY column_name;
