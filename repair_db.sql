-- SQL TO FIX SETTINGS PERSISTENCE & ADD AUDIT LOGS
-- Run this in your Supabase SQL Editor

-- 1. Enable Exchange Columns
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS enable_ibkr BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enable_alpaca BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enable_binance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enable_coinbase BOOLEAN DEFAULT FALSE;

-- 2. Balance Columns
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS ibkr_starting_balance FLOAT DEFAULT 20000.0,
ADD COLUMN IF NOT EXISTS alpaca_starting_balance FLOAT DEFAULT 20000.0,
ADD COLUMN IF NOT EXISTS binance_starting_balance FLOAT DEFAULT 20000.0,
ADD COLUMN IF NOT EXISTS coinbase_starting_balance FLOAT DEFAULT 20000.0;

-- 3. Strategy Settings Columns
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS poly_single_min_profit_pct FLOAT DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS kalshi_single_min_profit_pct FLOAT DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_poly_pct FLOAT DEFAULT 3.0,
ADD COLUMN IF NOT EXISTS cross_plat_min_profit_buy_kalshi_pct FLOAT DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS enable_polymarket_single_arb BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_kalshi_single_arb BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_cross_platform_arb BOOLEAN DEFAULT TRUE;

-- 4. CREATE AUDIT LOGS TABLE (New)
CREATE TABLE IF NOT EXISTS polybot_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS (Optional but recommended)
ALTER TABLE polybot_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for authenticated users" ON polybot_audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access for authenticated users" ON polybot_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow service role full access" ON polybot_audit_logs USING (true) WITH CHECK (true);

-- 5. Verify
SELECT * FROM polybot_config LIMIT 1;
