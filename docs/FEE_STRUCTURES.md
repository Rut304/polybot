# PolyBot Fee Structures & Trading Phases

**Last Updated:** December 8, 2025

---

## 📊 Complete Fee Structure Reference

### Prediction Markets

| Platform | Fee Type | Rate | When Charged | Notes |
|----------|----------|------|--------------|-------|
| **Polymarket** | Trading | **0%** | Never | Peer-to-peer, no house |
| **Kalshi** | Settlement | **7%** | On profits only | Not on losses |

### Crypto Spot Exchanges

| Exchange | Maker Fee | Taker Fee | Notes |
|----------|-----------|-----------|-------|
| **Binance.US** | 0.10% | 0.10% | 0.075% with BNB discount |
| **Coinbase Advanced** | 0.60% | 1.20% | Volume discounts available |
| **Coinbase (regular)** | 0.50% spread | + fees | Higher total cost |
| **Kraken** | 0.16% | 0.26% | Volume-based tiers |
| **Bybit** | 0.10% | 0.10% | VIP discounts available |
| **OKX** | 0.08% | 0.10% | VIP discounts available |
| **KuCoin** | 0.10% | 0.10% | Standard tier |

### Crypto Futures/Perpetuals

| Exchange | Maker Fee | Taker Fee | Funding | Notes |
|----------|-----------|-----------|---------|-------|
| **Binance Futures** | 0.02% | 0.04% | Every 8h | Most liquid |
| **Bybit Derivatives** | 0.01% | 0.06% | Every 8h | Low maker fees |
| **OKX Perpetuals** | 0.02% | 0.05% | Every 8h | Competitive |

### Stock Brokers

| Broker | Commission | SEC Fee | Notes |
|--------|------------|---------|-------|
| **Alpaca** | **$0** | ~$0.000008/share (sells) | Commission-free |
| **IBKR Lite** | **$0** | Regulatory fees | Free tier |
| **IBKR Pro** | $0.005/share | Min $1 per order | Active traders |

---

## 🎯 Trading Phases

### Phase 1: Simulation Mode (CURRENT)

**Status:** ✅ Active

**Goals:**

- Validate all strategies with realistic fee calculations
- Build confidence in P&L projections
- Test execution logic without capital risk

**Metrics to Track:**

- Win Rate (target: >70%)
- Payoff Ratio (target: >1.0)
- Sharpe Ratio (target: >1.5)
- Max Drawdown (target: <15%)

**What's Working:**

- ✅ Polymarket single-platform arbitrage (83.7% win rate)
- ✅ Kalshi single-platform arbitrage
- ✅ Cross-platform arbitrage detection
- ✅ Accurate fee simulation for all platforms

**In Development:**

- 🔄 Funding Rate Arbitrage simulation
- 🔄 Grid Trading simulation
- 🔄 Stock Mean Reversion simulation

### Phase 2: Paper Trading (Live APIs, Fake Money)

**Status:** 🔜 Next Phase

**Prerequisites:**

- [ ] All strategies passing simulation with positive expectancy
- [ ] API connections tested (Alpaca paper, exchange sandboxes)
- [ ] Risk management controls implemented
- [ ] Position sizing validated

**Execution Plan:**

1. Enable Alpaca paper trading for stocks
2. Use Binance.US testnet for crypto
3. Run parallel simulation + paper for 2 weeks
4. Compare results to identify gaps

### Phase 3: Live Trading (Real Money)

**Status:** 📋 Planned

**Prerequisites:**

- [ ] Phase 2 paper trading profitable for 30+ days
- [ ] All API keys configured for live trading
- [ ] Coinbase/Kraken live accounts funded
- [ ] Alpaca live account approved
- [ ] Circuit breakers tested
- [ ] Position limits set conservatively

**Rollout Plan:**

1. Start with smallest position sizes ($10-25)
2. Enable ONE strategy at a time
3. Monitor for 7 days before adding next
4. Scale up position sizes gradually

**Order of Strategy Activation:**

1. Polymarket Single Arb (lowest risk, 0% fees)
2. Stock Mean Reversion (Alpaca, $0 commission)
3. Funding Rate Arb (delta-neutral)
4. Kalshi Arb (higher fees, careful sizing)
5. Grid Trading (capital-intensive)

