-- Fix Exchange Enablement Columns
-- This script ensures all exchange toggle columns exist in polybot_config
-- Run this in Supabase SQL Editor to fix the settings persistence issue

-- First, check current column structure
DO $$
BEGIN
    RAISE NOTICE 'Checking polybot_config table structure...';
END $$;

-- Add exchange enablement columns if they don't exist
-- Using explicit IF NOT EXISTS to avoid errors
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_binance BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_bybit BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_okx BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kraken BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_coinbase BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kucoin BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_alpaca BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_ibkr BOOLEAN DEFAULT false;

-- Set all exchanges to false by default (since they're not configured yet)
-- This only updates if the value is currently null
UPDATE polybot_config 
SET 
    enable_binance = COALESCE(enable_binance, false),
    enable_bybit = COALESCE(enable_bybit, false),
    enable_okx = COALESCE(enable_okx, false),
    enable_kraken = COALESCE(enable_kraken, false),
    enable_coinbase = COALESCE(enable_coinbase, false),
    enable_kucoin = COALESCE(enable_kucoin, false),
    enable_alpaca = COALESCE(enable_alpaca, false),
    enable_ibkr = COALESCE(enable_ibkr, false)
WHERE id = 1;

-- Verify the update
SELECT 
    'Exchange Settings Status' as check_type,
    enable_binance,
    enable_bybit,
    enable_okx,
    enable_kraken,
    enable_coinbase,
    enable_kucoin,
    enable_alpaca,
    enable_ibkr
FROM polybot_config 
WHERE id = 1;

-- Show all columns in polybot_config to verify structure
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Exchange columns verified/created successfully!';
    RAISE NOTICE 'All exchange toggles should now persist correctly.';
END $$;
