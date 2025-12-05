# PolyBot Trading Strategies - Complete Documentation

## Overview

PolyBot is a multi-strategy automated trading system that operates across two main asset classes:

1. **Prediction Markets** - Polymarket (0% fees) and Kalshi (7% fees)
2. **Crypto Exchanges** - Via CCXT library (Binance, Bybit, OKX, Kraken, Coinbase, KuCoin)

---

## 📊 Strategy Summary

| Strategy | Confidence | Expected APY | Risk | Category | Platforms |
|----------|------------|--------------|------|----------|-----------|
| Single-Platform Arb | 95% | 50-200% | Low | Prediction | Polymarket, Kalshi |
| Cross-Platform Arb | 90% | 30-100% | Low | Prediction | Polymarket, Kalshi |
| Funding Rate Arb | 85% | 15-50% | Low | Crypto | Binance, Bybit, OKX |
| Grid Trading | 75% | 20-60% | Medium | Crypto | All CCXT Exchanges |
| Market Making | 75% | 10-20% | Medium | Prediction | Polymarket |
| Copy Trading | 70% | 20-50% | Medium | Prediction | Polymarket |
| Pairs Trading | 65% | 10-25% | Medium | Crypto | All CCXT Exchanges |
| News Arbitrage | 60% | 5-30%/event | High | Prediction | Polymarket, Kalshi |

---

## 🎯 PREDICTION MARKET STRATEGIES

### 1. Single-Platform Arbitrage (95% Confidence)

**Expected Returns:** 50-200% APY  
**Risk Level:** LOW  
**Platforms:** Polymarket, Kalshi

#### Description

Exploit mispricings within a single prediction market by buying both YES and NO outcomes when their combined price is less than $1.00. This guarantees a profit regardless of the market outcome.

#### How It Works

1. Scan all active markets on Polymarket/Kalshi every 60 seconds
2. Calculate YES price + NO price for each market
3. If combined price < threshold (e.g., 99.5%), an arbitrage opportunity exists
4. Execute simultaneous buy orders for both YES and NO
5. Wait for market resolution - one side wins, you collect $1.00
6. Profit = $1.00 - (YES cost + NO cost)

#### Key Points

- **Zero directional risk** - You profit regardless of the outcome
- **Rare opportunities** - Mispricings are quickly corrected
- **Polymarket advantage** - 0% fees means smaller spreads are profitable
- **Kalshi constraint** - 7% fee on profits requires larger spreads (>7%)
- **Academic validation** - Research shows $40M+ extracted via this strategy in 1 year

#### Configuration Parameters

```
poly_single_min_profit_pct: 0.5     # Min profit threshold for Polymarket
poly_single_max_spread_pct: 5.0     # Max bid-ask spread to consider
poly_single_max_position_usd: 500   # Max position per opportunity
kalshi_single_min_profit_pct: 8.0   # Min profit for Kalshi (>7% fees)
kalshi_single_max_spread_pct: 3.0   # Tighter spread requirement
```

#### Required Credentials

- `WALLET_ADDRESS` - Polymarket wallet address
- `PRIVATE_KEY` - Polymarket signing key
- `KALSHI_API_KEY` - Kalshi API key (optional)
- `KALSHI_PRIVATE_KEY` - Kalshi private key (optional)

---

### 2. Cross-Platform Arbitrage (90% Confidence)

**Expected Returns:** 30-100% APY  
**Risk Level:** LOW  
**Platforms:** Polymarket + Kalshi

#### Description

Exploit price differences between Polymarket and Kalshi for the same event. When YES on Polymarket is cheaper than NO on Kalshi (or vice versa), execute trades on both platforms for a guaranteed profit.

#### How It Works

1. Fetch active markets from both Polymarket and Kalshi
2. Match similar events using fuzzy string matching (question similarity)
3. Compare YES prices across platforms
4. Calculate spread after accounting for Kalshi's 7% fee
5. If spread > threshold, execute cross-platform trade
6. Wait for resolution - you hold opposite positions that cancel out

#### Key Points

- **Asymmetric fees** - Buy on Polymarket (0%) preferred over Kalshi (7%)
- **Event matching** - Must find identical events across platforms
- **Settlement risk** - Both platforms must resolve the same way
- **Capital efficiency** - Requires funds on both platforms

