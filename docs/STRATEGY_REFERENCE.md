# PolyBot Strategy Reference

Complete reference for all 25+ automated trading strategies available in PolyBot.

---

## 📊 Strategy Summary

| Category | Strategy | Confidence | Expected APY | Platform |
|----------|----------|-----------|--------------|----------|
| **Prediction** | Market Making | 85% | 10-20% | Polymarket/Kalshi |
| **Prediction** | News Arbitrage | 75% | 5-30%/event | Polymarket/Kalshi |
| **Prediction** | BTC Bracket Arb | 85% | $20K-200K/mo | Kalshi |
| **Prediction** | Bracket Compression | 70% | 15-30% | Kalshi |
| **Prediction** | Kalshi Mention Snipe | 80% | Event-based | Kalshi |
| **Prediction** | Macro Board | 65% | 15-25% | Polymarket |
| **Prediction** | Fear Premium Contrarian | 70% | 20-40% | Polymarket |
| **Prediction** | Political Event | 80% | Event-based | Polymarket |
| **Prediction** | High Conviction | 85% | 20-40% | Polymarket |
| **Crypto** | Funding Rate Arb | 85% | 15-50% | CCXT (Binance, Bybit) |
| **Crypto** | Grid Trading | 75% | 20-60% | CCXT |
| **Crypto** | Pairs Trading | 65% | 10-25% | CCXT |
| **Crypto** | 15-Min Scalping | 90% | 30-80% | Kalshi/Polymarket |
| **Stock** | Mean Reversion | 70% | 15-30% | Alpaca |
| **Stock** | Momentum | 70% | 20-40% | Alpaca |
| **Stock** | Sector Rotation | 70% | 15-25% | Alpaca |
| **Stock** | Dividend Growth | 65% | 10-20% | Alpaca |
| **Stock** | Earnings Momentum | 70% | 20-40% | Alpaca |
| **Stock** | Congressional Tracker | 75% | 15-30% | Alpaca |
| **Options** | Covered Calls | 75% | 15-25% | IBKR |
| **Options** | Cash Secured Puts | 75% | 15-25% | IBKR |
| **Options** | Iron Condor | 70% | 20-30% | IBKR |
| **Options** | Wheel Strategy | 80% | 20-35% | IBKR |
| **Copy** | Whale Copy Trading | 75% | 20-50% | Polymarket |
| **Copy** | Selective Whale Copy | 80% | 25-60% | Polymarket |
| **AI** | AI Superforecasting | 85% | 25-50% | Polymarket |

---

## 🎯 Prediction Market Strategies

### Market Making

**Confidence: 85% | APY: 10-20%**

Provide liquidity on Polymarket/Kalshi markets, earning the bid-ask spread plus liquidity rewards.

**Config:**

```python
enable_market_maker = True
mm_spread_pct = 0.02          # 2% spread
mm_order_size = 100           # $100 per order
mm_refresh_interval_sec = 30  # Refresh every 30s
```

**How it works:**

1. Places buy and sell orders at spread from mid-price
2. Earns spread when orders fill on both sides
3. Earns USDC rewards from Polymarket
4. Automatically rebalances inventory

---

### News Arbitrage

**Confidence: 75% | APY: 5-30% per event**

Trade the lag between real-world news events and prediction market prices.

**Config:**

```python
enable_news_arbitrage = True
news_arb_confidence_threshold = 0.7
news_arb_max_position = 500   # Max $500 per event
```

**How it works:**

1. Monitors news APIs (Finnhub, NewsAPI) for breaking news
2. Matches news to active prediction markets
3. Trades when news provides clear directional signal
4. Exits when market price adjusts

---

### BTC Bracket Arbitrage

**Confidence: 85% | Expected: $20K-200K/month**

Exploits inefficiencies in Kalshi's 15-minute BTC price brackets.

**Config:**

```python
enable_btc_bracket_arb = True
btc_bracket_min_edge = 0.05   # Min 5% edge
btc_bracket_position_size = 1000
```

**How it works:**

1. Monitors all active BTC price brackets
2. Identifies mispriced brackets (YES + NO != 100%)
3. Buys underpriced bracket, sells overpriced
4. Profit when one bracket expires ITM

---

### Congressional Tracker

**Confidence: 75% | APY: 15-30%**

Copy trades made by US Congress members (they outperform the S&P 500).

**Config:**

```python
enable_congressional_tracker = True
congressional_min_trade_value = 15000
congressional_follow_delay_hours = 24
congressional_exclude_members = []
```

**How it works:**

1. Monitors House/Senate Stock Watcher API
2. Filters for significant trades ($15K+)
3. Mirrors buys within 24-48 hours
4. Tracks portfolio performance vs benchmark

---

## 💰 Crypto Strategies

### Funding Rate Arbitrage

**Confidence: 85% | APY: 15-50%**

Delta-neutral strategy collecting perpetual funding payments.

**Config:**

```python
enable_funding_rate_arb = True
fra_symbols = ["BTC/USDT", "ETH/USDT"]
fra_min_funding_rate = 0.0001  # 0.01%
fra_position_size_pct = 0.10   # 10% of portfolio
```

