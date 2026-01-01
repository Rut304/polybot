-- ============================================
-- ADD ALL PLATFORM COLUMNS TO polybot_config
-- Ensures all platforms have starting_balance and enable columns
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PLATFORM ENABLE FLAGS (Boolean)
-- ============================================

-- Prediction Markets
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_polymarket BOOLEAN DEFAULT true;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi BOOLEAN DEFAULT true;

-- Crypto Exchanges
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_binance BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_coinbase BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_kraken BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_kucoin BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_okx BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_bybit BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_hyperliquid BOOLEAN DEFAULT false;

-- Stock Brokers
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_alpaca BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_ibkr BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_webull BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_robinhood BOOLEAN DEFAULT false;

-- ============================================
-- STARTING BALANCES (Numeric - for simulation)
-- ============================================

-- Prediction Markets
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS polymarket_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS kalshi_starting_balance NUMERIC(15,2) DEFAULT 5000;

-- Crypto Exchanges
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS binance_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS coinbase_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS kraken_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS kucoin_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS okx_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS bybit_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS hyperliquid_starting_balance NUMERIC(15,2) DEFAULT 5000;

-- Stock Brokers
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS alpaca_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS ibkr_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS webull_starting_balance NUMERIC(15,2) DEFAULT 5000;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS robinhood_starting_balance NUMERIC(15,2) DEFAULT 5000;

-- ============================================
-- STRATEGY ENABLE FLAGS
-- ============================================

-- Core Arbitrage Strategies
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_polymarket_single_arb BOOLEAN DEFAULT true;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_single_arb BOOLEAN DEFAULT true;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_cross_platform_arb BOOLEAN DEFAULT true;

-- Advanced Strategies
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_market_making BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_news_arbitrage BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_funding_rate_arb BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_15min_crypto_scalping BOOLEAN DEFAULT true;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_grid_trading BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_pairs_trading BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_cross_exchange_arb BOOLEAN DEFAULT false;

-- Stock Strategies
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_stock_mean_reversion BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_stock_momentum BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_sector_rotation BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_dividend_growth BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_earnings_momentum BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_ibkr_futures_momentum BOOLEAN DEFAULT false;

-- Options Strategies
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_covered_calls BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_cash_secured_puts BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_iron_condor BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_wheel_strategy BOOLEAN DEFAULT false;

-- Twitter/High-Conviction Strategies
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_btc_bracket_arb BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_bracket_compression BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_kalshi_mention_snipe BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_whale_copy_trading BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_macro_board BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_fear_premium_contrarian BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_congressional_tracker BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_high_conviction_strategy BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_political_event_strategy BOOLEAN DEFAULT false;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS enable_selective_whale_copy BOOLEAN DEFAULT false;

-- ============================================
-- POSITION SIZING & RISK
-- ============================================

ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS max_position_usd NUMERIC(10,2) DEFAULT 50;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS min_position_usd NUMERIC(10,2) DEFAULT 5;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS poly_single_max_position_usd NUMERIC(10,2) DEFAULT 30;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS kalshi_single_max_position_usd NUMERIC(10,2) DEFAULT 30;
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS cross_plat_max_position_usd NUMERIC(10,2) DEFAULT 30;

-- ============================================
-- TRADING MODE
-- ============================================

ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'paper';
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS is_running BOOLEAN DEFAULT false;

-- ============================================
-- TIMESTAMPS
-- ============================================

ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.polybot_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- VERIFY COLUMNS WERE ADDED
-- ============================================

SELECT 'Columns in polybot_config:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'polybot_config' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'SUCCESS: All platform columns added!' as final_status;