#### Configuration Parameters

```
cross_plat_min_profit_buy_poly_pct: 3.0    # Min when buying on Poly
cross_plat_min_profit_buy_kalshi_pct: 10.0 # Min when buying on Kalshi (higher due to fees)
cross_plat_max_position_usd: 1000           # Max position per opportunity
```

#### Required Credentials

- All Polymarket credentials (see above)
- All Kalshi credentials (see above)

---

### 3. Market Making (75% Confidence)

**Expected Returns:** 10-20% APY  
**Risk Level:** MEDIUM  
**Platforms:** Polymarket

#### Description

Provide liquidity to prediction markets by placing limit orders on both the bid and ask sides. Earn the spread each time both orders get filled.

#### How It Works

1. Select high-volume markets (>$5,000 24h volume)
2. Calculate fair value from current order book
3. Place bid order below fair value
4. Place ask order above fair value
5. When bid fills, place a new ask at higher price
6. When ask fills, place a new bid at lower price
7. Adjust quote sizes based on inventory position

#### Key Points

- **Spread capture** - Earn 1-5% on each round trip
- **Inventory risk** - Can get stuck with one-sided position
- **Active management** - Requires constant quote refreshing (every 30s)
- **Market selection** - Best on high-volume, volatile markets
- **Capital intensive** - Same capital backs both sides

#### Configuration Parameters

```
enable_market_making: true/false
mm_target_spread_bps: 300           # Target 3% spread
mm_min_spread_bps: 100              # Minimum 1% spread
mm_max_spread_bps: 1000             # Maximum 10% spread
mm_order_size_usd: 50               # Size per quote
mm_max_inventory_usd: 500           # Max one-sided inventory
mm_inventory_skew_factor: 0.5       # How much to skew quotes
mm_quote_refresh_sec: 30            # Refresh frequency
```

#### Required Credentials

- Polymarket wallet + private key

---

### 4. News Arbitrage (60% Confidence)

**Expected Returns:** 5-30% per event  
**Risk Level:** HIGH  
**Platforms:** Polymarket, Kalshi

#### Description

React to breaking news faster than the market. When news breaks that affects a prediction market outcome, trade before prices fully adjust.

#### How It Works

1. Monitor news feeds (NewsAPI, Twitter, RSS)
2. Match news keywords to active prediction markets
3. Analyze sentiment and likely market impact
4. Execute trades within minutes of news breaking
5. Set stop-losses to manage risk if interpretation is wrong

#### Key Points

- **Speed critical** - Minutes matter, not hours
- **Interpretation risk** - News impact can be misread
- **High reward** - Can capture 10-50% moves
- **Keyword matching** - Link news to relevant markets
- **Short holding period** - Exit when market adjusts

#### Configuration Parameters

```
enable_news_arbitrage: true/false
news_min_spread_pct: 5.0            # Min price move to trade
news_max_lag_minutes: 30            # Max time since news broke
news_position_size_usd: 100         # Conservative sizing
news_scan_interval_sec: 60          # Check every minute
news_keywords: "election,fed,trump,biden,crypto,bitcoin"
```

#### Required Credentials

- Trading platform credentials
- `NEWS_API_KEY` - NewsAPI.org key
- `TWITTER_BEARER_TOKEN` - Twitter API (optional)

---

### 5. Copy Trading (70% Confidence)

**Expected Returns:** 20-50% APY  
**Risk Level:** MEDIUM  
**Platforms:** Polymarket

#### Description

Automatically copy trades from successful "whale" traders. Leverage their research and conviction by mirroring their positions at a configurable scale.

#### How It Works

1. Monitor specified wallet addresses for new positions
2. Detect when a tracked trader opens a position
3. Calculate your position size (e.g., 10% of their size)
4. Execute the same trade with slight delay
5. Track performance vs original trader

#### Key Points

- **Whale following** - Copy traders with proven track records
- **Transparent data** - Polymarket trades are on-chain
- **Configurable scale** - Set your copy multiplier
- **Delay inherent** - You trade after them
- **Address curation** - Finding good traders is key

#### Configuration Parameters

```python
tracked_traders = [
    {"address": "0x...", "name": "Whale1", "multiplier": 0.1},
    {"address": "0x...", "name": "Whale2", "multiplier": 0.05},
]
```

#### Required Credentials

