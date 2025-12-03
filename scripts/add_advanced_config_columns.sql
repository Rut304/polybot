-- Add advanced trading configuration columns to polybot_config
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Paste & Run

-- Advanced simulation parameters
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS max_realistic_spread_pct DECIMAL(5,2) DEFAULT 12.0;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS min_profit_threshold_pct DECIMAL(5,2) DEFAULT 5.0;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS slippage_min_pct DECIMAL(5,3) DEFAULT 0.2;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS slippage_max_pct DECIMAL(5,3) DEFAULT 1.0;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS spread_cost_pct DECIMAL(5,3) DEFAULT 0.5;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS execution_failure_rate DECIMAL(5,3) DEFAULT 0.15;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS partial_fill_chance DECIMAL(5,3) DEFAULT 0.15;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS partial_fill_min_pct DECIMAL(5,3) DEFAULT 0.70;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS resolution_loss_rate DECIMAL(5,3) DEFAULT 0.08;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS loss_severity_min DECIMAL(5,3) DEFAULT 0.10;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS loss_severity_max DECIMAL(5,3) DEFAULT 0.40;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS max_position_pct DECIMAL(5,2) DEFAULT 5.0;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS max_position_usd DECIMAL(10,2) DEFAULT 50.0;

ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS min_position_usd DECIMAL(10,2) DEFAULT 5.0;

-- Update existing row with tuned values
UPDATE polybot_config SET
  max_realistic_spread_pct = 12.0,
  min_profit_threshold_pct = 5.0,
  slippage_min_pct = 0.2,
  slippage_max_pct = 1.0,
  spread_cost_pct = 0.5,
  execution_failure_rate = 0.15,
  partial_fill_chance = 0.15,
  partial_fill_min_pct = 0.70,
  resolution_loss_rate = 0.08,
  loss_severity_min = 0.10,
  loss_severity_max = 0.40,
  max_position_pct = 5.0,
  max_position_usd = 50.0,
  min_position_usd = 5.0
WHERE id = 1;

-- Verify the columns were added
SELECT * FROM polybot_config WHERE id = 1;
