# PolyBot To-Do List

## Active Tasks (December 7, 2025)

### 🔴 HIGH PRIORITY - Current Issues

#### Bot/Backend

- [x] **Bot Running Successfully** - v48 on Lightsail, health check returns "OK"
  - Alpaca client initialized ✅
  - Stock Mean Reversion strategy active ✅
  - Stock Momentum strategy active ✅
  - All API keys configured in Supabase
  - **Balance Aggregator wired up** - Saves to polybot_balances ✅
  - **News saving to DB** - Saves to polybot_news_items ✅

- [x] **Markets API MASSIVELY EXPANDED** - Now serving 15,970+ markets! 🚀
  - **Stocks: 11,770** - ALL US equities from Alpaca
    - NASDAQ: 5,173 stocks
    - NYSE: 2,419 stocks
    - ARCA: 2,524 ETFs
    - BATS: 1,118 stocks
    - AMEX: 269 stocks
    - OTC: 267 stocks
  - **Each stock includes**: Exchange, Exchange Name, Data Source, Tradable/Shortable/Fractionable
  - **Crypto: 200** with market cap tiers
  - **Prediction Markets: 4,000** from Polymarket/Kalshi

- [x] **NEW ALGORITHMIC STRATEGIES CREATED** 🎯
  - **Options Strategies** (CODE EXISTS - not yet in bot_runner)
    - Covered Calls (10-20% APY)
    - Cash-Secured Puts (15-30% APY)
    - Iron Condors (20-40% APY)
    - Wheel Strategy (20-35% APY)
    - Vertical Spreads (Bull/Bear)
  - **Stock Strategies** (CODE EXISTS - not yet in bot_runner)
    - Sector Rotation (15-25% APY)
    - Dividend Growth (8-12% APY)
    - Earnings Momentum (15-30% APY)
  - **ACTIVE STRATEGIES** (in bot_runner)
    - Stock Mean Reversion (15-30% APY) ✅
    - Stock Momentum (20-40% APY) ✅
    - Grid Trading (20-60% APY)
    - Pairs Trading (10-25% APY)
    - Market Making (10-20% APR)
    - News Arbitrage (5-30%/event)
    - Funding Rate Arb (15-50% APY)

- [ ] **Wire up new strategies in bot_runner** (LOW PRIORITY)
  - Options strategies need broker options API access
  - Sector Rotation, Dividend Growth, Earnings Momentum - code exists, need to import

- [ ] **News API 401 Unauthorized** - NewsAPI.org key invalid (optional)
  - Finnhub working ✅
  - Polymarket Activity working ✅
  - NewsAPI.org optional - user doesn't have account

- [x] **Binance.US Blocked** - Returns 451 "Service unavailable from restricted location"
  - AWS Lightsail in us-east-1 is geoblocked by Binance.US
  - User prefers Coinbase - enabled in settings, Bybit/Binance disabled

#### Admin UI

- [x] **Users Page Added** - New `/users` page for user management
  - Card layout showing all users
  - Role management (Admin/Read Only)
  - User search functionality
  - Delete user capability
  - Stats showing admin vs read-only count

- [x] **Navigation Updated** - Users now in Settings menu section

- [x] **Settings Persistence Fixed** - Exchange toggles now save correctly

- [x] **P&L Calculation Fixed** - Now computes from actual trades

- [x] **News Page** - Fully implemented with pagination
  - Shows headline, summary/content, source, published date
  - Links to original article (external link icon)
  - Auto-refreshes every 30 seconds
  - Filters by source (Finnhub, NewsAPI, Twitter, Reddit, Polymarket) and sentiment
  - 20 items per page, paginated with next/prev buttons
  - Last 10 days of articles shown
  - **Bot now saves news to database** ✅
  - **News Sources Configured**: Finnhub ✅, Polymarket Activity ✅
  - Bot handles missing/invalid API keys gracefully - each source is independent

- [x] **Balances Page** - Shows multi-platform portfolio
  - Balance aggregator wired up in bot_runner ✅
  - Collects from: Polymarket, Kalshi, Crypto (CCXT), Stocks (Alpaca)
  - Saves to polybot_balances table ✅

- [x] **Core Arbitrage Strategies Collapsible** - Added collapsible toggle for settings

- [x] **Stock/Crypto Market Data in Markets Browser** - Added Yahoo Finance & CoinGecko APIs
  - Shows top stocks (AAPL, MSFT, NVDA, etc.) with real-time prices
  - Shows top 50 cryptocurrencies with prices, market cap, 24h change
  - Filter by asset type: prediction markets, stocks, crypto

### 🟡 MEDIUM PRIORITY - Feature Requests

#### TradingView Integration

- [ ] **TradingView webhook endpoint** - Receive trade signals from TradingView alerts
  - Add `/api/webhook/tradingview` endpoint to bot
  - Parse TradingView alert JSON payloads
  - Execute trades on Alpaca based on signals
- [ ] **TradingView → Alpaca direct connection** - Document setup for users
  - TradingView can connect directly to Alpaca paper trading
  - No code needed, just broker integration in TradingView

#### Simulation & Analysis

- [x] **Simulation session history viewer** - EXISTS at `/history` page
  - View past simulation sessions with trades
  - Session cards show ROI, P&L, win rate