### Phase 2A: SaaS Productization

**Status:** 💡 Future Roadmap

**Concept:**

- Multi-tenant platform
- Users configure their own API keys
- Subscription or profit-sharing model

**Requirements:**

- [ ] User authentication system
- [ ] Tenant isolation
- [ ] API key encryption
- [ ] Usage metering
- [ ] Billing integration

### Phase 2B: Managed Trading Service

**Status:** 💡 Future Roadmap

**Concept:**

- We manage trading on behalf of users
- Pool capital or individual accounts
- Performance fees (20% of profits typical)

**Requirements:**

- [ ] Regulatory compliance review
- [ ] Investment advisor registration (if required)
- [ ] Audited track record
- [ ] Legal agreements

---

## 🔧 Fee Configuration in Code

### Location

```
src/simulation/paper_trader_realistic.py
```

### Fee Constants (Lines 217-279)

```python
# Prediction Markets
POLYMARKET_FEE_PCT = 0.0      # 0% trading fees
KALSHI_FEE_PCT = 7.0          # 7% on profits at settlement

# Crypto Spot Exchanges
BINANCE_US_MAKER_FEE_PCT = 0.10
BINANCE_US_TAKER_FEE_PCT = 0.10
COINBASE_MAKER_FEE_PCT = 0.60
COINBASE_TAKER_FEE_PCT = 1.20
# ... etc

# Stock Brokers
ALPACA_COMMISSION_USD = 0.0
ALPACA_SEC_FEE_PER_SHARE = 0.000008
```

### Fee Calculation Method

```python
def calculate_platform_fee(
    self,
    platform: str,
    trade_value: Decimal,
    gross_profit: Decimal,
    is_maker: bool = False,
    is_futures: bool = False,
    asset_type: str = "prediction",
) -> Decimal:
```

### Simulation Methods

```python
# Prediction Market Arbitrage
await paper_trader.simulate_opportunity(...)

# Crypto Trading
await paper_trader.simulate_crypto_trade(...)

# Stock Trading  
await paper_trader.simulate_stock_trade(...)

# Funding Rate Arbitrage
await paper_trader.simulate_funding_trade(...)
```

---

## 📈 Fee Impact Analysis

### Example: $100 Trade Across Platforms

| Platform | Fees on $100 Trade | Net on 5% Profit |
|----------|-------------------|------------------|
| Polymarket | $0.00 | $5.00 |
| Kalshi | $0.35 (7% of $5) | $4.65 |
| Coinbase (taker) | $1.20 | $3.80 |
| Binance.US | $0.20 | $4.80 |
| Alpaca | ~$0.01 | $4.99 |

### Break-Even Analysis by Platform

| Platform | Min Profit % to Break Even |
|----------|---------------------------|
| Polymarket | 0% (no fees) |
| Alpaca | ~0.001% (negligible) |
| Binance.US | 0.2% (round trip) |
| Kalshi | 0% (fees only on profit) |
| Coinbase | 2.4% (round trip taker) |

---

## 🚨 Risk Considerations

### Fee-Related Risks

1. **Coinbase high fees** - Only use for large positions where % impact is smaller
2. **Kalshi settlement timing** - Fees charged at market resolution, not trade time
3. **Maker vs Taker** - Use limit orders to save 0.1-0.6% on crypto

### Platform-Specific Risks

1. **Binance.US geo-blocking** - AWS regions may be blocked
2. **Coinbase API rate limits** - 10 req/sec for public, 15 for private
3. **Alpaca market hours** - Stocks only 9:30 AM - 4 PM ET

---

## 📚 Sources

- Polymarket: <https://docs.polymarket.com/polymarket-learn/trading/fees>
- Kalshi: <https://help.kalshi.com/trading/fees>
- Binance.US: <https://www.binance.us/fees>
- Coinbase: <https://www.coinbase.com/advanced-fees>
- Kraken: <https://www.kraken.com/features/fee-schedule>
- Alpaca: <https://alpaca.markets/docs/trading/orders/>

---

*This document is auto-maintained. Update fee constants in `paper_trader_realistic.py` when platforms change their fee structures.*
