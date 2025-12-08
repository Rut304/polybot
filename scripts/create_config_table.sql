-- Polybot Configuration Table Updates
-- Add starting balance columns to existing polybot_config table
-- The table uses a single-row structure with id=1

-- Add the starting balance columns
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS polymarket_starting_balance NUMERIC DEFAULT 20000,
ADD COLUMN IF NOT EXISTS kalshi_starting_balance NUMERIC DEFAULT 20000,
ADD COLUMN IF NOT EXISTS binance_starting_balance NUMERIC DEFAULT 20000,
ADD COLUMN IF NOT EXISTS coinbase_starting_balance NUMERIC DEFAULT 20000,
ADD COLUMN IF NOT EXISTS alpaca_starting_balance NUMERIC DEFAULT 20000;

-- Add stock strategy columns
ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS enable_stock_mean_reversion BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mean_rev_rsi_oversold INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS mean_rev_rsi_overbought INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS mean_rev_position_size_usd NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS mean_rev_max_positions INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS mean_rev_stop_loss_pct NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS mean_rev_take_profit_pct NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS enable_stock_momentum BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS momentum_lookback_days INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS momentum_min_score INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS momentum_position_size_usd NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS momentum_max_positions INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS momentum_trailing_stop_pct NUMERIC DEFAULT 8,
ADD COLUMN IF NOT EXISTS enable_sector_rotation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sector_rotation_period_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS sector_top_n INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS sector_position_size_usd NUMERIC DEFAULT 2000,
ADD COLUMN IF NOT EXISTS sector_rebalance_frequency_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS enable_dividend_growth BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dividend_min_yield_pct NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS dividend_min_growth_years INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS dividend_position_size_usd NUMERIC DEFAULT 2000,
ADD COLUMN IF NOT EXISTS dividend_max_positions INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS enable_earnings_momentum BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS earnings_min_surprise_pct NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS earnings_hold_days INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS earnings_position_size_usd NUMERIC DEFAULT 500,
ADD COLUMN IF NOT EXISTS earnings_max_positions INTEGER DEFAULT 3;

-- Add options strategy columns
ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS enable_covered_calls BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS covered_call_days_to_expiry INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS covered_call_delta_target NUMERIC DEFAULT 0.30,
ADD COLUMN IF NOT EXISTS covered_call_min_premium_pct NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS enable_cash_secured_puts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS csp_days_to_expiry INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS csp_delta_target NUMERIC DEFAULT -0.30,
ADD COLUMN IF NOT EXISTS csp_min_premium_pct NUMERIC DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS enable_iron_condor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS iron_condor_days_to_expiry INTEGER DEFAULT 45,
ADD COLUMN IF NOT EXISTS iron_condor_wing_width INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS iron_condor_min_premium_pct NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS enable_wheel_strategy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wheel_stock_list TEXT DEFAULT 'AAPL,MSFT,GOOGL,AMZN,NVDA',
ADD COLUMN IF NOT EXISTS wheel_position_size_usd NUMERIC DEFAULT 5000;

-- Update the existing row with default values if needed
UPDATE polybot_config 
SET 
    polymarket_starting_balance = COALESCE(polymarket_starting_balance, 20000),
    kalshi_starting_balance = COALESCE(kalshi_starting_balance, 20000),
    binance_starting_balance = COALESCE(binance_starting_balance, 20000),
    coinbase_starting_balance = COALESCE(coinbase_starting_balance, 20000),
    alpaca_starting_balance = COALESCE(alpaca_starting_balance, 20000)
WHERE id = 1;
