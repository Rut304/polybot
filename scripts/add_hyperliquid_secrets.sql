-- Add Hyperliquid Secrets to polybot_secrets
-- Run this in Supabase SQL Editor after the signup fix

-- HYPERLIQUID DEX SECRETS
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('HYPERLIQUID_WALLET_ADDRESS', 'Ethereum wallet address (0x...) for Hyperliquid', 'crypto_exchanges'),
('HYPERLIQUID_PRIVATE_KEY', 'Ethereum private key for signing Hyperliquid orders (never shared)', 'crypto_exchanges'),
('HYPERLIQUID_API_WALLET_ADDRESS', 'Optional: Dedicated API wallet address for bot trading', 'crypto_exchanges'),
('HYPERLIQUID_API_WALLET_KEY', 'Optional: API wallet private key (can trade but not withdraw)', 'crypto_exchanges')
ON CONFLICT (key_name) DO UPDATE SET 
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Show what was added
SELECT key_name, description, category, is_configured 
FROM polybot_secrets 
WHERE key_name LIKE 'HYPERLIQUID%'
ORDER BY key_name;