- [x] **AI analysis of sessions** - EXISTS in `/history` page
  - "Generate AI Analysis" button on each session
  - Shows recommendations with implement all option
- [x] Export session data to CSV/JSON - ADDED export buttons to session detail

#### Strategy Analytics & Filtering

- [x] Database schema for strategy filtering (user ran SQL migration)
- [x] Per-strategy P&L breakdown in dashboard (StrategyBreakdown component added)
- [x] Collapsible strategy sections in dashboard - EXISTS (StrategyCard is collapsible)
- [x] Strategy performance comparison charts - EXISTS in `/analytics` page

#### Logging & Debugging

- [x] **Logs page with real-time streaming** - EXISTS at `/logs`
  - Bot logs and audit logs tabs
  - Filter by severity (debug, info, warning, error, critical)
  - Filter by component
  - Auto-refresh every 10 seconds option
  - Export to JSON

- [x] **Database Logging Fixed** - Bot now writes to polybot_bot_logs table
  - Fixed SUPABASE_KEY env var name issue in logging_handler.py
  - v47 deployed with fix

#### User Management

- [x] **Fix User Admin section** - IMPROVED with loading/error/empty states
  - API works (tested: returns 3 users including admin)
  - Frontend requires user to be logged in as admin to see users
  - Make sure you're logged in with <rutrohd@gmail.com> (admin role)
  - Shows list of users with roles
  - Change role dropdown
  - Delete user button
- [ ] User role management (admin, viewer, trader) - Currently only admin/viewer
- [ ] Activity log per user - Audit logs exist but not filtered by user

#### Metric Consistency

- [x] **Metrics are consistent** - All reports/analytics use same data source
  - Source of truth: `polybot_simulated_trades` table
  - `useRealTimeStats()` hook computes stats from trades
  - Dashboard, Analytics, Insights pages all use `useSimulatedTrades()`
  - Metrics computed: total_pnl, win_rate, simulated_balance, roi_pct
  - All pages show the same numbers when viewing the same trades

#### Live Trading Preparation

- [ ] Alpaca Live API approval (currently paper trading only)
- [ ] Coinbase Pro API setup for live crypto trading
- [ ] Risk management controls for live mode
- [ ] Position size limits per strategy for live mode

#### Research & Feature Ideas

- [ ] Review features on algobulls.com for trading bot ideas
- [ ] Review features on ninjatrader.com for trading bot ideas

#### UI Improvements

- [ ] Collapsible strategy sections on dashboard
- [ ] Better mobile responsiveness

### 🟢 LOW PRIORITY - Nice to Have

- [ ] Discord webhook integration
- [ ] Email alerts for significant events

---

## ✅ Completed Tasks

### December 7, 2025 (Latest)

- [x] Wired up BalanceAggregator in bot_runner - now saves to polybot_balances
- [x] Added news saving to polybot_news_items for Admin UI news page
- [x] Verified P&L calculation accuracy ($1,279.82 from 1000 trades)
- [x] Connected admin Vercel project to GitHub for auto-deploy
- [x] Deleted redundant `polybot` Vercel project
- [x] Verified per-strategy analytics working (StrategyBreakdown component)
- [x] Updated TODO with accurate status

### December 6, 2025

- [x] Fixed single-platform opportunity logging (was missing buy_platform field)
- [x] Added database logging for admin UI logs page
- [x] Added per-strategy P&L breakdown to dashboard (StrategyBreakdown component)
- [x] Added useStrategyPerformance hook with fallback computation
- [x] Fixed market maker tight loop issue (was restarting every few seconds)
- [x] Disabled unnecessary strategies in database
- [x] Fixed settings persistence bug (Bybit toggle)
- [x] Fixed `max_position_size` AttributeError
- [x] Fixed strategy parameter mismatches in `bot_runner.py`
- [x] Fixed P&L modal to compute from actual trades
- [x] Added `secret.test`, `simulation.analyze`, `simulation.archive` to AuditAction types
- [x] v39 deployed to Lightsail with all fixes

### December 5, 2025

- [x] Migrated from ECS ($54/day) to Lightsail ($0.17/day)
- [x] Service role key working (17 secrets loading)
- [x] Binance.US mapping in CCXT client

### Earlier

- [x] Stock trading strategies (Mean Reversion, Momentum)
- [x] Balance aggregator integration
- [x] Notifications page
- [x] Positions page
- [x] Balances page
- [x] Navigation updates
- [x] AWS cost analysis
- [x] Secrets page security enhancements

---

## Current Bot Status

- **Version**: v47 (Build #36, image polybot-b36.34)
- **Status**: RUNNING ✅
- **Database Logging**: Working ✅
- **Admin URL**: <https://admin-gules-chi.vercel.app>
- **Bot URL**: <https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com>
- **Strategies Active**: kalshi_single, polymarket_single, cross_platform
- **Disabled**: market_making, news_arb, funding_rate, grid, pairs
- **Exchanges**: Coinbase enabled, Bybit/Binance disabled
- **Mode**: PAPER/SIMULATION
- **Balance**: ~$1,927 (as of v39 deployment)

---

## Known Limitations

1. Stock strategies only run during market hours (9:30 AM - 4:00 PM ET Mon-Fri)
2. Crypto strategies need non-Binance.US exchange for US deployment
3. Simulation trades resolve instantly (no "pending" positions state)