**How it works:**

1. Long spot + short perp (or vice versa)
2. Collect funding every 8 hours
3. Position is market-neutral
4. Close when funding turns negative

---

### Grid Trading

**Confidence: 75% | APY: 20-60%**

Profit from price oscillation in range-bound markets.

**Config:**

```python
enable_grid_trading = True
grid_symbol = "ETH/USDT"
grid_upper_price = 2500
grid_lower_price = 2000
grid_levels = 10
grid_investment = 1000
```

**How it works:**

1. Places buy orders below current price
2. Places sell orders above current price
3. Each grid fill triggers opposite order
4. Profits from each oscillation

---

### Pairs Trading

**Confidence: 65% | APY: 10-25%**

Statistical arbitrage on correlated crypto pairs.

**Config:**

```python
enable_pairs_trading = True
pairs_symbols = [("BTC/USDT", "ETH/USDT")]
pairs_z_score_entry = 2.0
pairs_z_score_exit = 0.5
```

**How it works:**

1. Monitors price ratio of correlated pairs
2. Long underperformer, short outperformer when ratio diverges
3. Exit when ratio returns to mean
4. Market-neutral position

---

## 📈 Stock Strategies

### Stock Mean Reversion

**Confidence: 70% | APY: 15-30%**

Buy oversold stocks, sell when they revert to mean.

**Config:**

```python
enable_stock_mean_reversion = True
stock_mr_rsi_oversold = 30
stock_mr_rsi_overbought = 70
stock_mr_position_size = 1000
```

**How it works:**

1. Scans for stocks with RSI < 30
2. Buys with profit target at RSI 50
3. Stop loss at -5%
4. Holds 1-5 days typically

---

### Stock Momentum

**Confidence: 70% | APY: 20-40%**

Ride trending stocks with strong momentum.

**Config:**

```python
enable_stock_momentum = True
stock_mom_min_momentum = 0.10  # 10% 20-day return
stock_mom_position_size = 1000
stock_mom_trailing_stop = 0.05
```

**How it works:**

1. Ranks stocks by momentum score
2. Buys top performers
3. Trails with 5% stop loss
4. Rotates to new leaders weekly

---

### Sector Rotation

**Confidence: 70% | APY: 15-25%**

Rotate into strongest performing sectors via ETFs.

**Config:**

```python
enable_sector_rotation = True
sector_rotation_interval_sec = 3600  # Check hourly
sector_rotation_top_n = 3            # Hold top 3 sectors
```

**Sectors tracked:**

- XLK (Technology)
- XLF (Financials)
- XLE (Energy)
- XLV (Healthcare)
- XLI (Industrials)
- XLY (Consumer Discretionary)
- XLP (Consumer Staples)
- XLU (Utilities)
- XLRE (Real Estate)
- XLB (Materials)
- XLC (Communications)

---

### Dividend Growth

**Confidence: 65% | APY: 10-20%**

Accumulate dividend aristocrats with growing yields.

**Config:**

```python
enable_dividend_growth = True
dividend_growth_interval_sec = 86400  # Daily check
dividend_min_yield = 0.02             # 2% min yield
dividend_min_growth_years = 10        # 10+ years of increases
```

**Universe:**

- Dividend Aristocrats (25+ years of increases)
- Dividend Kings (50+ years of increases)
- Quality filters (payout ratio, debt/equity)

---

### Earnings Momentum

**Confidence: 70% | APY: 20-40%**

Trade post-earnings announcement drift (PEAD).

**Config:**

```python
enable_earnings_momentum = True
earnings_momentum_interval_sec = 3600
earnings_min_surprise_pct = 0.05      # 5% earnings beat
earnings_hold_days = 20               # Hold 20 days post-earnings
```

**How it works:**

1. Monitors earnings calendar
2. Identifies positive earnings surprises
3. Buys stocks that beat by 5%+
4. Holds for drift period (20-60 days)

---

## 📝 Options Strategies

### Covered Calls

**Confidence: 75% | APY: 15-25%**

Sell calls against existing stock positions.

**Config:**

```python
enable_covered_calls = True
covered_calls_interval_sec = 3600
cc_delta_target = 0.30        # 30 delta calls
cc_dte_range = (21, 45)       # 21-45 days to expiration
```

**How it works:**

1. Own 100 shares of stock
2. Sell OTM call option
3. Keep premium if stock stays below strike
4. Stock called away if above strike (keep premium + profit)

---

### Cash Secured Puts

**Confidence: 75% | APY: 15-25%**

Sell puts backed by cash to acquire stocks at discount.

**Config:**

```python
enable_cash_secured_puts = True
csp_interval_sec = 3600
csp_delta_target = 0.25       # 25 delta puts
csp_dte_range = (21, 45)
```

**How it works:**

1. Sell OTM put option
2. Keep cash to cover assignment
3. Keep premium if stock stays above strike
4. Get assigned at discount if below strike

---

### Iron Condor

**Confidence: 70% | APY: 20-30%**

Sell OTM call and put spreads for premium.

**Config:**

