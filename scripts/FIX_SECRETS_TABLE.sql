-- =========================================================
-- FIX SECRETS TABLE - Run this in Supabase SQL Editor
-- =========================================================
-- This ensures the polybot_secrets table exists and has
-- all the correct API key entries for your exchanges
-- =========================================================

-- STEP 1: Create secrets table if not exists
CREATE TABLE IF NOT EXISTS polybot_secrets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_name VARCHAR(100) UNIQUE NOT NULL,
    key_value TEXT,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    is_configured BOOLEAN DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 2: Enable Row Level Security
ALTER TABLE polybot_secrets ENABLE ROW LEVEL SECURITY;

-- STEP 3: Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Only admins can view secrets" ON polybot_secrets;
DROP POLICY IF EXISTS "Only admins can update secrets" ON polybot_secrets;
DROP POLICY IF EXISTS "Only admins can insert secrets" ON polybot_secrets;
DROP POLICY IF EXISTS "Allow authenticated full access secrets" ON polybot_secrets;
DROP POLICY IF EXISTS "Allow service full access secrets" ON polybot_secrets;

-- STEP 4: Create new policies (allowing authenticated users full access for admin UI)
CREATE POLICY "Allow authenticated full access secrets" ON polybot_secrets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow service full access secrets" ON polybot_secrets
    FOR ALL TO service_role USING (true);

-- STEP 5: Insert all API key placeholders

-- PREDICTION MARKETS
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('POLYMARKET_API_KEY', 'Polymarket CLOB API Key for authenticated trading', 'prediction_markets'),
('POLYMARKET_SECRET', 'Polymarket CLOB API Secret', 'prediction_markets'),
('POLYMARKET_PRIVATE_KEY', 'Ethereum wallet private key for on-chain Polymarket trades (0x...)', 'prediction_markets'),
('WALLET_ADDRESS', 'Ethereum wallet address (0x...) for Polymarket', 'prediction_markets'),
('KALSHI_API_KEY', 'Kalshi API Key ID from dashboard', 'prediction_markets'),
('KALSHI_PRIVATE_KEY', 'Kalshi RSA Private Key (PEM format) for signing requests', 'prediction_markets')
ON CONFLICT (key_name) DO NOTHING;

-- CRYPTO EXCHANGES
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('BINANCE_API_KEY', 'Binance/Binance.US API Key', 'crypto_exchanges'),
('BINANCE_API_SECRET', 'Binance/Binance.US API Secret', 'crypto_exchanges'),
('BINANCE_USE_US', 'Set to "true" for Binance.US, "false" for Binance.com', 'crypto_exchanges'),
('BYBIT_API_KEY', 'Bybit Unified V5 API Key', 'crypto_exchanges'),
('BYBIT_API_SECRET', 'Bybit API Secret', 'crypto_exchanges'),
('OKX_API_KEY', 'OKX API Key', 'crypto_exchanges'),
('OKX_API_SECRET', 'OKX API Secret', 'crypto_exchanges'),
('OKX_PASSPHRASE', 'OKX API Passphrase (required by OKX)', 'crypto_exchanges'),
('KRAKEN_API_KEY', 'Kraken API Key', 'crypto_exchanges'),
('KRAKEN_API_SECRET', 'Kraken Private Key', 'crypto_exchanges'),
('COINBASE_API_KEY', 'Coinbase Advanced Trade API Key', 'crypto_exchanges'),
('COINBASE_API_SECRET', 'Coinbase API Secret', 'crypto_exchanges'),
('COINBASE_PASSPHRASE', 'Coinbase API Passphrase (if required)', 'crypto_exchanges'),
('KUCOIN_API_KEY', 'KuCoin API Key', 'crypto_exchanges'),
('KUCOIN_API_SECRET', 'KuCoin API Secret', 'crypto_exchanges'),
('KUCOIN_PASSPHRASE', 'KuCoin API Passphrase', 'crypto_exchanges')
ON CONFLICT (key_name) DO NOTHING;

