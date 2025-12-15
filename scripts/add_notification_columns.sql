-- Add notification columns to polybot_config
-- Run this SQL in your Supabase SQL Editor

-- Add Discord webhook
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS discord_webhook TEXT DEFAULT '';

-- Add Telegram settings  
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT '';

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '';

-- Add notification toggles
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS notify_on_opportunity BOOLEAN DEFAULT TRUE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS notify_on_trade BOOLEAN DEFAULT TRUE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS notify_on_error BOOLEAN DEFAULT TRUE;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS notify_daily_summary BOOLEAN DEFAULT TRUE;

-- Create config changes table for strategy-history page
CREATE TABLE IF NOT EXISTS polybot_config_changes (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by TEXT,
    change_type TEXT NOT NULL DEFAULT 'manual',
    parameter_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT,
    session_label TEXT
);

-- Create markets cache table for hooks.ts
CREATE TABLE IF NOT EXISTS polybot_markets_cache (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    market_id TEXT NOT NULL,
    title TEXT,
    question TEXT,
    data JSONB,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, market_id)
);

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'polybot_config'
AND column_name IN ('discord_webhook', 'telegram_bot_token', 'telegram_chat_id', 
                    'notifications_enabled', 'notify_on_opportunity', 'notify_on_trade',
                    'notify_on_error', 'notify_daily_summary')
ORDER BY column_name;
