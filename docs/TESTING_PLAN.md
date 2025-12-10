# Polybot Strategy Testing Plan

## Overview

This document outlines the comprehensive testing plan for all 50+ trading strategies implemented in Polybot. Testing covers accuracy, risk management, database logging, and both simulation and live trading modes.

---

## Testing Levels

### 1. Unit Tests (Per Strategy Module)

| Module | Tests | Status |
|--------|-------|--------|
| `position_sizing.py` | Kelly fraction calc, edge detection, position limits | ✅ Created |
| `regime_detection.py` | VIX thresholds, regime transitions, adjustments | ✅ Created |
| `circuit_breaker.py` | Level triggers, auto-reset, trade blocking | ✅ Created |
| `time_decay.py` | Critical period, avoid entry, extreme prob | ✅ Created |
| `depeg_detection.py` | Alert thresholds, arb opportunity, severity | ✅ Created |
| `correlation_limits.py` | Cluster limits, exposure calc, blocking | ✅ Created |
| `order_flow.py` | OFI calc, signal generation, momentum | 🔄 Pending |

### 2. Integration Tests

| Test Scenario | Description | Status |
|--------------|-------------|--------|
| Full Trade Flow | Entry → Position → Exit → P&L | 🔄 Pending |
| Risk Management | Circuit breaker + Kelly + Correlation | 🔄 Pending |
| Multi-Strategy | Concurrent strategy execution | 🔄 Pending |
| Database Logging | All events logged correctly | 🔄 Pending |

### 3. Mathematical Accuracy Tests

| Calculation | Formula | Verified |
|------------|---------|----------|
| Kelly Fraction | `(bp - q) / b` | ✅ |
| Drawdown % | `(peak - current) / peak * 100` | ✅ |
| Correlation | Pearson coefficient | ✅ |
| Time Decay | Exponential decay model | ✅ |
| Position Size | `Kelly * portfolio * confidence` | ✅ |

---

## Test Execution Plan

### Phase 1: Unit Test Execution (5 min)

```bash
# Run all strategy unit tests
cd /Users/rut/polybot
python -m pytest tests/test_strategies.py -v --tb=short
```

### Phase 2: Integration Test Execution (10 min)

```bash
# Run integration tests with paper trader
python -c "
from tests.test_strategies import run_all_tests
run_all_tests()
"
```

### Phase 3: Simulation Mode Validation (15 min)

1. **Start bot in simulation mode:**
   ```bash
   python -m src.main --simulation
   ```

2. **Monitor for 10 minutes:**
   - Verify trades are logged to `polybot_trades`
   - Verify circuit breaker events in `circuit_breaker_events`
   - Verify regime changes in `regime_history`
   - Check P&L calculations in UI

3. **Validation queries:**
   ```sql
   -- Check recent trades
   SELECT * FROM polybot_trades 
   ORDER BY created_at DESC LIMIT 10;
   
   -- Check circuit breaker events
   SELECT * FROM circuit_breaker_events
   ORDER BY timestamp DESC LIMIT 5;
   
   -- Verify P&L accuracy
   SELECT 
     SUM(gross_profit_usd) as gross_pnl,
     SUM(total_fees_usd) as total_fees,
     SUM(net_profit_usd) as net_pnl
   FROM polybot_trades
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

### Phase 4: Live Mode Readiness Check

| Check | Requirement | Status |
|-------|-------------|--------|
| API Keys | All required keys in Supabase | 🔍 Manual |
| Dry Run Flag | `dry_run=false` in config | 🔍 Manual |
| Circuit Breaker | Enabled and tested | ✅ |
| Position Limits | Kelly capped at safe levels | ✅ |
| Emergency Stop | Level 3 halt working | ✅ |

---

## Accuracy Verification Checklist

### P&L Calculations

- [ ] Gross profit = `(exit_price - entry_price) * quantity`
- [ ] Fees deducted correctly per platform
- [ ] Net profit = Gross - Fees
- [ ] Slippage modeled in simulation
- [ ] Partial fills handled correctly

### Risk Management

- [ ] Kelly never exceeds `fraction_cap` (default 25%)
- [ ] Circuit breaker triggers at correct levels
- [ ] Position sizes reduce in high volatility
- [ ] Correlated positions tracked together
- [ ] Emergency halt stops all trading

### Database Integrity

- [ ] All trades logged with unique IDs
- [ ] Timestamps are UTC
- [ ] P&L fields are Decimal (not float)
- [ ] Foreign keys valid
- [ ] RLS policies in place

---

## Expected Test Results

### Kelly Criterion Tests
```
test_kelly_basic_calculation: PASS (0.25 capped correctly)
test_kelly_negative_edge: PASS (returns 0)
test_kelly_position_sizing: PASS (within limits)
test_kelly_low_confidence_rejection: PASS (0 position)
```

### Circuit Breaker Tests
```
test_level1_triggered: PASS (3% → 50% size)
test_level2_triggered: PASS (5% → 25% size)
test_level3_full_halt: PASS (10% → halt)
test_auto_reset: PASS (after cooling period)
```

### Regime Detection Tests
```
test_regime_low_volatility: PASS (VIX < 15)
test_regime_high_volatility: PASS (VIX 25-35)
test_regime_crisis: PASS (VIX > 35)
test_strategy_adjustments: PASS (grids disabled in crisis)
```

---

## Known Limitations

1. **Order Flow Analysis** - Requires real-time order book data (disabled by default)
2. **Correlation Calculation** - Needs 20+ price observations for accuracy
3. **Depeg Detection** - Relies on exchange price feeds
4. **Live Trading** - Requires explicit `dry_run=false` confirmation

---

## Monitoring Dashboard Verification

After tests pass, verify in Admin UI:

1. **Analytics Page** - Strategy filters show new strategies
2. **Settings Page** - Advanced framework toggles visible
3. **Workflows Page** - Risk management flow documented
4. **Dashboard** - Regime indicator displays correctly

---

## Sign-Off Criteria

| Criteria | Required | Status |
|----------|----------|--------|
| All unit tests pass | Yes | 🔄 |
| Integration tests pass | Yes | 🔄 |
| P&L accuracy within 0.01% | Yes | 🔄 |
| Circuit breaker functional | Yes | ✅ |
| Simulation mode verified | Yes | 🔄 |
| Live mode checklist complete | Before live | 🔄 |

---

## Test Execution Commands

```bash
# Quick test (unit tests only)
python -m pytest tests/test_strategies.py -v -x

# Full test suite with coverage
python -m pytest tests/test_strategies.py -v --cov=src/strategies

# Run standalone test runner
python tests/test_strategies.py

# Validate config loading
python -c "from src.config import Config; c = Config(); print(c.trading.kelly_sizing_enabled)"
```
