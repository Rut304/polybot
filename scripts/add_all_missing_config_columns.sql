-- Add all missing strategy columns to polybot_config
-- Run this in Supabase SQL Editor to fix settings save issues
-- December 29, 2025

-- ============================================
-- ADD MISSING STRATEGY COLUMNS
-- ============================================

-- Stock Strategies (if missing)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_sector_rotation BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_dividend_growth BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_earnings_momentum BOOLEAN DEFAULT false;

-- Options Strategies (if missing)  
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_covered_calls BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_cash_secured_puts BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_iron_condor BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_wheel_strategy BOOLEAN DEFAULT false;

-- Twitter-derived Strategies (if missing)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_btc_bracket_arb BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_bracket_compression BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_mention_snipe BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_macro_board BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_fear_premium_contrarian BOOLEAN DEFAULT false;

-- High Conviction Strategies (if missing)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_high_conviction_strategy BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_political_event_strategy BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_selective_whale_copy BOOLEAN DEFAULT false;

-- Spike Hunter Strategy (THE MISSING ONE!)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_spike_hunter BOOLEAN DEFAULT false;

-- 15-Min Crypto Scalping
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_15min_crypto_scalping BOOLEAN DEFAULT false;

-- AI Superforecasting  
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_ai_superforecasting BOOLEAN DEFAULT false;

-- RSI Strategy (this was mentioned too)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_rsi_strategy BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS rsi_period INTEGER DEFAULT 14;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS rsi_oversold INTEGER DEFAULT 30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS rsi_overbought INTEGER DEFAULT 70;

-- ============================================
-- ADD MISSING STARTING BALANCE COLUMNS
-- ============================================

ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS starting_balance_polymarket DECIMAL(20, 4) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS starting_balance_kalshi DECIMAL(20, 4) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS starting_balance_binance DECIMAL(20, 4) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS starting_balance_coinbase DECIMAL(20, 4) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS starting_balance_alpaca DECIMAL(20, 4) DEFAULT 5000;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS starting_balance_ibkr DECIMAL(20, 4) DEFAULT 5000;

-- ============================================
-- ADD MISSING SIMULATION REALISM COLUMNS
-- ============================================

ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_min DECIMAL(5, 4) DEFAULT 0.01;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS slippage_max DECIMAL(5, 4) DEFAULT 0.2;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS execution_failure_rate DECIMAL(5, 4) DEFAULT 0.03;

-- ============================================
-- ADD MISSING EXCHANGE COLUMNS
-- ============================================

ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_binance BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_coinbase BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_alpaca BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_ibkr BOOLEAN DEFAULT false;

-- ============================================
-- ADD OTHER POTENTIALLY MISSING COLUMNS
-- ============================================

-- Core arbitrage strategies
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_polymarket_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_single_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_cross_platform_arb BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_market_making BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_news_arbitrage BOOLEAN DEFAULT false;

-- Crypto strategies  
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_funding_rate_arb BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_grid_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_pairs_trading BOOLEAN DEFAULT false;

-- Stock strategies
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_stock_mean_reversion BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_stock_momentum BOOLEAN DEFAULT false;

-- Copy trading strategies
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_whale_copy_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS enable_congressional_tracker BOOLEAN DEFAULT false;

-- Trading mode
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS is_live_trading BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS dry_run_mode BOOLEAN DEFAULT true;

-- Trading parameters
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_trade_size DECIMAL(20, 4) DEFAULT 100;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS min_arbitrage_spread DECIMAL(5, 4) DEFAULT 0.02;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS max_position_size DECIMAL(20, 4) DEFAULT 500;

-- ============================================
-- VERIFY ALL COLUMNS ADDED
-- ============================================

-- Select to verify structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config'
ORDER BY ordinal_position;
