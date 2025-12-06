# PolyBot - Multi-Asset Algorithmic Trading Platform

**Production-grade trading system for prediction markets, crypto, and stocks**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Executive Summary

PolyBot is a comprehensive algorithmic trading platform that spans **three asset classes**:

| Asset Class | Platforms | Strategies | Confidence |
|-------------|-----------|------------|------------|
| **Prediction Markets** | Polymarket, Kalshi | Single-platform arb, Cross-platform arb, Market Making, News Arbitrage | 70-90% |
| **Crypto** | 106+ via CCXT (Binance, Bybit, Kraken, OKX, etc.) | Funding Rate Arb, Grid Trading, Pairs Trading, DCA | 60-85% |
| **Stocks** | Alpaca (commission-free), Interactive Brokers | Momentum, Pairs Trading, DCA | 55-75% |

**Key Achievement:** PhD-level research identified **$40M+ extracted** from Polymarket arbitrage in 1 year (Saguillo et al., 2025) at 0.3-2% margins.

---

## 📚 Documentation Index

### Core Strategy Documents

| Document | Description |
|----------|-------------|
| [ALGO_TRADING_DEEP_RESEARCH.md](./ALGO_TRADING_DEEP_RESEARCH.md) | 🎓 **PhD-Level Research** - Academic papers, strategy confidence ratings, implementation guides |
| [ARBITRAGE_STRATEGY.md](./ARBITRAGE_STRATEGY.md) | Prediction market arbitrage mechanics |
| [UNIFIED_ARBITRAGE.md](./UNIFIED_ARBITRAGE.md) | Cross-platform arbitrage implementation |
| [PROFITABLE_STRATEGIES.md](./PROFITABLE_STRATEGIES.md) | Ranked strategies by profitability |

### Setup & Operations

| Document | Description |
|----------|-------------|
| [BOT_QUICK_START.md](./BOT_QUICK_START.md) | ⚡ 6-hour implementation guide |
| [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) | Detailed environment setup |
| [MORNING_BRIEFING.md](./MORNING_BRIEFING.md) | Executive summary for operators |

### Infrastructure

| Document | Description |
|----------|-------------|
| [TRADING_BOT_ANALYSIS.md](./TRADING_BOT_ANALYSIS.md) | Competitive analysis of existing bots |
| [AWS_RESOURCE_GUIDE.md](./AWS_RESOURCE_GUIDE.md) | AWS resource allocation guide |
| [LIGHTSAIL_DEPLOYMENT.md](./LIGHTSAIL_DEPLOYMENT.md) | **Bot deployment on Lightsail** |
| [docs/PRODUCTIZATION_ROADMAP.md](./docs/PRODUCTIZATION_ROADMAP.md) | Scaling to SaaS |
| [docs/ARBITRAGE_STRATEGY_ANALYSIS.md](./docs/ARBITRAGE_STRATEGY_ANALYSIS.md) | Deep-dive on arbitrage math |

---

## 🏗️ Architecture

```
polybot/
├── src/
│   ├── main.py                  # Entry point
│   ├── bot_runner.py            # Main trading loop
│   ├── config.py                # All strategy parameters (Admin UI controlled)
│   ├── strategies/
│   │   ├── market_maker_v2.py   # Market making (10-20% APR)
│   │   └── news_arbitrage.py    # News-driven arbitrage
│   ├── exchanges/               # 🆕 Multi-exchange integration
│   │   ├── base.py              # Abstract exchange interface
│   │   ├── ccxt_client.py       # CCXT: 106+ crypto exchanges
│   │   └── alpaca_client.py     # Alpaca: Commission-free stocks
│   ├── clients/
│   │   ├── polymarket.py        # Polymarket API
│   │   └── kalshi.py            # Kalshi API
│   ├── arbitrage/               # Core arbitrage detection
│   └── database/                # Supabase persistence
├── admin/                       # Next.js Admin Dashboard
│   └── src/app/settings/        # Strategy parameter controls
├── infra/                       # Terraform/CloudFormation
└── tests/
```

---

## 🚀 Strategy Implementation Status

### ✅ Implemented & Working

| Strategy | File | Confidence | Notes |
|----------|------|------------|-------|
| Single-Platform Arbitrage (Polymarket) | `src/arbitrage/` | 85-90% | PhD research optimized |
| Single-Platform Arbitrage (Kalshi) | `src/arbitrage/` | 70-80% | Fee-adjusted (7% fees) |
| Cross-Platform Arbitrage | `src/arbitrage/` | 75-85% | Asymmetric thresholds |
| Market Making | `src/strategies/market_maker_v2.py` | 70-80% | 10-20% APR target |
| News Arbitrage | `src/strategies/news_arbitrage.py` | 50-60% | Event-driven |