-- STOCK BROKERS
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('ALPACA_API_KEY', 'Alpaca Trading API Key', 'stock_brokers'),
('ALPACA_API_SECRET', 'Alpaca API Secret', 'stock_brokers'),
('ALPACA_BASE_URL', 'Alpaca Base URL (paper: https://paper-api.alpaca.markets, live: https://api.alpaca.markets)', 'stock_brokers'),
('IBKR_HOST', 'Interactive Brokers TWS/Gateway Host (usually 127.0.0.1)', 'stock_brokers'),
('IBKR_PORT', 'IBKR TWS Port (7497 for paper, 7496 for live)', 'stock_brokers'),
('IBKR_CLIENT_ID', 'IBKR Client ID (any unique integer)', 'stock_brokers')
ON CONFLICT (key_name) DO NOTHING;

-- INFRASTRUCTURE
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('SUPABASE_URL', 'Supabase project URL (https://xxx.supabase.co)', 'infrastructure'),
('SUPABASE_KEY', 'Supabase anon/public key', 'infrastructure'),
('SUPABASE_SERVICE_KEY', 'Supabase service role key (for backend only)', 'infrastructure')
ON CONFLICT (key_name) DO NOTHING;

-- NOTIFICATIONS
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('DISCORD_WEBHOOK', 'Discord webhook URL for trade notifications', 'notifications'),
('TELEGRAM_BOT_TOKEN', 'Telegram bot token from @BotFather', 'notifications'),
('TELEGRAM_CHAT_ID', 'Telegram chat/channel ID for notifications', 'notifications')
ON CONFLICT (key_name) DO NOTHING;

-- NEWS/DATA
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('NEWS_API_KEY', 'NewsAPI.org API key for news sentiment', 'data_feeds'),
('TWITTER_API_KEY', 'Twitter/X API key for social sentiment', 'data_feeds'),
('TWITTER_API_SECRET', 'Twitter/X API secret', 'data_feeds'),
('TWITTER_BEARER_TOKEN', 'Twitter/X Bearer token for API v2', 'data_feeds')
ON CONFLICT (key_name) DO NOTHING;

-- STEP 6: Create helper functions

-- Function to update a secret
CREATE OR REPLACE FUNCTION update_secret(p_key_name TEXT, p_value TEXT)
RETURNS void AS $$
BEGIN
    UPDATE polybot_secrets 
    SET key_value = p_value,
        is_configured = (p_value IS NOT NULL AND p_value != ''),
        last_updated = NOW()
    WHERE key_name = p_key_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get masked secrets (for display)
CREATE OR REPLACE FUNCTION get_secrets_masked()
RETURNS TABLE (
    key_name VARCHAR(100),
    masked_value TEXT,
    description TEXT,
    category VARCHAR(50),
    is_configured BOOLEAN,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.key_name,
        CASE 
            WHEN s.key_value IS NULL OR s.key_value = '' THEN ''
            WHEN LENGTH(s.key_value) <= 8 THEN '********'
            ELSE LEFT(s.key_value, 4) || '...' || RIGHT(s.key_value, 4)
        END as masked_value,
        s.description,
        s.category,
        s.is_configured,
        s.last_updated
    FROM polybot_secrets s
    ORDER BY s.category, s.key_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_secrets_category ON polybot_secrets(category);
CREATE INDEX IF NOT EXISTS idx_secrets_key_name ON polybot_secrets(key_name);

-- STEP 7: Show current secrets status
SELECT 
    '✅ polybot_secrets table configured!' as status,
    COUNT(*) as total_keys,
    SUM(CASE WHEN is_configured THEN 1 ELSE 0 END) as configured_keys
FROM polybot_secrets;

-- Show which keys are configured
SELECT 
    category,
    key_name,
    CASE WHEN is_configured THEN '✅ Configured' ELSE '❌ Not Set' END as status,
    description
FROM polybot_secrets
ORDER BY category, key_name;
