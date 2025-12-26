-- Add Autonomous RSI columns to polybot_config table
-- These columns enable the AI-powered RSI optimization feature (Pro/Elite only)

ALTER TABLE polybot_config
ADD COLUMN IF NOT EXISTS autonomous_rsi_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS autonomous_rsi_min_trades INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS autonomous_rsi_adjustment_pct FLOAT DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS autonomous_rsi_learning_rate FLOAT DEFAULT 0.1;

-- Add comment explaining the feature
COMMENT ON COLUMN polybot_config.autonomous_rsi_enabled IS 'Enable AI-powered RSI threshold optimization (Pro/Elite feature)';
COMMENT ON COLUMN polybot_config.autonomous_rsi_min_trades IS 'Minimum trades before autonomous adjustment begins';
COMMENT ON COLUMN polybot_config.autonomous_rsi_adjustment_pct IS 'Maximum RSI adjustment percentage per optimization cycle';
COMMENT ON COLUMN polybot_config.autonomous_rsi_learning_rate IS 'How fast the system adapts to new data (0-1)';

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'polybot_config' 
AND column_name LIKE 'autonomous_rsi%';