### 🔧 In Progress (Exchange Layer Built)

| Strategy | File | Confidence | TODO |
|----------|------|------------|------|
| Funding Rate Arbitrage | `src/exchanges/ccxt_client.py` | 85% | Implement delta-neutral logic |
| Grid Trading | - | 75% | Implement grid order manager |
| Pairs/Statistical Arbitrage | - | 65% | Implement cointegration |
| Momentum Strategy | - | 60% | Implement 12-month scanner |
| Enhanced DCA | - | 90% | Add RSI-based scaling |

### 📋 Planned

| Strategy | Exchange | Confidence |
|----------|----------|------------|
| Options Volatility Selling | Deribit (CCXT), Tastyworks | 70% |
| MEV/Liquidations | On-chain | 50% |
| Cross-Exchange Crypto Arb | CCXT multi-exchange | 55% |

---

## 🔌 Exchange Integrations

### Crypto (CCXT Library - 106+ Exchanges)

```python
from src.exchanges import CCXTClient

# Initialize (supports: binance, bybit, okx, kraken, coinbase, kucoin, etc.)
client = CCXTClient('binance_futures', api_key, api_secret, sandbox=True)
await client.initialize()

# Get funding rates (KEY for Funding Rate Arbitrage)
rates = await client.get_funding_rates(['BTC/USDT:USDT', 'ETH/USDT:USDT'])
for symbol, rate in rates.items():
    print(f"{symbol}: {rate.funding_rate:.4%} ({rate.annualized_rate:.2%} APY)")

# Place trades
order = await client.create_order('BTC/USDT', OrderSide.BUY, OrderType.LIMIT, 0.001, 50000)
```

### Stocks (Alpaca - Commission-Free)

```python
from src.exchanges import AlpacaClient

client = AlpacaClient(api_key, api_secret, paper=True)
await client.initialize()

# Get stock prices
ticker = await client.get_ticker('AAPL')

# Place trades
order = await client.create_order('AAPL', OrderSide.BUY, OrderType.MARKET, 10)
```

### Stocks (Interactive Brokers - Advanced)

```
# Not yet implemented - Requires TWS Gateway
# See: https://www.interactivebrokers.com/api
# Supports: 160 markets, 36 countries, stocks/options/futures/forex/crypto
```

---

## ⚙️ Admin UI Controls

All strategies are controllable via the Next.js Admin Dashboard:

```
http://localhost:3001/settings
```

**Per-Strategy Controls:**

- ✅ Enable/Disable toggle
- ✅ Min profit threshold
- ✅ Max position size
- ✅ Scan interval
- ✅ Strategy-specific parameters

**Global Controls:**

- ✅ Dry run mode (paper trading)
- ✅ Max daily loss circuit breaker
- ✅ Platform enable/disable (Polymarket, Kalshi)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Python backend
pip install -r requirements.txt

# Admin UI
cd admin && npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys:
# - POLYMARKET_API_KEY, POLYMARKET_SECRET
# - KALSHI_API_KEY, KALSHI_PRIVATE_KEY
# - BINANCE_API_KEY, BINANCE_SECRET (for crypto)
# - ALPACA_API_KEY, ALPACA_SECRET (for stocks)
# - SUPABASE_URL, SUPABASE_KEY
```

### 3. Run in Simulation Mode

```bash
# Start bot (DRY_RUN=true by default)
python -m src.main

# In another terminal, start Admin UI
cd admin && npm run dev
```

### 4. View Performance

```bash
python -m scripts.view_stats
```

---

## 📊 Research-Backed Parameters

From PhD research (Saguillo et al., 2025) on Polymarket:

| Parameter | Polymarket | Kalshi | Cross-Platform |
|-----------|------------|--------|----------------|
| **Min Profit %** | 0.3% | 8.0% | 2.5% (buy Poly) / 9.0% (buy Kalshi) |
| **Max Position** | $100 | $30 | $75 |
| **Scan Interval** | 30s | 60s | 90s |
| **Fee Structure** | 0% | 7% | Asymmetric |

---

## 🎓 Agent Continuation Prompt

**Copy this prompt to continue development with a new AI agent:**

---

```
You are continuing development of PolyBot, a production-grade algorithmic trading platform.

