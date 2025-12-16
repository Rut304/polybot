-- Run this in the Supabase SQL Editor to add the missing column for IBKR starting balance
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS ibkr_starting_balance NUMERIC DEFAULT 20000;

-- Optional: Verify it was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
AND column_name = 'ibkr_starting_balance';
