-- ============================================
-- PHASE 1: Advanced Framework Config Fields
-- ============================================
-- Add these columns to polybot_config table to enable new risk management features

-- Kelly Criterion Position Sizing
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kelly_sizing_enabled BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kelly_fraction_cap DECIMAL(5,2) DEFAULT 0.25;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kelly_min_confidence DECIMAL(5,2) DEFAULT 0.60;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS kelly_max_position_pct DECIMAL(5,2) DEFAULT 10.00;

-- Market Regime Detection
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS regime_detection_enabled BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS regime_vix_low_threshold DECIMAL(5,2) DEFAULT 15.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS regime_vix_high_threshold DECIMAL(5,2) DEFAULT 25.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS regime_vix_crisis_threshold DECIMAL(5,2) DEFAULT 35.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS regime_auto_adjust BOOLEAN DEFAULT true;

-- Circuit Breaker System
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS circuit_breaker_enabled BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS circuit_breaker_level1_pct DECIMAL(5,2) DEFAULT 3.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS circuit_breaker_level2_pct DECIMAL(5,2) DEFAULT 5.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS circuit_breaker_level3_pct DECIMAL(5,2) DEFAULT 10.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS circuit_breaker_reset_hours INTEGER DEFAULT 24;

-- ============================================
-- PHASE 2: Strategy Enhancement Config Fields
-- ============================================

-- Time Decay Analysis (Prediction Markets)
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS time_decay_enabled BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS time_decay_critical_days INTEGER DEFAULT 7;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS time_decay_avoid_entry_hours INTEGER DEFAULT 48;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS time_decay_mid_prob_low DECIMAL(5,2) DEFAULT 0.35;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS time_decay_mid_prob_high DECIMAL(5,2) DEFAULT 0.65;

-- Order Flow Analysis
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS order_flow_enabled BOOLEAN DEFAULT false;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS order_flow_signal_threshold DECIMAL(5,2) DEFAULT 0.30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS order_flow_strong_threshold DECIMAL(5,2) DEFAULT 0.60;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS order_flow_lookback_seconds INTEGER DEFAULT 300;

-- Stablecoin Depeg Detection
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS depeg_detection_enabled BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS depeg_alert_threshold_pct DECIMAL(5,2) DEFAULT 0.30;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS depeg_arbitrage_threshold_pct DECIMAL(5,2) DEFAULT 0.50;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS depeg_critical_threshold_pct DECIMAL(5,2) DEFAULT 5.00;

-- Correlation Position Limits
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS correlation_limits_enabled BOOLEAN DEFAULT true;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS correlation_max_cluster_pct DECIMAL(5,2) DEFAULT 30.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS correlation_max_correlated_pct DECIMAL(5,2) DEFAULT 50.00;
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS correlation_high_threshold DECIMAL(5,2) DEFAULT 0.70;

-- ============================================
-- NEW TABLE: Regime History
-- ============================================
CREATE TABLE IF NOT EXISTS regime_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    regime TEXT NOT NULL,
    vix_value DECIMAL(10,2),
    btc_volatility DECIMAL(10,4),
    market_breadth DECIMAL(10,4),
    adjustments JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regime_history_timestamp ON regime_history(timestamp DESC);

-- ============================================
-- NEW TABLE: Circuit Breaker Events
-- ============================================
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level INTEGER NOT NULL,
    drawdown_pct DECIMAL(10,4) NOT NULL,
    action_taken TEXT NOT NULL,
    reset_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_timestamp ON circuit_breaker_events(timestamp DESC);

-- ============================================
-- NEW TABLE: Depeg Alerts
-- ============================================
CREATE TABLE IF NOT EXISTS depeg_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol TEXT NOT NULL,
    current_price DECIMAL(20,8) NOT NULL,
    peg_price DECIMAL(20,8) NOT NULL,
    deviation_pct DECIMAL(10,4) NOT NULL,
    severity TEXT NOT NULL,
    direction TEXT NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_depeg_alerts_timestamp ON depeg_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_depeg_alerts_symbol ON depeg_alerts(symbol);

-- ============================================
-- NEW TABLE: Position Sizing Log
-- ============================================
CREATE TABLE IF NOT EXISTS position_sizing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol TEXT NOT NULL,
    market_type TEXT NOT NULL,
    
    -- Kelly inputs
    win_rate DECIMAL(10,4),
    avg_win DECIMAL(20,8),
    avg_loss DECIMAL(20,8),
    
    -- Kelly outputs
    kelly_fraction DECIMAL(10,4),
    recommended_size DECIMAL(20,8),
    actual_size DECIMAL(20,8),
    
    -- Context
    regime TEXT,
    confidence DECIMAL(10,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_position_sizing_timestamp ON position_sizing_log(timestamp DESC);

-- ============================================
-- Grant permissions for new tables
-- ============================================
GRANT SELECT, INSERT, UPDATE ON regime_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON circuit_breaker_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON depeg_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON position_sizing_log TO authenticated;

-- Enable RLS
ALTER TABLE regime_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE depeg_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_sizing_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for now)
CREATE POLICY "Enable all for authenticated users" ON regime_history
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON circuit_breaker_events
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON depeg_alerts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON position_sizing_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN polybot_config.kelly_sizing_enabled IS 'Enable Kelly Criterion position sizing';
COMMENT ON COLUMN polybot_config.kelly_fraction_cap IS 'Maximum Kelly fraction (0.25 = half-Kelly)';
COMMENT ON COLUMN polybot_config.regime_detection_enabled IS 'Enable market regime detection';
COMMENT ON COLUMN polybot_config.circuit_breaker_enabled IS 'Enable automatic circuit breaker on drawdown';
COMMENT ON COLUMN polybot_config.time_decay_enabled IS 'Enable time decay analysis for prediction markets';
COMMENT ON COLUMN polybot_config.depeg_detection_enabled IS 'Enable stablecoin depeg detection';
COMMENT ON COLUMN polybot_config.correlation_limits_enabled IS 'Enable correlation-based position limits';
