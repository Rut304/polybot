-- Migration: Add crypto strategies config columns to polybot_config
-- Run this in Supabase SQL Editor

-- Funding Rate Arbitrage settings (85% confidence - 15-50% APY)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_funding_rate_arb BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_min_rate_pct DECIMAL(10,4) DEFAULT 0.03;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_min_apy DECIMAL(10,2) DEFAULT 30.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_max_position_usd DECIMAL(10,2) DEFAULT 1000.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_max_positions INTEGER DEFAULT 3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_max_leverage INTEGER DEFAULT 3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS funding_scan_interval_sec INTEGER DEFAULT 300;

-- Grid Trading settings (75% confidence - 20-60% APY)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_grid_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_default_range_pct DECIMAL(10,2) DEFAULT 10.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_default_levels INTEGER DEFAULT 20;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_default_investment_usd DECIMAL(10,2) DEFAULT 500.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_max_grids INTEGER DEFAULT 3;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_stop_loss_pct DECIMAL(10,2) DEFAULT 15.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS grid_take_profit_pct DECIMAL(10,2) DEFAULT 50.0;

-- Pairs Trading settings (65% confidence - 10-25% APY)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_pairs_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_entry_zscore DECIMAL(10,2) DEFAULT 2.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_exit_zscore DECIMAL(10,2) DEFAULT 0.5;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_position_size_usd DECIMAL(10,2) DEFAULT 500.0;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_max_positions INTEGER DEFAULT 2;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS pairs_max_hold_hours DECIMAL(10,2) DEFAULT 72.0;

-- Exchange Enablement flags
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_binance BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_bybit BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_okx BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kraken BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_coinbase BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kucoin BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_alpaca BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_ibkr BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN polybot_config.enable_funding_rate_arb IS 'Enable funding rate arbitrage strategy (85% confidence - 15-50% APY)';
COMMENT ON COLUMN polybot_config.funding_min_rate_pct IS 'Minimum funding rate per 8h to consider (default 0.03%)';
COMMENT ON COLUMN polybot_config.funding_min_apy IS 'Minimum APY threshold to enter position (default 30%)';
COMMENT ON COLUMN polybot_config.funding_max_position_usd IS 'Maximum position size per funding trade';
COMMENT ON COLUMN polybot_config.funding_max_positions IS 'Maximum concurrent funding positions';
COMMENT ON COLUMN polybot_config.funding_max_leverage IS 'Max leverage for futures leg (default 3x)';
COMMENT ON COLUMN polybot_config.funding_scan_interval_sec IS 'Seconds between funding rate scans';

COMMENT ON COLUMN polybot_config.enable_grid_trading IS 'Enable grid trading strategy (75% confidence - 20-60% APY)';
COMMENT ON COLUMN polybot_config.grid_default_range_pct IS 'Default price range from current (±%)';
COMMENT ON COLUMN polybot_config.grid_default_levels IS 'Number of buy/sell grid levels';
COMMENT ON COLUMN polybot_config.grid_default_investment_usd IS 'Investment amount per grid';
COMMENT ON COLUMN polybot_config.grid_max_grids IS 'Maximum concurrent grids';
COMMENT ON COLUMN polybot_config.grid_stop_loss_pct IS 'Stop loss on breakout (%)';
COMMENT ON COLUMN polybot_config.grid_take_profit_pct IS 'Take profit target (%)';

COMMENT ON COLUMN polybot_config.enable_pairs_trading IS 'Enable pairs trading strategy (65% confidence - 10-25% APY)';
COMMENT ON COLUMN polybot_config.pairs_entry_zscore IS 'Z-score threshold to enter (default 2.0)';
COMMENT ON COLUMN polybot_config.pairs_exit_zscore IS 'Z-score threshold to exit (default 0.5)';
COMMENT ON COLUMN polybot_config.pairs_position_size_usd IS 'Position size per leg';
COMMENT ON COLUMN polybot_config.pairs_max_positions IS 'Maximum concurrent pairs positions';
COMMENT ON COLUMN polybot_config.pairs_max_hold_hours IS 'Maximum hold time before forced exit';

COMMENT ON COLUMN polybot_config.enable_binance IS 'Enable Binance exchange for crypto strategies';
COMMENT ON COLUMN polybot_config.enable_bybit IS 'Enable Bybit exchange for crypto strategies';
COMMENT ON COLUMN polybot_config.enable_okx IS 'Enable OKX exchange for crypto strategies';
COMMENT ON COLUMN polybot_config.enable_kraken IS 'Enable Kraken exchange for crypto strategies';
COMMENT ON COLUMN polybot_config.enable_coinbase IS 'Enable Coinbase Pro for crypto strategies';
COMMENT ON COLUMN polybot_config.enable_kucoin IS 'Enable KuCoin for crypto strategies';
COMMENT ON COLUMN polybot_config.enable_alpaca IS 'Enable Alpaca for stock trading';
COMMENT ON COLUMN polybot_config.enable_ibkr IS 'Enable Interactive Brokers for stock/options trading';

-- Show current structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
ORDER BY ordinal_position;
