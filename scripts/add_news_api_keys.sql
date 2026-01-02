-- Add all news/sentiment API keys to polybot_secrets
-- Run this in Supabase SQL Editor to ensure all news sources are configured

-- NEWS & SENTIMENT APIs (comprehensive list)
INSERT INTO polybot_secrets (key_name, description, category) VALUES
-- Finnhub - Best for real-time market news (60 calls/min free)
('FINNHUB_API_KEY', 'Finnhub API key - Real-time market news & sentiment (60 calls/min free)', 'news_sentiment'),

-- NewsAPI - General news aggregator (100 req/day free, 15-min delay)
('NEWS_API_KEY', 'NewsAPI.org API key - General news aggregator (100 req/day free)', 'news_sentiment'),
('NEWSAPI_KEY', 'NewsAPI.org API key (alternate key name)', 'news_sentiment'),

-- Alpha Vantage - News with pre-built sentiment scores (25 req/day free)
('ALPHAVANTAGE_API_KEY', 'Alpha Vantage API key - News with sentiment scores (25 req/day free)', 'news_sentiment'),
('ALPHA_VANTAGE_API_KEY', 'Alpha Vantage API key (alternate key name)', 'news_sentiment'),

-- Twitter/X - Social sentiment & breaking news
('TWITTER_API_KEY', 'Twitter/X API key for social sentiment', 'news_sentiment'),
('TWITTER_API_SECRET', 'Twitter/X API secret', 'news_sentiment'),
('TWITTER_BEARER_TOKEN', 'Twitter/X Bearer token for API v2 (required for search)', 'news_sentiment'),

-- Polygon.io - Financial data & news
('POLYGON_API_KEY', 'Polygon.io API key for market data & news', 'news_sentiment'),

-- Benzinga - Professional financial news
('BENZINGA_API_KEY', 'Benzinga API key for professional financial news', 'news_sentiment'),

-- NewsData.io - Alternative news API
('NEWSDATA_API_KEY', 'NewsData.io API key - Alternative news source', 'news_sentiment')

ON CONFLICT (key_name) DO UPDATE SET 
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Verify all news keys are present
SELECT 
  key_name, 
  description,
  category,
  is_configured,
  CASE WHEN key_value IS NOT NULL AND key_value != '' THEN '✅ Set' ELSE '❌ Not set' END as status
FROM polybot_secrets 
WHERE category = 'news_sentiment'
ORDER BY key_name;

-- Also show data_feeds category (older naming)
SELECT 
  key_name, 
  description,
  category,
  is_configured,
  CASE WHEN key_value IS NOT NULL AND key_value != '' THEN '✅ Set' ELSE '❌ Not set' END as status
FROM polybot_secrets 
WHERE category = 'data_feeds'
ORDER BY key_name;
