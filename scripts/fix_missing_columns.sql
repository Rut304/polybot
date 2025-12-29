-- Fix missing columns in various polybot tables
-- Run this in Supabase SQL Editor
-- December 29, 2025

-- ============================================
-- FIX polybot_config TABLE
-- ============================================

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

-- ============================================
-- FIX polybot_status TABLE
-- ============================================

ALTER TABLE polybot_status ADD COLUMN IF NOT EXISTS last_started_at TIMESTAMPTZ;

-- ============================================
-- FIX polybot_simulated_trades TABLE
-- ============================================

ALTER TABLE polybot_simulated_trades ADD COLUMN IF NOT EXISTS strategy TEXT;

-- ============================================
-- VERIFY ALL COLUMNS
-- ============================================

SELECT 'polybot_config' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
AND column_name IN ('enable_ibkr', 'ibkr_starting_balance', 'enable_binance')

UNION ALL

SELECT 'polybot_status' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_status'
AND column_name = 'last_started_at'

UNION ALL

SELECT 'polybot_simulated_trades' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_simulated_trades'
AND column_name = 'strategy';
