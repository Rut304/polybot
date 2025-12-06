-- Migration: Add new secrets for Alpaca Paper Trading and News APIs
-- Run this in Supabase SQL Editor

-- ALPACA PAPER TRADING KEYS (for simulation mode)
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('ALPACA_PAPER_API_KEY', 'Alpaca Paper Trading API Key (for simulation mode)', 'stock_brokers'),
('ALPACA_PAPER_API_SECRET', 'Alpaca Paper Trading API Secret (for simulation)', 'stock_brokers')
ON CONFLICT (key_name) DO NOTHING;

-- Rename existing Alpaca keys to indicate they are LIVE keys
UPDATE polybot_secrets 
SET key_name = 'ALPACA_LIVE_API_KEY', description = 'Alpaca LIVE Trading API Key (real money)'
WHERE key_name = 'ALPACA_API_KEY';

UPDATE polybot_secrets 
SET key_name = 'ALPACA_LIVE_API_SECRET', description = 'Alpaca LIVE Trading API Secret (real money)'
WHERE key_name = 'ALPACA_API_SECRET';

UPDATE polybot_secrets 
SET description = 'Alpaca API URL (auto-selected based on mode)'
WHERE key_name = 'ALPACA_BASE_URL';

-- POLYMARKET CREDENTIALS (if not already present)
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('POLYMARKET_WALLET_ADDRESS', 'Polymarket wallet address for trading', 'prediction_markets'),
('POLYMARKET_PRIVATE_KEY', 'Polymarket wallet private key for signing trades', 'prediction_markets'),
('POLYMARKET_API_KEY', 'Polymarket CLOB API key', 'prediction_markets'),
('POLYMARKET_SECRET', 'Polymarket CLOB API secret', 'prediction_markets')
ON CONFLICT (key_name) DO NOTHING;

-- KALSHI CREDENTIALS (if not already present)
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('KALSHI_API_KEY', 'Kalshi API key ID', 'prediction_markets'),
('KALSHI_PRIVATE_KEY', 'Kalshi RSA private key for signing requests', 'prediction_markets')
ON CONFLICT (key_name) DO NOTHING;

-- NEWS & SENTIMENT APIs (new category)
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('FINNHUB_API_KEY', 'Finnhub API key - Best free option for market news & sentiment (60 calls/min)', 'news_sentiment'),
('NEWSAPI_KEY', 'NewsAPI.org API key - General news (100 req/day free, 15-min delay)', 'news_sentiment'),
('ALPHAVANTAGE_API_KEY', 'Alpha Vantage API key - News with sentiment scores (25 req/day free)', 'news_sentiment')
ON CONFLICT (key_name) DO NOTHING;

-- Move Twitter keys to news_sentiment category for consistency
UPDATE polybot_secrets 
SET category = 'news_sentiment',
    description = 'Twitter/X API key for social sentiment analysis'
WHERE key_name = 'TWITTER_API_KEY';

UPDATE polybot_secrets 
SET category = 'news_sentiment',
    description = 'Twitter/X API secret'
WHERE key_name = 'TWITTER_API_SECRET';

UPDATE polybot_secrets 
SET category = 'news_sentiment',
    description = 'Twitter/X Bearer token for API v2 access'
WHERE key_name = 'TWITTER_BEARER_TOKEN';

-- Verify results
SELECT key_name, category, description, is_configured 
FROM polybot_secrets 
WHERE category IN ('stock_brokers', 'news_sentiment')
ORDER BY category, key_name;