```python
enable_iron_condor = True
iron_condor_interval_sec = 3600
ic_wing_width = 5             # $5 wide wings
ic_delta_target = 0.15        # 15 delta shorts
ic_dte_range = (30, 45)
```

**How it works:**

1. Sell OTM call spread (bearish)
2. Sell OTM put spread (bullish)
3. Profit if stock stays in range
4. Max profit = premium collected

---

### Wheel Strategy

**Confidence: 80% | APY: 20-35%**

Systematic income generation via CSP → CC cycle.

**Config:**

```python
enable_wheel_strategy = True
wheel_interval_sec = 3600
wheel_stocks = ["AAPL", "MSFT", "GOOGL"]
wheel_delta = 0.30
```

**How it works:**

1. Sell CSP → collect premium
2. If assigned → sell CC
3. If called away → sell CSP again
4. Continuous income cycle

---

## 🤖 AI & Copy Strategies

### AI Superforecasting

**Confidence: 85% | APY: 25-50%**

Gemini-powered prediction market analysis.

**Config:**

```python
enable_ai_superforecasting = True
ai_forecast_model = "gemini-1.5-pro"
ai_forecast_confidence_threshold = 0.75
```

**How it works:**

1. Fetches market questions
2. Researches via web search
3. Generates probability forecast
4. Trades when edge > threshold

---

### Whale Copy Trading

**Confidence: 75% | APY: 20-50%**

Track and copy profitable Polymarket wallets.

**Config:**

```python
enable_whale_copy_trading = True
whale_min_win_rate = 0.55
whale_min_profit = 10000
whale_copy_delay_sec = 60
```

**How it works:**

1. Monitors whale wallet activity
2. Filters by historical profitability
3. Copies trades with delay
4. Position sizes proportionally

---

### Selective Whale Copy

**Confidence: 80% | APY: 25-60%**

Enhanced whale copying with performance filtering.

**Config:**

```python
enable_selective_whale_copy = True
selective_whale_min_roi = 0.50    # 50% min ROI
selective_whale_min_trades = 50   # 50+ trades
selective_whale_lookback_days = 90
```

**How it works:**

1. Ranks whales by ROI, win rate, Sharpe
2. Only copies top performers
3. Weights by recent performance
4. Avoids whales in drawdown

---

## 🛡️ Risk Management Frameworks

All strategies integrate with these risk management modules:

### Kelly Position Sizing

```python
kelly_sizing_enabled = True
kelly_fraction = 0.25         # Use 25% of Kelly
kelly_max_position_pct = 0.10 # Max 10% per position
```

### Circuit Breaker

```python
circuit_breaker_enabled = True
circuit_breaker_daily_loss_pct = 0.05   # Pause at 5% daily loss
circuit_breaker_weekly_loss_pct = 0.10  # Pause at 10% weekly loss
```

### Regime Detection

```python
regime_detection_enabled = True
regime_reduce_position_bear = 0.50  # 50% position size in bear
regime_pause_in_crisis = True       # Pause trading in crisis
```

---

## 📁 File Locations

| Strategy | File |
|----------|------|
| Market Making | `src/strategies/market_maker_v2.py` |
| News Arbitrage | `src/strategies/news_arbitrage.py` |
| Funding Rate Arb | `src/strategies/funding_rate_arb.py` |
| Grid Trading | `src/strategies/grid_trading.py` |
| Pairs Trading | `src/strategies/pairs_trading.py` |
| Stock Mean Reversion | `src/strategies/stock_mean_reversion.py` |
| Stock Momentum | `src/strategies/stock_momentum.py` |
| Sector Rotation | `src/strategies/sector_rotation.py` |
| Dividend Growth | `src/strategies/dividend_growth.py` |
| Earnings Momentum | `src/strategies/earnings_momentum.py` |
| Options (all) | `src/strategies/options_strategies.py` |
| BTC Bracket Arb | `src/strategies/btc_bracket_arb.py` |
| Whale Copy | `src/strategies/whale_copy_trading.py` |
| Congressional | `src/strategies/congressional_tracker.py` |
| AI Superforecasting | `src/strategies/ai_superforecasting.py` |
| Position Sizing | `src/strategies/position_sizing.py` |
| Circuit Breaker | `src/strategies/circuit_breaker.py` |
| Regime Detection | `src/strategies/regime_detection.py` |

---

## ⚙️ Enabling Strategies

All strategies are enabled via the `polybot_settings` table in Supabase:

```sql
UPDATE polybot_settings
SET enable_funding_rate_arb = true,
    enable_grid_trading = true,
    enable_stock_momentum = true
WHERE user_id = 'YOUR_USER_ID';
```

Or via the Admin Dashboard: **Settings → Trading Strategies**

---

## 📊 Strategy Performance Tracking

All strategy performance is logged to:

- `polybot_trades` - Individual trade records
- `polybot_positions` - Current open positions
- `polybot_analytics` - Aggregated performance metrics
- `polybot_heartbeat` - Strategy health status

View in Admin Dashboard: **Dashboard → Performance**

---

*Last updated: January 2025*
