# Arbitrage Strategy Guide for PolyBot

## 🎯 Executive Summary

Based on research including the academic paper "Price Discovery and Trading in Prediction Markets" (Ng et al., 2025), here are the key advantages we can exploit:

### Key Finding: Polymarket Leads Price Discovery

**Polymarket prices move 30-90 minutes BEFORE Kalshi**. This means:

- When news breaks, Polymarket reacts first
- We can use Polymarket price movements to predict Kalshi direction
- The best arb opportunities appear when Kalshi hasn't caught up yet

---

## 💰 Fee Structure (Critical!)

| Platform | Fee Structure | Effective Cost |
|----------|--------------|----------------|
| **Polymarket** | 0% trading fee, ~2% on winnings | ~1% average |
| **Kalshi** | 7% on profits (taker), ~5% (maker) | ~6% average |

### Fee Optimization Strategy

```
✅ PREFER: Buy on Polymarket (0% fee) → Sell on Kalshi (7% on profit)
⚠️ CAUTION: Buy on Kalshi (7% fee) → Sell on Polymarket (0%)
```

**Minimum Profit Thresholds:**

- Polymarket → Kalshi trades: **3.0% minimum** (covers ~2% effective fees)
- Kalshi → Polymarket trades: **5.0% minimum** (covers ~7% Kalshi fees)

---

## ⏱️ Timing Patterns

### Best Windows for Opportunities

| Time | Quality | Reason |
|------|---------|--------|
| **News Events (0-5 min)** | 🔥 Excellent | Platforms sync at different speeds |
| **9 AM - 12 PM EST** | ✅ Good | US market open, high activity |
| **Late night (1-4 AM EST)** | ⚠️ Variable | Low liquidity, wider spreads |
| **Weekends** | ❌ Poor | Low volume, slow execution |

### Opportunity Decay Rates

- **1-2% spreads**: Close in 30-60 seconds
- **2-3% spreads**: Close in 60-120 seconds  
- **3-5% spreads**: Close in 2-5 minutes
- **5%+ spreads**: Often false positives or major news events

---

## 📊 Best Market Categories

### Tier 1: Elections & Politics (Best)

- Spreads: 2-8%
- Volume: Very high
- Duration: Opportunities last longer
- Why: Different user bases, retail vs institutional

### Tier 2: Cryptocurrency Prices

- Spreads: 2-5%
- Volume: High, 24/7
- Duration: Brief but frequent
- Why: Polymarket has crypto-native users

### Tier 3: Sports

- Spreads: 1-3%
- Volume: Medium
- Duration: Very brief
- Why: Both platforms have sports bettors

### Tier 4: Economic/Finance (Avoid)

- Spreads: 0.5-2%
- Volume: Low-Medium
- Why: Professional traders keep it efficient

---

## 🔧 Recommended Settings

### Current Optimized Parameters

```python
# In paper_trader_realistic.py / database config

# False Positive Filter
MAX_REALISTIC_SPREAD_PCT = 12.0   # Reject spreads > 12%

# Minimum Profit (after costs)
MIN_PROFIT_THRESHOLD_PCT = 5.0    # Only quality opportunities

# Data Freshness
max_data_age_seconds = 10.0       # Reduce from 30s → 10s

# Execution Simulation
SLIPPAGE_MIN_PCT = 0.2
SLIPPAGE_MAX_PCT = 1.0
SPREAD_COST_PCT = 0.5
EXECUTION_FAILURE_RATE = 0.15     # 15% fail rate
PARTIAL_FILL_CHANCE = 0.15
PARTIAL_FILL_MIN_PCT = 0.70

# Resolution Risk (true arbitrage rarely loses)
RESOLUTION_LOSS_RATE = 0.08       # 8% chance of loss
LOSS_SEVERITY_MIN = 0.10          # 10% loss minimum
LOSS_SEVERITY_MAX = 0.40          # 40% loss maximum

# Position Sizing
MAX_POSITION_PCT = 5.0            # 5% of balance max
MAX_POSITION_USD = 50.0           # $50 max per trade
MIN_POSITION_USD = 5.0            # $5 minimum
```

---

## 🚀 Advanced Strategies

### Strategy 1: News Event Arbitrage

When major news breaks:

1. Monitor Polymarket for sudden price moves
2. Compare to Kalshi (likely hasn't moved yet)
3. Execute quickly (5-60 second window)

### Strategy 2: Market Making Hybrid

Instead of pure arbitrage:

1. Place maker orders on Polymarket (earn liquidity rewards)
2. When your order fills AND arb exists, immediately exit on Kalshi
3. Earn ~10-15% APR from market making + arb profits

### Strategy 3: Category Rotation

Focus on different categories at different times:

- **Mornings**: Elections/Politics (DC waking up)
- **Evenings**: Sports (game times)
- **24/7**: Crypto (always active)
- **Event-driven**: Major announcements

### Strategy 4: Asymmetric Minimum Thresholds

```python
def get_min_profit_threshold(buy_platform: str) -> float:
    """Different thresholds based on fee structure."""
    if buy_platform == "polymarket":
        return 3.0  # Lower threshold - cheaper to buy
    else:  # kalshi
        return 5.0  # Higher threshold - expensive fees
```

---

## 📈 Key Metrics to Watch

### Health Indicators

| Metric | Good | Warning | Bad |
|--------|------|---------|-----|
| Win Rate | >60% | 50-60% | <50% |
| Sharpe Ratio | >1.5 | 1.0-1.5 | <1.0 |
| Execution Success | >80% | 70-80% | <70% |
| Avg Win/Avg Loss | >1.5 | 1.0-1.5 | <1.0 |

### What Kills Profitability

1. **Fees**: 9% combined drag if not optimized
2. **Slippage**: Markets move before you execute
3. **False Positives**: Unrelated markets matched incorrectly
4. **Slow Data**: Stale prices = failed trades
5. **Partial Fills**: Can't complete both legs

---

## 🔮 Future Enhancements

### Short Term

- [ ] Implement asymmetric profit thresholds (buy platform aware)
- [ ] Add category-based filtering priority
- [ ] Reduce data age threshold to 10 seconds
- [ ] Track opportunity decay rates

### Medium Term

- [ ] News event detection integration
- [ ] Market making on low-fee side
- [ ] WebSocket for both platforms (reduce latency)
- [ ] Auto-adjust thresholds based on market conditions

### Long Term

- [ ] ML-based false positive detection
- [ ] Cross-market correlation scoring
- [ ] Automated strategy switching
- [ ] Multi-leg arbitrage (3+ platforms)

---

## 📚 References

1. **"Price Discovery and Trading in Prediction Markets"** - Ng et al., 2025 (SSRN)
   - First rigorous cross-market study
   - Confirms Polymarket leads Kalshi in price discovery
   - Documents arbitrage during 2024 election

2. **Polymarket API Docs**: <https://docs.polymarket.com>
3. **Kalshi API Docs**: <https://trading-api.readme.io>

---

*Last Updated: December 2025*