- Polymarket wallet + private key

---

## ₿ CRYPTO STRATEGIES

### 6. Funding Rate Arbitrage (85% Confidence)

**Expected Returns:** 15-50% APY  
**Risk Level:** LOW  
**Platforms:** Binance, Bybit, OKX

#### Description

Collect perpetual futures funding payments by holding delta-neutral positions. When funding is positive (longs pay shorts), go long spot and short perpetual to earn funding without directional risk.

#### How It Works

1. Scan funding rates across all supported exchanges
2. Filter for rates > 0.03% per 8 hours (~30% APY)
3. Calculate optimal position size based on limits
4. Buy spot asset (or long with 1x leverage)
5. Short an equivalent amount on perpetual futures
6. Collect funding every 8 hours
7. Exit when funding turns negative or spread narrows

#### Key Points

- **Delta neutral** - No exposure to price direction
- **Structural alpha** - Retail longs create persistent positive funding
- **Math-based** - Earning a fee, not predicting direction
- **Historical data** - BTC funding averages 0.01%/8h = 10.95% APY base
- **Leverage management** - Keep futures leverage low (2-3x max)

#### Academic Support

- "Statistical Arbitrage in Cryptocurrency Markets" (Journal of Finance)
- Binance historical funding data shows consistent positive rates

#### Configuration Parameters

```
enable_funding_rate_arb: true/false
funding_min_rate_pct: 0.03          # Min 0.03% per 8h
funding_min_apy: 30.0               # Min 30% annualized
funding_max_position_usd: 1000      # Max per position
funding_max_positions: 3            # Max concurrent positions
funding_max_leverage: 3             # Futures leverage limit
funding_scan_interval_sec: 300      # Scan every 5 minutes
```

#### Required Credentials

- `BINANCE_API_KEY` + `BINANCE_API_SECRET`
- `BYBIT_API_KEY` + `BYBIT_API_SECRET`
- `OKX_API_KEY` + `OKX_API_SECRET` + `OKX_PASSPHRASE`

#### Exchange Requirements

- Futures trading must be enabled
- Sufficient margin/collateral deposited
- API permissions for spot + futures trading

---

### 7. Grid Trading (75% Confidence)

**Expected Returns:** 20-60% APY  
**Risk Level:** MEDIUM  
**Platforms:** All CCXT-supported exchanges

#### Description

Profit from sideways price oscillation by placing a grid of buy orders below current price and sell orders above. Each time price oscillates through the grid, you capture profit.

#### How It Works

1. Select an asset with sideways/ranging price action
2. Define price range (e.g., ±10% from current)
3. Divide range into levels (e.g., 20 levels)
4. Place buy limit orders at each level below current price
5. Place sell limit orders at each level above current price
6. When a buy fills, immediately place a sell at the next level up
7. When a sell fills, immediately place a buy at the next level down
8. Each complete round-trip (buy + sell) generates profit

#### Key Points

- **Range-bound profit** - Works best when price oscillates
- **Trend risk** - Can lose money in strong up/down trends
- **Automation required** - Orders must be placed immediately on fills
- **Level optimization** - More levels = more trades but smaller profits each
- **Stop-loss important** - Exit if price breaks out of range

#### Best Assets for Grid Trading

- BTC/USDT - High liquidity, mature market
- ETH/USDT - Second most liquid
- Stablecoins pairs during volatility
- Avoid: Low-cap alts, memecoins

#### Configuration Parameters

```
enable_grid_trading: true/false
grid_default_range_pct: 10.0        # ±10% range
grid_default_levels: 20             # Number of grid levels
grid_default_investment_usd: 500    # Capital per grid
grid_max_grids: 3                   # Max concurrent grids
grid_stop_loss_pct: 15.0            # Exit if price breaks out
grid_take_profit_pct: 50.0          # Close if target reached
```

#### Required Credentials

- Any CCXT-supported exchange API keys

---

### 8. Pairs Trading / Statistical Arbitrage (65% Confidence)

**Expected Returns:** 10-25% APY  
**Risk Level:** MEDIUM  
**Platforms:** All CCXT-supported exchanges

#### Description

Trade the spread between two correlated assets. When the spread widens beyond normal (z-score > 2), long the underperformer and short the outperformer, expecting mean reversion.

#### How It Works

