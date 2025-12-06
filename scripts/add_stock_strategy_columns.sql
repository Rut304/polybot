-- Add stock strategy configuration columns to polybot_config
-- Run this in Supabase SQL Editor

-- Stock Mean Reversion Strategy columns
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_watchlist TEXT DEFAULT 'AAPL,MSFT,GOOGL,AMZN,TSLA,NVDA,META,JPM,V,MA';
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_lookback_period INTEGER DEFAULT 20;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_entry_zscore DECIMAL(4,2) DEFAULT 2.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_exit_zscore DECIMAL(4,2) DEFAULT 0.5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_position_size_usd DECIMAL(10,2) DEFAULT 500.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_max_positions INTEGER DEFAULT 5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_max_hold_days INTEGER DEFAULT 10;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mr_stop_loss_pct DECIMAL(5,2) DEFAULT 5.0;

-- Stock Momentum Strategy columns
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_watchlist TEXT DEFAULT 'AAPL,MSFT,GOOGL,AMZN,TSLA,NVDA,META,AMD,CRM,NFLX';
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_roc_period INTEGER DEFAULT 10;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_entry_threshold DECIMAL(5,2) DEFAULT 5.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_exit_threshold DECIMAL(5,2) DEFAULT -2.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_position_size_usd DECIMAL(10,2) DEFAULT 500.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_max_positions INTEGER DEFAULT 5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_max_hold_days INTEGER DEFAULT 5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_stop_loss_pct DECIMAL(5,2) DEFAULT 3.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS stock_mom_take_profit_pct DECIMAL(5,2) DEFAULT 10.0;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
AND column_name LIKE 'stock_%'
ORDER BY column_name;