## PROJECT CONTEXT
- Multi-asset trading: Prediction markets (Polymarket, Kalshi), Crypto (106+ exchanges via CCXT), Stocks (Alpaca, IBKR)
- PhD-level research completed: See ALGO_TRADING_DEEP_RESEARCH.md for strategy confidence ratings
- Admin UI: Next.js dashboard at /admin for all strategy controls
- Database: Supabase for persistence, config stored in polybot_config table

## COMPLETED WORK
1. ✅ Prediction market arbitrage (single-platform, cross-platform)
2. ✅ Market Making strategy (src/strategies/market_maker_v2.py)
3. ✅ News Arbitrage strategy (src/strategies/news_arbitrage.py)
4. ✅ Exchange integration layer (src/exchanges/)
   - CCXT client for crypto (ccxt_client.py) - supports funding rates!
   - Alpaca client for stocks (alpaca_client.py)
5. ✅ Admin UI with per-strategy controls (admin/src/app/settings/page.tsx)

## IMMEDIATE TODO (HIGH PRIORITY)
1. Implement Funding Rate Arbitrage Strategy (85% confidence)
   - Use ccxt_client.get_funding_rates() to monitor BTC/ETH funding
   - When funding > 0.03% (30% APY), enter delta-neutral position
   - Buy spot, short perpetual, collect funding every 8 hours
   
2. Implement Grid Trading Strategy (75% confidence)
   - Create grid of buy/sell orders around current price
   - Profit from sideways price oscillation
   - Best for BTC/USDT, ETH/USDT in ranging markets

3. Implement Pairs Trading / Statistical Arbitrage (65% confidence)
   - Monitor BTC/ETH correlation (typically ~0.85)
   - Enter when z-score > 2: short outperformer, long underperformer
   - Exit on mean reversion

4. Add Interactive Brokers (IBKR) integration for advanced stock trading
   - TWS API for options, futures
   - See: https://www.interactivebrokers.com/api

## KEY FILES TO UNDERSTAND
- src/config.py: All strategy parameters (TradingConfig dataclass)
- src/bot_runner.py: Main trading loop
- src/exchanges/ccxt_client.py: CCXT integration with funding rate methods
- admin/src/app/settings/page.tsx: Admin UI (React state matches config.py)
- ALGO_TRADING_DEEP_RESEARCH.md: Strategy research and confidence ratings

## EXCHANGE RECOMMENDATIONS (from research)
- CRYPTO: Use CCXT Library (106 exchanges, unified API, WebSocket via CCXT Pro)
  - Binance Futures for funding rates
  - Bybit for unified V5 API
- STOCKS: Use Alpaca (commission-free) or IBKR (comprehensive)

## ARCHITECTURE PATTERN
1. Strategy parameters defined in TradingConfig (src/config.py)
2. Config loaded from Supabase polybot_config table
3. Admin UI reads/writes to Supabase
4. Bot reads config on startup and periodically refreshes
5. Each strategy is a separate module in src/strategies/

## TESTING APPROACH
- Always start with DRY_RUN=true (paper trading)
- Use exchange sandbox modes (sandbox=True in CCXT, paper=True in Alpaca)
- Track simulated P&L in Supabase polybot_simulated_trades table

## EXPECTED RETURNS (from research)
| Strategy | Expected APY | Confidence |
|----------|--------------|------------|
| Funding Rate Arb | 15-50% | 85% |
| Grid Trading | 20-60% (ranging) | 75% |
| Market Making | 10-20% | 70% |
| Pairs Trading | 10-25% | 65% |
| Momentum | 15-30% | 60% |

Start by reading ALGO_TRADING_DEEP_RESEARCH.md for full strategy details.
```

---

## 🛡️ Risk Management

- **Circuit Breakers:** Auto-pause on max daily loss
- **Position Limits:** Per-strategy max position sizes
- **Dry Run Mode:** Always start in simulation
- **Slippage Protection:** Reject trades if price moves >0.5%
- **Manual Approval:** First N trades require confirmation

---

## 📈 Performance Tracking

```bash
# View live stats
python -m scripts.view_stats

# Metrics tracked:
# - Simulated Balance (starts $1000)
# - Total P&L
# - Win Rate
# - Sharpe Ratio
# - Max Drawdown
# - Per-strategy breakdown
```

---

## 🔧 Development

```bash
# Run tests
pytest tests/

# Type checking
mypy src/

# Lint
ruff check src/

# Build Admin UI
cd admin && npm run build
```

---

## 📜 License

MIT

---

## 🙏 Acknowledgments

- PhD Research: Saguillo et al. (2025) - Polymarket arbitrage analysis
- CCXT Library - Unified crypto exchange API
- QuantConnect & Quantpedia - Strategy libraries
- r/algotrading community - Practitioner insights