1. Calculate rolling 30-day correlation between pair (e.g., BTC/ETH)
2. Compute spread: Price_A - (Beta × Price_B)
3. Calculate mean and standard deviation of spread
4. Compute z-score: (current_spread - mean) / std_dev
5. If z-score > +2: Short A, Long B (A outperformed)
6. If z-score < -2: Long A, Short B (B outperformed)
7. Exit when z-score returns to <0.5
8. Stop-loss if z-score exceeds ±4

#### Key Points

- **Mean reversion** - Spreads tend to return to normal
- **Correlation risk** - Correlation can break down (regime change)
- **Market neutral** - Long + short cancel directional risk
- **Statistical basis** - Backed by academic research
- **Requires shorting** - Need margin/futures capability

#### Best Pairs (Crypto)

- BTC/ETH (correlation ~0.85)
- SOL/AVAX (L1 competitors)
- LINK/UNI (DeFi tokens)
- ATOM/DOT (Cosmos/Polkadot ecosystem)

#### Configuration Parameters

```
enable_pairs_trading: true/false
pairs_entry_zscore: 2.0             # Enter when |z| > 2
pairs_exit_zscore: 0.5              # Exit when |z| < 0.5
pairs_position_size_usd: 500        # Size per leg
pairs_max_positions: 2              # Max concurrent pairs
pairs_max_hold_hours: 72            # Max 3 days holding
```

#### Required Credentials

- Exchange API with margin/futures access

---

## 🔧 REQUIRED CREDENTIALS BY CATEGORY

### Prediction Markets (Polymarket + Kalshi)

```
WALLET_ADDRESS          # Your Polygon wallet address
PRIVATE_KEY             # Wallet private key (never share!)
KALSHI_API_KEY          # Kalshi API key
KALSHI_PRIVATE_KEY      # Kalshi private key file path
```

### Crypto Exchanges (CCXT)

```
# Binance
BINANCE_API_KEY
BINANCE_API_SECRET

# Bybit  
BYBIT_API_KEY
BYBIT_API_SECRET

# OKX
OKX_API_KEY
OKX_API_SECRET
OKX_PASSPHRASE

# Kraken
KRAKEN_API_KEY
KRAKEN_PRIVATE_KEY

# Coinbase
COINBASE_API_KEY
COINBASE_API_SECRET

# KuCoin
KUCOIN_API_KEY
KUCOIN_API_SECRET
KUCOIN_PASSPHRASE
```

### Stock Brokers (Optional)

```
ALPACA_API_KEY
ALPACA_API_SECRET
IBKR_USERNAME
IBKR_PASSWORD
```

### Infrastructure

```
SUPABASE_URL            # Database URL
SUPABASE_ANON_KEY       # Public API key
SUPABASE_SERVICE_KEY    # Admin key (backend only)
```

### Notifications

```
DISCORD_WEBHOOK_URL     # Discord channel webhook
TELEGRAM_BOT_TOKEN      # Telegram bot token
TELEGRAM_CHAT_ID        # Your Telegram chat ID
```

### Data Feeds

```
NEWS_API_KEY            # NewsAPI.org
TWITTER_BEARER_TOKEN    # Twitter API v2
```

---

## ⚠️ RISK MANAGEMENT

### Position Limits

- Each strategy has individual position limits
- Global portfolio exposure limits in config
- Automatic stop-losses on all strategies

### Simulation Mode

- Always test in `simulation_mode: true` first
- Paper trader tracks hypothetical P&L
- No real money at risk

### Strategy Isolation

- Prediction markets and crypto are completely separate
- No position conflicts between categories
- Within crypto: Use different symbols for different strategies

### Recommended Configuration

1. Start with ONE strategy enabled
2. Run in simulation for 1 week minimum
3. Start with minimum position sizes
4. Gradually increase as confidence grows
5. Monitor analytics dashboard daily

---

## 📚 Academic References

1. "Algorithmic Trading of Co-Integrated Assets" - SSRN
2. "Statistical Arbitrage in Cryptocurrency Markets" - Journal of Finance
3. "Market Making in Prediction Markets" - ACM Conference
4. "Funding Rate Dynamics in Perpetual Futures" - Crypto Research Report
5. "Grid Trading Strategy Analysis" - QuantConnect Research

---

*Last Updated: December 2024*
