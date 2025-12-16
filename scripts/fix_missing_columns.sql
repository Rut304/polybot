-- Fix missing columns in polybot_config
-- Run this in Supabase SQL Editor

-- 1. Enable IBKR toggle
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_ibkr BOOLEAN DEFAULT FALSE;

-- 2. IBKR Starting Balance (re-run safe)
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS ibkr_starting_balance NUMERIC DEFAULT 20000;

-- 3. Ensure other exchange toggles exist (safety check)
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_binance BOOLEAN DEFAULT FALSE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_alpaca BOOLEAN DEFAULT FALSE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_coinbase BOOLEAN DEFAULT FALSE;

-- 4. Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
AND column_name IN ('enable_ibkr', 'ibkr_starting_balance', 'enable_binance');
