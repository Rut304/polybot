# PolyBot To-Do List

## Active Tasks (December 7, 2025)

### 🔴 HIGH PRIORITY - Current Issues

#### Bot/Backend

- [x] **Stock/Crypto Data Flow** - FIXED: Added `run_cycle()` methods to strategies
  - Fixed `'StockMeanReversionStrategy' object has no attribute 'run_cycle'` error
  - Fixed `'StockMomentumStrategy' object has no attribute 'run_cycle'` error
  - Strategies had `run()` but bot_runner was calling `run_cycle()`
  - v41 deployment pending

- [ ] **News API 401 Unauthorized** - Invalid API key in Supabase secrets
  - Key `NEWS_API_KEY` appears malformed: `d4pqlp1r01qjpnb110tg...`
  - Need to verify/update the NewsAPI.org key in polybot_secrets table

- [x] **Binance.US Blocked** - Returns 451 "Service unavailable from restricted location"
  - AWS Lightsail in us-east-1 is geoblocked by Binance.US
  - User prefers Coinbase - enabled in settings, Bybit/Binance disabled
  - **NOTE**: User says Binance.US should work in Massachusetts - may need VPN or different approach

- [x] **Run Trading Mode Migration** - SQL columns added for paper/live tracking
  - User ran SQL migrations in Supabase SQL Editor
  - Added `trading_mode`, `strategy_type`, `platform`, `session_id` columns
  - Created `polybot_strategy_performance` view for analytics

- [x] **Market Maker Tight Loop** - Fixed
  - Was returning early when no markets found, causing rapid restarts
  - Added 5-minute delay when no suitable markets

#### Admin UI

- [x] **Settings Persistence Fixed** - Exchange toggles now save correctly

- [x] **P&L Calculation Fixed** - Now computes from actual trades

- [x] **News Page** - Fully implemented with pagination
  - Shows headline, summary/content, source, published date
  - Links to original article (external link icon)
  - Auto-refreshes every 30 seconds
  - Filters by source (Finnhub, NewsAPI, Twitter, Reddit, Polymarket) and sentiment
  - 20 items per page, paginated with next/prev buttons
  - Last 10 days of articles shown
  - **News Sources Configured**: Finnhub ✅, Twitter/X ✅
  - **News Sources NOT Configured**: NewsAPI.org (optional)
  - Bot handles missing/invalid API keys gracefully - each source is independent

- [x] **Core Arbitrage Strategies Collapsible** - Added collapsible toggle for settings

- [x] **Stock/Crypto Market Data in Markets Browser** - Added Yahoo Finance & CoinGecko APIs
  - Shows top stocks (AAPL, MSFT, NVDA, etc.) with real-time prices
  - Shows top 50 cryptocurrencies with prices, market cap, 24h change
  - Filter by asset type: prediction markets, stocks, crypto

### 🟡 MEDIUM PRIORITY - Feature Requests

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

### December 6, 2025 (Latest)

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
