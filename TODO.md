# PolyBot To-Do List

---

## 🔴 P0 - MUST FIX BEFORE LAUNCH (December 31, 2025)

### 1. Bot Reliability & Monitoring

- [x] **Fix secrets loading** - DONE
- [x] **Add external monitoring** - Created `docs/MONITORING_SETUP.md`
- [x] **Dashboard bot monitor** - Already works via `useBotStatus()` hook
  - Checks `polybot_status` table heartbeat
  - Shows running/stopped state on dashboard
  - Shows last heartbeat time
- [ ] **Verify all exchange clients initialize** after secrets added

### 2. Documentation Consolidation 🔴 IN PROGRESS

**Current Problem**: Documentation scattered across 4+ locations:

- `/help` - 13 user articles (public) ✅
- `/docs` - 1,648 lines admin-only API docs (redundant)
- `/workflows` - Strategy workflow visuals ✅ KEEP SEPARATE (good UX)
- `/strategies` - Enable/configure with inline descriptions
- `docs/*.md` - 23+ internal developer files (not user-facing)

**Solution**: Unified Help Center at `/help`:

- [ ] **Add Strategy Docs by Tier** (Free/Pro/Elite breakdown)
- [ ] **Merge /workflows content into /help**
- [ ] **Move API Reference from /docs to /help**
- [ ] **Remove/redirect /docs page** (consolidate)
- [ ] **Add Features by Plan comparison**

### 3. AI Support Chatbot 🆕

- [ ] **Add AI chat widget** (bottom-right corner)
  - Answers deployment, setup, support questions
  - Uses documentation as knowledge base
  - Reduces manual support burden
  - Options: Intercom, Crisp, or OpenAI custom
- [ ] **Train on PolyParlay documentation**
- [ ] **Add escalation to email** for complex issues

### 4. Database Tables (Manual SQL)

- [ ] Run `scripts/add_stripe_columns.sql` in Supabase
- [ ] Run `scripts/add_watchlist_table.sql` in Supabase
- [ ] Run `scripts/add_tradingview_signals_table.sql` in Supabase

---

## 🟡 P1 - IMPORTANT (First 2 Weeks)

### Live Trading ✅ FULLY WIRED

Live trading IS completely wired up:

- `dry_run_mode = false` enables live execution
- Settings page has Live Trading toggle with confirmation
- TradingModeBanner shows "🔴 LIVE" when active
- Bot runner checks mode before executing real trades
- All exchange clients have live execution methods

**To enable**:

1. Upgrade to Pro/Elite plan
2. Connect real exchange API keys
3. Settings → Trading Mode → Enable Live
4. Confirm modal (type "CONFIRM")

### Analytics & Charts

- [ ] Line charts for strategy P&L trending
- [ ] TradingView charts for price data
- [ ] Interactive legend to toggle strategies

### Pages Needing Updates

- [ ] `/insights` - Add platform filter
- [ ] `/history` - Add platform filter
- [ ] `/whales` - Multi-platform support
- [ ] Merge Bets + Positions into "My Trades"

---

## 🟢 P2 - NICE TO HAVE (Future)

- [ ] Mobile app (iOS/Android)
- [ ] Discord webhook notifications
- [ ] Forecast tournaments with prizes
- [ ] Social proof (testimonials, live user count)
- [x] **Set up Uptime Robot** ✅ COMPLETE
  - Status page: https://stats.uptimerobot.com/2bYfTzqSH4
  - 3 monitors active: polyparlay.io, /health, /status
  - API keys added to .env.local, GitHub secrets, Vercel

---

## ✅ RESOLVED: Bot Secrets Issue (December 31, 2025)

**ROOT CAUSE**: Adding `BOT_USER_ID` to deployment caused `load_secrets()` to query
`polybot_key_vault` (empty user table) instead of `polybot_secrets` (34+ global keys).

**FIX APPLIED**: Changed `load_secrets()` to always load global secrets first from
`polybot_secrets`, then overlay with user-specific secrets from `polybot_key_vault`.

**Current Status**:

- ✅ BINANCE_API_KEY - Loaded
- ✅ ALPACA_PAPER_API_KEY - Loaded
- ✅ POLYMARKET_API_KEY - Loaded
- ✅ KALSHI_API_KEY - Loaded
- ✅ All 34+ secrets - Loaded

---

## ✅ Navigation UX Overhaul COMPLETE

- [ ] **Set up Uptime Robot monitors** (manual - follow docs/MONITORING_SETUP.md)
- [x] **Add auto-restart** - Lightsail handles this, systemd guide in docs
- [ ] **Verify all exchange clients initialize** after secrets added

### 2. Public Documentation ✅ COMPLETE

- [x] **Make /help publicly accessible** - No login required now
- [x] **Updated STATIC_ARTICLES** - 13 comprehensive help articles:
  - Getting Started with PolyParlay
  - Paper Trading Guide
  - Dashboard Overview
  - Connecting Polymarket
  - Connecting Kalshi
  - Connecting Alpaca (Stocks)
  - Connecting Crypto Exchanges
  - TradingView Webhook Integration
  - Trading Strategies Overview
  - Arbitrage Strategies Explained
  - Congressional Tracker Strategy
  - Billing & Subscriptions
  - FAQ (comprehensive)
- [x] **Added to PUBLIC_ROUTES**: `/help`, `/documentation`, `/api/help`, `/api/live-feed`

### 3. Stripe "Manage" Button Error

- [x] **Fix "Failed to load portal"** - Improved error handling, redirects to /pricing
- [x] Add `stripe_customer_id` column - Script: `scripts/add_stripe_columns.sql`
- [ ] Run SQL in Supabase to add column (manual step)

### 3. Navigation UX Overhaul ✅ COMPLETE

- [x] **Restructure sidebar** - 7 sections, much cleaner
- [x] Group: DASHBOARD | TRADING | RESEARCH | PORTFOLIO | AUTOMATION | SETTINGS | ADMIN
- [x] Move Admin section to bottom with dashed border separator
- [x] Moved Failed Trades to Admin, API Keys to Settings, Strategies to Automation
- [x] Mobile navigation also updated

### 4. Congressional Tracker ✅ COMPLETE

- [x] **Wire up multiple free APIs** - House/Senate Stock Watcher + Quiver Quant
- [x] Added fallback chain: Stock Watcher → Capitol Trades → Quiver Quant → Sample
- [x] Shows data source in response

### 5. Watchlist Page

- [x] **Identified issue**: `polybot_watchlist` table doesn't exist
- [x] Created migration: `scripts/add_watchlist_table.sql`
- [ ] Run SQL in Supabase to create table (manual step)
- [ ] Add price alerts (future enhancement)

### 6. Run E2E Tests ✅ COMPLETE

- [x] Execute `cd admin && npx playwright test`
- [x] **570 tests passed**, 8 skipped
- [x] Test results cleaned from git, added to .gitignore
- [x] Added 28 new tests for new features (TradingView, live feed, congressional, SEO)

---

## 🟡 P1 - IMPORTANT (First 2 Weeks)

### Strategy & Framework Wiring ✅ COMPLETE

- [x] **Verify ALL strategies are wired** to bot_runner.py
- [x] **Verify ALL frameworks are wired** (risk management, position sizing)
- [x] Create checklist of every strategy with enabled/disabled status
- [x] Added missing run methods for: sector rotation, dividend growth, earnings momentum
- [x] Added missing run methods for: covered calls, CSPs, iron condor, wheel strategy
- [x] All 25+ strategies now have run methods wired to main loop

### TradingView Integration ✅ COMPLETE

- [x] **Add TradingView webhook endpoint** `/api/webhooks/tradingview`
- [x] Created `scripts/add_tradingview_signals_table.sql` for signal storage
- [x] Supports buy/sell/close actions, auto-detects asset type (stock/crypto/prediction)
- [x] GET endpoint shows usage documentation
- [ ] Improve chart legibility and design (future)

### Landing Page Improvements ✅ PARTIAL

- [x] **Real-time trade feed** - `/api/live-feed` endpoint + dynamic ticker component
- [x] Live feed shows LIVE indicator when connected to database
- [x] Shows platform badges (Polymarket/Kalshi)
- [x] Auto-refreshes every 30 seconds
- [ ] Social proof counters (need more real data)
- [ ] Marketing messaging update (see below)

### Parlay Builder ✅ COMPLETE

- [x] **Created `/parlays` route** with parlay builder UI
- [x] Combined probability calculator
- [x] Expected value analysis
- [x] Risk level assessment
- [x] Added to navigation under Trading section

### Combine My Bets + Positions

- [ ] Merge into single "My Trades" page
- [ ] Add filter: "Open Positions" vs "Trade History"
- [ ] Clear status indicators

### SEO & AI Discoverability ✅ COMPLETE

- [x] Create `/public/llms.txt` for AI search engines
- [x] Add structured data (JSON-LD) to layout
- [x] Enhanced meta tags (OpenGraph, Twitter Cards)
- [x] Created sitemap.xml
- [x] Created robots.txt with AI agent rules

### Smart Money Indicators in AI Insights

- [ ] Show "Where top 10 whales are betting"
- [ ] Whale movement alerts
- [ ] Sentiment divergence indicators

---

## 🟢 P2 - NICE TO HAVE (Future)

### Forecast Tournaments

- [ ] Weekly prediction competitions
- [ ] Leaderboard with prizes
- [ ] Top forecasters featured

### Cross-Platform Arbitrage (✅ EXISTS)

- Polymarket ↔ Kalshi arbitrage already implemented
- File: `src/analytics/arbitrage_analytics.py`

### Backtesting (✅ EXISTS)

- UI at `/backtesting` already implemented
- API at `/api/backtests` already implemented
- Tables: `polybot_backtests`, `polybot_backtest_trades`

### Mobile App

- [ ] Native iOS/Android

### Discord Integration

- [ ] Webhook notifications

---

## 📝 MARKETING & BRANDING UPDATE

**Current Problem**: PolyParlay.io name doesn't represent full platform capabilities.

**What PolyParlay Actually Is**:

- Full automated trading platform for:
  - ✅ Prediction Markets (Polymarket, Kalshi)
  - ✅ Stocks (Alpaca, IBKR, Robinhood, Webull)
  - ✅ Crypto (Coinbase, Binance, Kraken, etc.)
- **No coding required** - pure UI configuration
- **14+ strategies** with custom parameters
- **Risk management frameworks** built-in
- **Self-tuning AI** that optimizes strategy parameters
- **Full simulation mode** before spending a penny
- **We only make money when you trade real money**

**Marketing Copy Draft**:
> "PolyParlay is an AI-powered trading platform that automates prediction markets, stocks, and crypto - no coding required. Run full simulations with 14+ strategies before connecting your accounts. Our self-tuning AI continuously optimizes your trades. You don't pay until you trade real money."

**Domain Consideration**: Looking for new domain that better represents full platform.

---

## ✅ COMPLETED: Wire Up Robinhood & Webull Trading Clients (December 30, 2025)

**Status**: ✅ COMPLETE  
**Goal**: Full trading client support like other brokers

### What Was Done

1. **✅ Robinhood Client** (`src/exchanges/robinhood_client.py`)
   - Created ~600 line client using `robin_stocks` library
   - Methods: get_balance(), create_order(), get_positions(), get_ticker()
   - Supports crypto trading via get_crypto_ticker(), get_crypto_positions()
   - Multi-tenant via create_for_user() factory method

2. **✅ Webull Client** (`src/exchanges/webull_client.py`)  
   - Created ~650 line client using `webull` library
   - Methods: get_balance(), create_order(), get_positions(), get_options_chain()
   - Support paper trading via webull's paper trading mode
   - Multi-tenant via create_for_user() factory method

3. **✅ Added to Bot Runner**
   - Added `enable_robinhood` and `enable_webull` config flags in config.py
   - Added initialization in bot_runner.py alongside other brokers

4. **✅ Exported from exchanges module**
   - Added to `src/exchanges/__init__.py`

---

## ✅ COMPLETED: Platform Filtering & Analytics (December 30, 2025)

### What Was Done

1. **✅ PlatformContext Updated**
   - Two-mode filtering: Simulation shows ALL, Live shows connected only
   - `isSimulationMode`, `filterByPlatform()`, `getEffectivePlatformIds()`

2. **✅ PlatformFilter Component** (`admin/src/components/PlatformFilter.tsx`)
   - Dropdown filter for selecting platforms
   - Shows mode indicator (🧪 Simulation vs ⚡ Live)
   - Supports multi-select

3. **✅ TimeRangeFilter Component**
   - Options: 24h, 7D, 30D, 90D, 1Y, ALL
   - Reusable across all data pages

4. **✅ TradingModeBanner Component** (`admin/src/components/TradingModeBanner.tsx`)
   - Shows clear indication of Simulation vs Live mode
   - Expandable details showing connected platforms
   - Links to settings/secrets pages

5. **✅ Pages Updated with Platform Filtering**
   - `/analytics` - Full platform filter, time range, mode indicator
   - `/dashboard` - TradingModeBanner added
   - `/positions` - Platform filter, mode indicator
   - `/bets` - Platform filter, mode indicator
   - `/balances` - Platform filter, filtered totals
   - `/strategies` - Requirements badges showing "Requires Alpaca/IBKR"

6. **✅ Platform-Filtered Hooks** (`admin/src/lib/hooks.ts`)
   - `usePlatformFilteredTrades()`
   - `usePlatformFilteredOpportunities()`
   - `usePlatformFilteredPositions()`
   - `usePlatformFilteredPnLHistory()`
   - `usePlatformFilteredManualTrades()`

7. **✅ E2E Tests Created** (`admin/e2e/platform-filtering.spec.ts`)
   - Tests simulation vs live mode behavior
   - Tests PlatformFilter component
   - Tests TimeRangeFilter component
   - Tests data accuracy with filters
   - Tests cross-page consistency
   - Tests strategy requirements badges

---

## ✅ COMPLETED: Strategy Backend Wiring (December 30, 2025)

### Stock Strategies Wired

- ✅ Sector Rotation Strategy - imported and initialized in bot_runner.py
- ✅ Dividend Growth Strategy - imported and initialized in bot_runner.py
- ✅ Earnings Momentum Strategy - imported and initialized in bot_runner.py

### Options Strategies Wired

- ✅ Covered Call Strategy - imported and initialized in bot_runner.py
- ✅ Cash Secured Put Strategy - imported and initialized in bot_runner.py
- ✅ Iron Condor Strategy - imported and initialized in bot_runner.py  
- ✅ Wheel Strategy - imported and initialized in bot_runner.py

### Config Flags Added

- ✅ `enable_sector_rotation`
- ✅ `enable_dividend_growth`
- ✅ `enable_earnings_momentum`
- ✅ `enable_covered_calls`
- ✅ `enable_cash_secured_puts`
- ✅ `enable_iron_condor`
- ✅ `enable_wheel_strategy`

---

## 🎯 REMAINING WORK

### 🔥 PRIORITY: Analytics Charts Improvement (December 31, 2025)

- [ ] **Line Charts for Strategy Trending** - Add line charts showing P&L trends over time
  - Each line/color represents a different strategy
  - X-axis: Time (configurable range)
  - Y-axis: Cumulative P&L
  - Strategies: kalshi_single, polymarket_single, cross_platform, overlapping_arb, etc.
  - Interactive legend to toggle strategies on/off

### Charts & Visualization

- [ ] Verify TradingView charts used where appropriate (price data, P&L curves)
- [ ] Keep Recharts for bar charts, pie charts, histograms
- [ ] Add more TradingView-style charts to positions page

### Additional Pages to Update

- [ ] `/insights` - Add platform filtering to AI insights
- [ ] `/history` - Add platform filtering to session history
- [ ] `/missed-opportunities` - Add platform filter
- [ ] `/watchlist` - Add platform filter
- [ ] `/whales` - Add multi-platform support (currently Polymarket only)
- [ ] `/leaderboard` - Add multi-platform support

### Testing

- [ ] Run E2E test suite: `cd admin && npx playwright test`
- [ ] Verify data accuracy tests pass
- [ ] Add unit tests for platform filtering logic

### Accessibility Fixes (Pre-existing)

- [ ] Add title attributes to buttons in markets/page.tsx
- [ ] Add labels to form inputs in settings/page.tsx
- [ ] Add accessible names to selects in strategy-history/page.tsx

---

## 🚨 CRITICAL: Full Multi-Tenant Platform Integration (December 30, 2025)

**Status**: ✅ MAJOR PROGRESS - Core infrastructure complete  
**Goal**: When a user connects an exchange, ALL data flows through the entire platform

### ✅ COMPLETED (December 30, 2025)

1. **✅ Multi-Exchange Bot Runner** - Now initializes ALL connected exchanges
   - Changed `self.ccxt_client` to `self.ccxt_clients: Dict[str, CCXTClient]`
   - Removed `break` statement - now loops through all enabled exchanges
   - Updated BalanceAggregator to use the dict
   - Updated health endpoint to report all connected exchanges

2. **✅ Trades API Has User Filter** - Security fix
   - Added `verifyAuth()` + `.eq('user_id', authResult.user_id)`
   - Also added optional `exchange` query param

3. **✅ Balances API Has User Filter**
   - Added auth + user_id filter
   - Now returns user's `connected_exchanges` from credentials table

4. **✅ Exchange Discovery API Created** - `/api/user-exchanges`
   - Returns all exchanges with connection status per user
   - Includes metadata: type (crypto/stocks/broker), capabilities
   - Returns: `has_crypto`, `has_stocks`, `has_prediction_markets`

5. **✅ Auto-Enable on Credential Save**
   - POST `/api/user-credentials` now auto-sets `polybot_config.enable_[exchange] = true`
   - DELETE auto-sets `enable_[exchange] = false`

6. **✅ useUserExchanges Hook** - Frontend can query connected exchanges

7. **✅ ConnectedExchangesBadge Component** - Shows connection status on dashboard

8. **✅ Settings Platform Status** - Shows live connection status with credentials link

### 🔴 PREVIOUS BLOCKING ISSUES (Most Fixed)

1. ~~**Bot Only Initializes ONE Exchange**~~ ✅ FIXED
2. ~~**Trades API Has No User Filter**~~ ✅ FIXED  
3. **10 Strategy Configs Were Missing from Python** - FIXED Dec 30
4. **7 Strategies Completely Disconnected** - UI exists, backend ignores (TODO)
5. ~~**No Exchange Discovery for UI**~~ ✅ FIXED

### 🎯 REMAINING MULTI-TENANT WORK

#### Phase D: Wire Disconnected Strategies (Day 3-4)

- [ ] **D1. Enable Stock Strategies in Bot Runner**

- [ ] **A3. Create Exchange Discovery API**
  - Create: `/admin/src/app/api/user-exchanges/route.ts`
  - Returns: List of exchanges user has connected with status
  - Used by: Market data, charts, opportunities to know what to show

#### Phase B: Platform-Aware UI (Day 2-3)

- [ ] **B1. Market Data by Connected Exchange**
  - When user connects Kucoin → show Kucoin prices
  - When user connects Bybit → show Bybit prices
  - File: `/admin/src/app/markets/page.tsx`
  - Currently hardcoded to Alpaca/Yahoo Finance

- [ ] **B2. Opportunities Filter by User's Exchanges**
  - Only show arbitrage opportunities for exchanges user can trade on
  - Don't show Binance opps if user only has Coinbase
  - File: Components showing opportunities

- [ ] **B3. Balance Aggregation Across All Connected**
  - `/balances` page should aggregate from ALL user's exchanges
  - Not just first connected exchange
  - Already has `BalanceAggregator` - needs to use all clients

- [ ] **B4. Trade History Shows Exchange/Platform**
  - Each trade shows which exchange it was on
  - Filter by exchange in trade history
  - Already has `buy_platform`/`sell_platform` fields

#### Phase C: Dynamic Platform Enable/Disable (Day 3-4)

- [ ] **C1. Exchange Connection Triggers Data Flow**
  - When user adds Kucoin API keys:
    1. Store in `user_exchange_credentials` ✅ (exists)
    2. Update `polybot_config.enable_kucoin = true` for user
    3. Bot picks up new exchange on next cycle
    4. UI starts showing Kucoin data

- [ ] **C2. Exchange Disconnection Stops Data**
  - When user removes API keys:
    1. Delete from `user_exchange_credentials`
    2. Set `polybot_config.enable_kucoin = false`
    3. Stop showing that exchange's data in UI
    4. Close any open positions warning

- [ ] **C3. Real-Time Exchange Status**
  - Show connection status per exchange
  - Green = connected + working
  - Yellow = connected + API error
  - Red = not connected
  - File: `/admin/src/app/secrets/page.tsx` (partial exists)

#### Phase D: Wire Disconnected Strategies (Day 4-5)

- [ ] **D1. Add Backend Checks for Stock Strategies**
  - Sector Rotation - needs Alpaca + sector ETFs
  - Dividend Growth - needs Alpaca + dividend data
  - Earnings Momentum - needs Alpaca + earnings calendar
  - File: `/src/bot_runner.py` strategy initialization section

- [ ] **D2. Add Backend Checks for Options Strategies**
  - Covered Calls, Cash Secured Puts, Iron Condor, Wheel
  - Requires IBKR integration (options not on Alpaca)
  - File: Create `/src/strategies/options_strategies.py`

- [ ] **D3. Connect Strategy UI to Backend Status**
  - Show "Requires IBKR" badge on options strategies
  - Show "Requires Alpaca" badge on stock strategies
  - Disable toggle if required exchange not connected

#### Phase E: Testing & Validation (Day 5)

- [ ] **E1. Run New E2E Tests**
  - `strategy-wiring.spec.ts` - validates config mappings
  - `exchange-data-flow.spec.ts` - validates data flow
  - `api-consistency.spec.ts` - validates API consistency

- [ ] **E2. Manual Multi-Exchange Test**
  - Connect 2+ exchanges as test user
  - Verify data from BOTH exchanges appears
  - Verify trades filter correctly

---

## ✅ COMPLETED: Multi-Tenant User Isolation (P0)

**Status**: FOUNDATION IMPLEMENTED ✅  
**Each user has**: Own API keys, isolated data, per-user bot instance support.

### Phase 1: Per-User API Key Architecture ✅ COMPLETE

- [x] **IBKR Web API Client** - Multi-tenant ready ✅ (`ibkr_web_client.py`)
- [x] **user_exchange_credentials table** - Created and deployed ✅
- [x] **AlpacaClient Multi-Tenant** ✅ COMPLETE
  - `create_for_user(user_id)` factory method implemented
  - Loads keys from `user_exchange_credentials` per user
  - Falls back to global secrets for backward compatibility
  - File: `/src/exchanges/alpaca_client.py`
- [x] **CCXTClient Multi-Tenant** ✅ COMPLETE  
  - `create_for_user(exchange_id, user_id)` factory method implemented
  - Loads keys from `user_exchange_credentials` per user
  - Supports: Binance, Coinbase, Kraken, KuCoin, OKX, Bybit per user
  - File: `/src/exchanges/ccxt_client.py`
- [x] **BotManager Ready** - `manager.py` spawns per-user bot instances
- [ ] **Secrets Encryption at Rest** (OPTIONAL - Supabase RLS provides isolation)
  - Encrypt API keys in database (AES-256)
  - Decrypt only at runtime

### Phase 2: Data Isolation ✅ COMPLETE

- [x] **Trade History by User** - `polybot_simulated_trades.user_id` + RLS ✅
- [x] **Balances by User** - `polybot_balances.user_id` + RLS ✅
- [x] **Strategy Settings by User** - `polybot_config.user_id` + RLS ✅
- [x] **All Hooks Multi-Tenant** - `hooks.ts` filters by `user.id` on all queries ✅
- [x] **Paper Trader Multi-Tenant** - Writes `user_id` on all trades ✅

---

## 🎯 Active Sprint (December 27, 2025)

### P0 - Must Complete Before Launch

- [x] **Flash Fix** - Navigation/Header showing before auth ✅ FIXED
- [x] **Missed Opportunities** - Filter to show only actionable misses ✅ FIXED  
- [x] **Auth Pages** - Signup, Login, Password Reset, Profile ✅ COMPLETE
  - `/signup` - User registration with email verification
  - `/login` - Email/password authentication
  - `/forgot-password` - Request password reset email
  - `/reset-password` - Set new password after reset link
  - `/auth/callback` - Email verification redirect handler
  - `/profile` - Account settings (edit name, email, password)
- [x] **Multi-Tenant Data Migration** - All existing data isolated to admin user ✅
- [x] **Per-User API Keys** - AlpacaClient + CCXTClient multi-tenant ✅ COMPLETE
- [x] **Admin Logs Page** ✅ COMPLETE - Bot Logs, Supabase Logs, Security Events
  - `/logs` - Bot activity logs with filtering
  - Supabase Dashboard links for detailed logs
  - Security event tab for auth/error monitoring
- [x] **Congressional Tracker UI** ✅ COMPLETE
  - `/congress` - Full politician trade tracking UI
  - View trades, filter by chamber/party/type
  - Track favorite politicians
  - Top traders leaderboard
- [x] **Security Audit** ✅ COMPLETE - `/docs/SECURITY_AUDIT.md`
- [x] **RLS Security Fix** ✅ COMPLETE - `scripts/security_fix_critical.sql` executed
  - Enabled RLS on 17+ tables
  - Created proper RLS policies (authenticated read + service_role write)
  - Recreated 7 views with SECURITY INVOKER
  - All 37 Security Advisor issues resolved
- [x] **Email System** ✅ COMPLETE - Welcome emails, trade alerts, daily digest
  - `/admin/src/lib/email.ts` - Full email template library
  - Templates: Welcome, Trade Alert, Daily Summary, Subscription, Payment Failed, Team Invite
  - Uses Resend API (set `RESEND_API_KEY` env var)
  - `/api/email` endpoint for sending
- [x] **Team Invitations** 👥 ✅ COMPLETE - Allow users to invite others to their tenant
  - `/team` page for managing team members
  - `/invite/[token]` page for accepting invitations
  - DB schema: `polybot_teams`, `polybot_team_members`, `polybot_team_invitations`
  - Roles: Owner, Admin, Member, Viewer with proper RLS
  - Auto-creates personal team on user signup
  - Run `scripts/create_team_invitations.sql` to set up
- [x] **MFA (Multi-Factor Authentication)** 🔐 ✅ COMPLETE - TOTP/Authenticator app support
  - Full MFA enrollment UI in `/profile` (Security tab)
  - QR code display + manual secret entry
  - 6-digit verification code input
  - Enable/disable MFA with confirmation
  - Uses Supabase Auth MFA APIs
  - **NOTE**: Enable MFA in Supabase Dashboard > Auth > MFA first!

### P0.5 - Copy Trading Features ✅ COMPLETE

- [x] **Whale Copy Trading (Polymarket)** ✅ COMPLETE
  - `whale_copy_trading.py` - Follows top traders on Polymarket
  - Real-time trade monitoring via CLOB API
  - Auto-discover whales from leaderboard
  - Configurable copy delay and position sizing
  - Performance tracking per whale
  - File: `/src/strategies/whale_copy_trading.py`
  
- [x] **Selective Whale Copy** ✅ COMPLETE  
  - `selective_whale_copy.py` - Performance-based whale selection
  - Only copies whales with proven track records
  - Dynamic multiplier based on whale performance
  - File: `/src/strategies/selective_whale_copy.py`

- [x] **Congressional Tracker** ✅ COMPLETE (Data sources working!)
  - `congressional_tracker.py` - Copy stock trades from Congress
  - **FREE Data Sources**:
    - House Stock Watcher API: `https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json`
    - Senate Stock Watcher API: `https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json`
    - Quiver Quant API (free tier): `https://api.quiverquant.com/beta/live/congresstrading`
  - Tracks: Nancy Pelosi, Dan Crenshaw, Tommy Tuberville, etc.
  - Auto-parses amount ranges ($1,001-$15,000, etc.)
  - Configurable copy scale and delay
  - File: `/src/strategies/congressional_tracker.py`
  - **TODO**: Wire congressional data to Admin UI for politician selection

### P0.5 - IBKR Integration (Mostly Complete)

- [x] **IBKR Web API Client** - Created `ibkr_web_client.py` (no gateway needed) ✅
- [x] **DB Migration Script** - `create_user_exchange_credentials.sql` ✅
- [x] **Run DB Migration** - Execute SQL in Supabase ✅
- [x] **IBKRConnect UI Component** - OAuth button created ✅
- [x] **OAuth API Endpoint** - `/api/ibkr/oauth/start` created ✅
- [x] **Bot Runner Updated** - Uses IBKRWebClient with fallback ✅
- [ ] **Test IBKR Integration** - End-to-end with paper trading
- **Note**: IBKR Lite users CAN use TWS API (free). Web API may have limitations.

---

## 🔧 NEW INTEGRATION CHECKLIST

When adding a new exchange/broker integration, complete ALL of these:

### Backend (Python)

- [ ] Create client in `/src/exchanges/` (extend `BaseExchange`)
- [ ] Add `create_for_user(user_id)` factory method for multi-tenancy
- [ ] Add to `bot_runner.py` initialization
- [ ] Add to strategies that can use this exchange
- [ ] Write unit tests in `/tests/`

### Database

- [ ] Add credential fields to `user_exchange_credentials` table
- [ ] Add RLS policies for user isolation
- [ ] Create migration SQL script in `/scripts/`

### Admin UI (Next.js)

- [ ] Add OAuth/API key connection in `/secrets` page
- [ ] Add to `/balances` page (show connected account)
- [ ] Add to `/positions` page (show positions)
- [ ] Add platform filter in `/markets` page
- [ ] Add to strategy requirements display
- [ ] Create connection status component

### API Routes

- [ ] Create `/api/[exchange]/` routes for data
- [ ] Add webhook endpoints if needed
- [ ] Add to `/api/markets` aggregation

### Documentation

- [ ] Update `README.md` with setup instructions
- [ ] Add to `SETUP_INSTRUCTIONS.md`
- [ ] Document in `TODO.md` (this file)
- [ ] Add help article in `/help` page

### Testing

- [ ] E2E test for connection flow
- [ ] E2E test for data display
- [ ] API route tests
- [ ] Integration test with bot

---

### P1 - New Exchange Integrations (Attract More Users)

#### Easy OAuth Integrations (User-Friendly)

- [ ] **Plaid** - Connect ANY bank account (read-only initially)
- [ ] **Robinhood** - Unofficial API exists, massive user base
- [ ] **Webull** - Popular with young traders, API available
- [ ] **TD Ameritrade/Schwab** - OAuth API, large user base
- [ ] **E*TRADE** - OAuth API, established platform

#### Crypto (Already Supported via CCXT)

- [x] **Binance.US** - ✅ Already supported
- [x] **Coinbase** - ✅ Already supported  
- [x] **Kraken** - ✅ Already supported
- [x] **KuCoin** - ✅ Already supported
- [ ] **Coinbase Advanced Trade** - Newer API, better for trading

#### Aggregators (Multi-Platform)

- [ ] **Plaid** - Bank account aggregation (read balances)
- [ ] **Yodlee/Finicity** - Enterprise bank aggregation
- [ ] **Vest** - Multi-broker API aggregator

#### DeFi/Crypto Wallets

- [ ] **WalletConnect** - Connect ANY EVM wallet (MetaMask, Rainbow, etc.)
- [ ] **Phantom** - Solana wallet integration
- [ ] **Uniswap/DEX** - Direct DEX trading via wallet

### P1 - Within 30 Days ✅ COMPLETE

- [x] **Congressional Tracker UI** 🏛️ ✅ COMPLETE - `/congress` page
  - List all politicians with performance stats
  - Enable/disable tracking per politician  
  - Configure copy scale and delay
  - View recent trades and P&L
  - API: `/api/congress` endpoint wired to UI
  
- [x] **Referral Program** 🎁 ✅ COMPLETE - `/referrals` page
  - Unique referral codes per user (nanoid)
  - Share buttons (Twitter, Email, Copy link)
  - Track referrals, signups, conversions
  - $25 credit per converted referral
  - API: `/api/referrals` endpoint
  - DB: `polybot_referrals`, `polybot_referral_clicks`, `polybot_referral_rewards`

- [x] **Backtesting UI** 📊 ✅ COMPLETE - `/backtesting` page
  - Historical data simulation
  - Strategy selector (9+ strategies)
  - Date range picker with presets
  - Performance metrics (Sharpe, drawdown, win rate)
  - Trade-by-trade breakdown
  - API: `/api/backtests` endpoint
  - DB: `polybot_backtests`, `polybot_backtest_trades`

- [x] **Better Mobile UX** 📱 ✅ COMPLETE
  - Bottom tab navigation (Dashboard, Markets, Bets, Settings)
  - Hamburger menu with full navigation
  - Safe area insets for notched phones
  - Touch-friendly tap targets (44px min)
  - Responsive CSS throughout
  - Files: `MobileNavigation.tsx`, `globals.css` updates

- [x] **Help Docs** 📚 ✅ COMPLETE - `/help` page
  - Knowledge base with categories
  - Getting Started, Trading, Strategies, API, Billing, Troubleshooting
  - Search functionality
  - Markdown rendering (react-markdown)
  - Helpful/Not Helpful feedback
  - Contact form
  - API: `/api/help` endpoint
  - Static fallback articles if DB unavailable

- [x] **Live Chat** 💬 ✅ COMPLETE - Crisp integration
  - `CrispChat.tsx` component
  - Auto-populates user email
  - Hides on public routes (landing, login, signup)
  - Set `NEXT_PUBLIC_CRISP_WEBSITE_ID` env var to enable

---

## 🔥 CRITICAL ISSUES (December 29, 2025)

### P0 - BLOCKING ISSUES

- [x] **Settings Save Error** 🚨 ✅ FIXED
  - RSI enable was failing with "SAVE FAILED (Debug Mode)"
  - Fixed: API route now uses service role key to bypass RLS
  - File: `/admin/src/app/api/config/route.ts`
  
- [ ] **Bot Stopped Running** 🚨 - No trades since Dec 28
  - Need to investigate why bot stopped
  - Add monitoring/alerting for bot health
  - Add auto-restart capability (systemd/PM2)
  - Consider Uptime Robot or similar for external monitoring
  
- [x] **Version Badge Not Showing for Admin** ✅ FIXED
  - Changed from `useTier` to `useAuth` for admin detection
  - Admin email check: `session?.user?.email === 'rutrohd@gmail.com'`
  - File: `/admin/src/components/Header.tsx`
  
- [x] **Dashboard Defaults to "All Data"** ✅ FIXED
  - Now defaults to user's current session mode (Paper/Live)
  - Reads from `polybot_config.is_live_trading` via useConfig hook
  - Persists filter selection to localStorage
  - File: `/admin/src/app/dashboard/page.tsx`
  
- [x] **Analytics Charts Redesigned** ✅ COMPLETE
  - Replaced with professional TradingView-style charts
  - Uses lightweight-charts v5 library
  - CumulativePnLChart: Multi-colored lines per strategy over time
  - DailyPnLChart: Baseline chart showing daily gains/losses (green/red)
  - Interactive legend with hover highlighting
  - File: `/admin/src/components/TradingViewChart.tsx`

### P0.5 - IBKR Real-Time Pricing ✅ COMPLETE

- [x] **Show Real-Time IBKR Prices** ✅ COMPLETE
  - If IBKR connected: Shows IBKR prices (bid/ask)
  - If Alpaca only: Shows Alpaca prices
  - If both connected: Shows both, IBKR prioritized
  - Trade modal fetches live quotes before placing order
  - Support for market and limit orders
  - Files:
    - `/admin/src/app/api/ibkr/quote/route.ts` - Quote endpoint
    - `/admin/src/components/StockTradeModal.tsx` - Trade modal
    - `/admin/src/app/api/trades/stock/route.ts` - Trade execution
    - `/admin/src/app/markets/page.tsx` - Updated markets page

### Bot Reliability & Monitoring ✅ COMPLETE

- [x] **Bot Health Monitoring** ✅ COMPLETE
  - `/api/bot/health` endpoint checks bot status
  - `BotHealthIndicator` component shows detailed status
  - `BotHealthBadge` in header for quick status view
  - Dashboard shows bot health card
  - Checks: trades/24h, last trade, connection, logs
  - Auto-refreshes every 30 seconds
  - Files:
    - `/admin/src/app/api/bot/health/route.ts`
    - `/admin/src/components/BotHealthIndicator.tsx`
    - `/admin/src/components/Header.tsx` (badge)
    - `/admin/src/app/dashboard/page.tsx` (health card)
    - `/scripts/create_heartbeat_table.sql` (run this!)
  
- [x] **Add Bot Heartbeat to Python Bot** ✅ COMPLETE
  - Bot writes detailed heartbeat every 60 seconds
  - Includes: scan_count, active_strategies, memory, CPU, errors, trades
  - Writes to both polybot_status (legacy) and polybot_heartbeat (new)
  - Added psutil dependency for system monitoring
  
- [ ] **Auto-Restart Capability**
  - Systemd service with automatic restart
  - PM2 process manager alternative
  - Docker restart policy if containerized
  - Log rotation to prevent disk fill

- [x] **External Uptime Monitoring** ✅ INSTRUCTIONS PROVIDED
  - Use Uptime Robot (free) - uptimerobot.com
  - Monitor: Bot health endpoint, Admin dashboard, API health
  - Set 5-minute intervals with email alerts

---

## 🚨 URGENT FIXES (December 28, 2025)

### Admin/Security

- [x] **Hide Version Badge from Non-Admins** ✅ - Only show UI/Bot version to admins
- [ ] **Encrypt Secrets at Rest** - API keys stored in DB must be AES-256 encrypted
- [x] **Admin Feature Control Panel** 🎛️ ✅ COMPLETE
  - **Files Created**:
    - `/admin/src/app/admin/features/page.tsx` - Full feature control UI
    - `/admin/src/app/api/admin/features/route.ts` - API for flag management
    - `/admin/src/app/api/admin/features/overrides/route.ts` - User override API
    - `/admin/src/lib/useFeatureFlags.tsx` - Hook for checking flags in components
    - `/scripts/create_feature_flags_table.sql` - Database schema (RUN THIS)
  - **Global Settings**:
    - ✅ Maintenance mode (disable all trading)
    - ✅ Feature flags (enable/disable features globally)
    - ✅ Rollout percentages (gradual feature rollout)
    - ✅ Category grouping (trading, ui, beta, maintenance)
  - **Per-User Settings**:
    - ✅ User-specific feature overrides
    - ✅ Override expiration dates
    - ✅ Reason tracking for audit
    - ✅ Beta tester tracking table
  - **Beta Testing Support**:
    - ✅ Mark features as "beta" category
    - ✅ Whitelist users with overrides
    - ✅ Gradual rollout (% of users)
  - **UI**: `/admin/features` - Create, edit, toggle feature flags
  - **IMPORTANT**: Run `scripts/create_feature_flags_table.sql` in Supabase!

### Missed Money Rethink

- [x] **Rethink Missed Money Page** ✅ COMPLETE → "Failed Trades"
  - **Simplified**: Removed duplicate optimization tab (AI Insights covers this)
  - **Focused**: Only shows actual failed trades with retry functionality
  - **Risk Explanations**: Each trade shows risk impact if retried
    - Low Risk (green): Safe to retry
    - Medium Risk (yellow): Review before retrying  
    - High Risk (red): Caution advised
  - **AI Insights Banner**: Links to `/insights` for strategy tuning
  - **Renamed** in navigation from "Optimizations" to "Failed Trades"
  - **Feature-gated** behind Pro tier
  - File: `/admin/src/app/missed-opportunities/page.tsx`

- [x] **Risk Impact on Recommendations** ✅ COMPLETE
  - Added to AI Insights tuning cards
  - Shows: Risk ↑ (increases), Risk ↓ (decreases), Risk → (neutral)
  - Color-coded: red/green/gray backgrounds
  - Explanations for each impact type
  - File: `/admin/src/app/insights/page.tsx`

### E2E Testing Setup

- [x] **Playwright E2E Testing** ✅ COMPLETE
  - Installed `@playwright/test` with Chromium browser
  - Created `playwright.config.ts` with desktop + mobile projects
  - **80 tests passing** across 6 test files:
    - `navigation.spec.ts` - Core navigation and routing
    - `dashboard.spec.ts` - Main dashboard functionality  
    - `api.spec.ts` - API endpoint integration tests
    - `failed-trades.spec.ts` - Failed trades page tests
    - `ai-insights.spec.ts` - AI insights page tests
    - `feature-flags.spec.ts` - Admin feature control tests
  - Tests handle auth-gated content gracefully
  - **npm scripts**:
    - `npm run test:e2e` - Run all tests
    - `npm run test:e2e:ui` - Interactive UI mode
    - `npm run test:e2e:headed` - See browser
    - `npm run test:e2e:debug` - Debug mode
  - Files: `/admin/e2e/**`, `/admin/playwright.config.ts`

### Diagnostics & Monitoring Overhaul

- [ ] **Enhanced Diagnostics Page** - Full admin control panel
  - Real-time performance metrics
  - Error monitoring with stack traces
  - API health checks (all exchanges, Supabase, Stripe)
  - Queue status and processing times
  - Memory/CPU usage if on dedicated infra

- [ ] **AI Root Cause Analysis** - Gemini integration
  - Auto-analyze errors and suggest fixes
  - "1-click fix" buttons for common issues
  - Pattern detection (recurring errors)

- [ ] **Customer Support Event System**
  - Email-triggered events in UI
  - AI-suggested responses
  - 1-click response templates
  - Conversation history tracking

---

## 🧪 COMPREHENSIVE TEST PLAN

### Testing Strategy

We need E2E testing for:

1. **Auth Flows** - Signup, Login, Logout, Password Reset, MFA
2. **Data Integrity** - All metrics use same data sources
3. **API Endpoints** - All routes return expected data
4. **UI Components** - All pages render without errors
5. **Trading Workflows** - Paper/Live trade execution

### Recommended Testing Stack (Free/Open Source)

| Tool | Purpose | Status |
|------|---------|--------|
| **Playwright** | E2E browser testing | ⬜ Setup needed |
| **Jest** | Unit tests | ⬜ Setup needed |
| **React Testing Library** | Component tests | ⬜ Setup needed |
| **MSW** | API mocking | ⬜ Setup needed |
| **Checkly** | Synthetic monitoring (free tier) | ⬜ Evaluate |

### Test Categories

#### Auth Tests

- [ ] Signup creates user + profile + team
- [ ] Login works with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Password reset flow works end-to-end
- [ ] MFA enrollment and verification
- [ ] Session persistence across page refreshes
- [ ] Logout clears session properly

#### Dashboard Tests

- [ ] Paper Balance matches Supabase data
- [ ] Net P&L calculation is correct
- [ ] Win Rate = wins / total trades
- [ ] Opportunities count matches scan results
- [ ] P&L chart data matches trade history
- [ ] Opportunity Distribution chart is accurate

#### Data Consistency Tests

- [ ] Dashboard metrics = Analytics metrics
- [ ] Trade History count = Dashboard trade count
- [ ] Balance API = Balance UI display
- [ ] All timestamps in correct timezone

#### Strategy Tests

- [ ] Each strategy can be enabled/disabled
- [ ] Strategy settings persist on save
- [ ] Backtest runs and returns results
- [ ] Strategy performance metrics are accurate

#### API Tests

- [ ] All GET endpoints return 200
- [ ] All POST endpoints validate input
- [ ] Auth required endpoints return 401 without token
- [ ] Rate limiting works correctly

### Test Execution Plan

1. **Phase 1**: Setup Playwright + basic smoke tests
2. **Phase 2**: Auth flow tests
3. **Phase 3**: Data consistency tests
4. **Phase 4**: Full regression suite
5. **Phase 5**: CI/CD integration

---

### P2 - Exchange Integrations (Attract More Users)

## 🎲 Poly-Parlay Integration (Prediction Market Parlays)

**Original poly-parlay codebase**: `/Users/rut/poly-parlay/` (Streamlit app, 12K+ lines)
**Target**: Integrate parlay betting into PolyParlay.io as a feature module

### What Poly-Parlay Has (Reusable)

| Module | Lines | Functionality | Reusable? |
|--------|-------|---------------|-----------|
| `app.py` | 2,395 | Main UI, market browser, parlay builder | Extract logic ✅ |
| `trade_execution.py` | 479 | Polymarket CLOB trading | ✅ Port to Python |
| `advanced_analytics.py` | 270 | Kelly Criterion, Monte Carlo, EV calc | ✅ Already Python |
| `market_analytics.py` | 620 | Market analysis, trending | ✅ Already Python |
| `privy_auth.py` | 366 | Privy wallet auth | Already using ✅ |

### Integration Plan

#### Phase 1: Backend Integration (Week 1)

- [ ] **Port Advanced Analytics** - Copy `advanced_analytics.py` functions
  - `kelly_criterion()` - Optimal bet sizing
  - `calculate_expected_value()` - EV calculation
  - `simulate_parlay_outcomes()` - Monte Carlo simulation
  - `detect_correlation()` - Parlay risk analysis
- [ ] **Port Trade Execution** - Adapt `trade_execution.py`
  - `PolyMarketTrader` class for CLOB API
  - User wallet signing via Privy
- [ ] **Create Parlay Service** - New `/src/services/parlay_service.py`
  - `build_parlay(markets, user_id)` - Create parlay
  - `execute_parlay(parlay_id, user_id)` - Execute via CLOB
  - `get_parlay_status(parlay_id)` - Track results

#### Phase 2: API Endpoints (Week 1-2)

- [ ] **GET /api/polymarket/markets** - Fetch available markets
- [ ] **POST /api/parlays/create** - Create new parlay
- [ ] **POST /api/parlays/execute** - Execute parlay trades
- [ ] **GET /api/parlays/user/{user_id}** - Get user's parlays
- [ ] **GET /api/parlays/{id}/status** - Parlay status/results

#### Phase 3: Admin UI (Week 2)

- [ ] **Parlay Builder Page** - `/parlays` route in admin
  - Market browser with search/filter
  - Drag/drop parlay builder
  - Real-time odds calculator
  - Risk analysis display
- [ ] **My Parlays Page** - User's active/completed parlays
- [ ] **Hot Parlays Widget** - Trending parlays on dashboard

#### Phase 4: Monetization (Week 3)

- [ ] **Parlay Limits by Tier**
  - Free: 3 parlays/day
  - Pro: Unlimited parlays
  - Elite: Unlimited + AI suggestions
- [ ] **Premium Analytics**
  - Kelly Criterion (Pro+)
  - Monte Carlo simulation (Pro+)
  - Arbitrage detection (Elite)

### Key Differences from Original

| Aspect | Poly-Parlay (Old) | PolyParlay.io (New) |
|--------|-------------------|---------------------|
| UI | Streamlit | Next.js + Tailwind |
| Auth | Privy standalone | Privy integrated |
| Database | Supabase (separate) | Supabase (shared) |
| Trading | Polymarket only | Multi-platform (Alpaca, IBKR, etc.) |
| Model | SaaS ($4.99-$19.99) | Tiered (Free/Pro/Elite) |

---

### P2 - Growth Features

- [ ] **Copy Trading** - Follow successful traders
- [ ] **API for Developers** - Public API with rate limits
- [ ] **Webhooks** - External integrations
- [ ] **Mobile App** - Native iOS/Android

### 🚫 Skipped/Deferred

- ~~Free Trial Period~~ - Paper trading is always free, no trial needed
- ~~External Monitoring (Sentry/LogRocket)~~ - Building admin logs page instead

---

## 📊 Integration Comparison

| Platform | API Type | KYC | Ease of Setup | User Base |
|----------|----------|-----|---------------|-----------|
| **IBKR** | OAuth/TWS | Full | Complex (gateway) | Pro traders |
| **Alpaca** | API Key | Moderate | Easy | Algo traders |
| **Robinhood** | Unofficial | Full | Medium | Huge retail |
| **Webull** | API Key | Full | Easy | Growing |
| **Coinbase** | OAuth | Full | Easy | Massive crypto |
| **Plaid** | OAuth | None (read) | Very Easy | Universal |
| **WalletConnect** | Web3 | None | Easy | DeFi users |

---

## ✅ Previously Completed (December 26, 2025)

### 🔴 HIGH PRIORITY - SaaS Launch (PolyParlay.io)

#### User Signup & Onboarding Flow

- [x] **CREATE ONBOARDING WIZARD** 🧙 ✅ (ENHANCED Dec 27)
  - [x] Step 1: Welcome message with feature overview
  - [x] Step 2: Wallet info (Privy embedded wallet on Polygon)
  - [x] Step 3: Platform setup links (Polymarket, Kalshi, Alpaca)
  - [x] **NEW: Inline API key entry** - Users can add keys directly in wizard
  - [x] Expandable cards for each platform with API key/secret inputs
  - [x] Help links to each platform's API documentation
  - [x] Visual confirmation when keys saved
  - [x] Step 4: Select up to 3 strategies (Free tier)
  - [x] Step 5: Simulation mode explanation
  - [x] Show progress indicator, allow skip/return later
  - Created: `/admin/src/components/OnboardingWizard.tsx`
  - Created: `/admin/src/components/OnboardingCheck.tsx`

- [x] **SECRETS SYNC VERIFIED** 🔐 ✅ (Dec 27)
  - [x] Supabase `polybot_secrets` is single source of truth
  - [x] Bot reads from Supabase via `db.get_secret()` (already implemented)
  - [x] AWS Secrets Manager only for bootstrap (SUPABASE_URL, SERVICE_ROLE_KEY)
  - [x] Test connection endpoints working (Alpaca, Kalshi, Polymarket, etc.)
  - [x] Fixed key name mismatches (ALPACA_API_SECRET vs ALPACA_SECRET_KEY)

- [x] **LIVE TRADING GATE** 🚨 ✅
  - [x] When user switches sim → live, show multi-step confirmation modal
  - [x] Step 1: Warning about real money, requires checkbox agreement
  - [x] Step 2: User must explicitly enable EACH strategy for live
  - [x] Step 3: Final confirmation with strategy list
  - [x] Check for API keys before allowing live mode
  - [x] All strategies start DISABLED when switching to live
  - [x] **BIG RED WARNING** - Enhanced with massive red header, danger zone, pulsing icons
  - Created: `/admin/src/components/LiveTradingGate.tsx`
  - Updated: `/admin/src/components/TradingModeToggle.tsx`

- [x] **QUICK START GUIDE & CTAs** 📍 ✅
  - [x] Welcome Banner on dashboard for new users
  - [x] Quick Start FAB (floating action button) with setup steps
  - [x] Page-specific CTAs (dashboard, analytics, strategies, history)
  - [x] Setup checklist with progress tracking
  - [x] Upgrade prompts for free users
  - Created: `/admin/src/components/QuickStartGuide.tsx`

- [x] **LEGAL PAGES** 📄 ✅
  - [x] Terms of Service page (`/terms`)
  - [x] Privacy Policy page (`/privacy`)
  - [x] Footer links in landing page
  - Transferred from poly-parlay codebase

- [x] **ADMIN USER TIER MANAGEMENT** 👑 ✅
  - [x] Admin can view all users with tier badges
  - [x] Edit user tier (Free/Pro/Elite)
  - [x] Set custom pricing or discount percentage
  - [x] Mark accounts as "comped" (free access)
  - [x] Add admin notes (internal only)
  - Created: `/admin/src/components/UserTierEditor.tsx`
  - Updated: `/admin/src/app/users/page.tsx`
  - Updated: `/admin/src/app/api/users/route.ts`

- [x] **TIER-BASED STRATEGY LOCKING** 🔒 ✅
  - [x] Free tier limited to 3 strategies (single_platform_arb, news_arbitrage, market_making)
  - [x] Locked strategies show "Pro" badge with lock icon
  - [x] Locked strategies cannot be toggled on
  - [x] Alert when hitting free tier limit
  - Updated: `/admin/src/app/strategies/page.tsx`

- [x] **TERMINOLOGY CHANGE** 📝 ✅
  - [x] Changed all "Simulation" to "Paper Trading" in UI
  - [x] Updated: TradingModeToggle, OnboardingWizard, QuickStartGuide
  - [x] Updated: Dashboard page, ManualTradeModal, Tooltip, UserTierEditor

- [x] **SECRETS PAGE IMPROVEMENTS** 🔐 ✅
  - [x] API key management with edit/delete (EXISTS)
  - [x] Platform signup links (Polymarket, Kalshi, Alpaca) (EXISTS)
  - [x] Add setup status indicators (connected/not connected)
  - [x] Add "Test Connection" button for each platform category
  - [x] Created /api/test-connection endpoint for Alpaca, Kalshi, etc.

### 🐛 BUGS TO INVESTIGATE

- [x] **FEE CALCULATION BUG** 💰 (INVESTIGATED - Data Issue)
  - Balance Details modal shows $332+ in "Total Fees Paid"
  - **Root Cause**: `stats_json.total_fees_paid` in `polybot_simulation_stats` table has accumulated fees from previous sessions
  - **Solution**: User needs to click "Reset Simulation" in Settings to clear old data
  - The Reset endpoint properly initializes `stats_json` with `total_fees_paid: '0.00'`
  - Files checked:
    - `/admin/src/components/StatDetailModal.tsx` - Frontend display logic ✓
    - `/admin/src/app/api/simulation/reset/route.ts` - Reset logic correctly clears fees ✓
    - `/src/simulation/paper_trader_realistic.py` - Fee accumulation logic ✓
  - **Note**: Not a code bug - just stale data from previous sessions

- [x] **STRIPE INTEGRATION** 💳 ✅
  - [x] Wire up Stripe checkout for Pro ($9.99/mo) and Elite ($99.99/mo) - UpgradeModal
  - [x] Webhook sets subscription_tier based on Stripe price ID
  - [x] Handle webhooks for subscription status changes
  - [x] Display current tier in settings (SubscriptionSection)
  - [x] Add upgrade prompts when hitting tier limits

#### Tier-Based Access Control

- [x] **TIER LIMITS DEFINED** ✅ (in `/admin/src/lib/privy.ts`)

  ```text
  Free:  3 strategies, 100 trades/mo, basic analytics
  Pro:   All strategies, 1000 trades/mo, AI analytics, autonomous RSI
  Elite: Unlimited trades, whale tracking, congressional tracker, priority support
  ```

- [x] **FREE TIER DEFAULTS** ✅
  - Default enabled_strategies: ['single_platform_arb', 'news_arbitrage', 'market_making']
  - Autonomous RSI: DISABLED by default
  - Live trading: DISABLED by default
  - live_enabled_strategies: EMPTY by default (user must explicitly enable)

- [x] **LIVE TRADING GATE** 🚨 ✅
  - [x] When user switches from simulation to live, show confirmation modal
  - [x] Require explicit toggle for EACH strategy they want live
  - [x] Show risk level for each strategy
  - [x] Block live trading if no platform API keys configured
  - [x] All strategies disabled by default when going live

- [x] **STRATEGY LIMITING BY TIER** 📊 ✅
  - [x] Free users: Max 3 strategies enabled at once
  - [x] Show "Upgrade to Pro" when trying to enable 4th strategy (UpgradeModal)
  - [x] Pro users: All strategies available
  - [x] Elite users: All strategies + whale/congress trackers

#### Autonomous RSI Control

- [x] **AUTONOMOUS RSI TOGGLE ADDED** ✅
  - `autonomous_rsi_enabled` defaults to False
  - Config options: min_trades, adjust_interval_hours, max_rsi_adjustment
  - Pro/Elite feature only

- [x] **UI FOR AUTONOMOUS RSI** 🤖 ✅
  - [x] Add toggle in Settings page (Overview tab, after Subscription section)
  - [x] Show current RSI thresholds
  - [x] Config for min_trades, adjustment_pct, learning_rate
  - [x] Only show for Pro/Elite users

### 🟢 USER JOURNEY ANALYSIS (Landing → Trading)

#### Complete User Flow (Implemented)

1. **Landing Page** → User visits PolyParlay.io
   - [x] Hero section with value proposition
   - [x] Feature grid showing Free/Pro/Elite
   - [x] Pricing cards with CTAs
   - [x] "Get Started Free" button

2. **Signup/Login** → Privy authentication
   - [x] Email OTP login
   - [x] Embedded wallet creation (Polygon)
   - [x] Non-custodial setup

3. **Onboarding Wizard** (NEW) → First-time user setup
   - [x] Welcome step
   - [x] Wallet explanation
   - [x] Platform connection links
   - [x] Strategy selection (3 for Free)
   - [x] Simulation mode intro

4. **Dashboard** → Main trading view
   - [x] Welcome banner for new users
   - [x] Quick Start FAB
   - [x] Trading mode toggle (Sim/Live)
   - [x] Real-time stats and charts
   - [x] Recent trades feed

5. **Secrets** → API key management
   - [x] Platform signup links
   - [x] API key entry with masking
   - [x] Re-auth for sensitive ops

6. **Strategies** → Configure trading strategies
   - [x] Strategy cards with explanations
   - [x] Enable/disable toggles
   - [x] Parameter configuration
   - [ ] Tier-based locking (TODO)

7. **Settings** → Full configuration
   - [x] Trading mode toggle
   - [x] Risk parameters
   - [x] Platform enables
   - [x] Simulation parameters

8. **Going Live** (NEW) → Live trading activation
   - [x] Multi-step confirmation modal
   - [x] Risk acknowledgment checkbox
   - [x] Per-strategy enable selection
   - [x] API key verification
   - [x] Final confirmation

### 🟡 MEDIUM PRIORITY - Strategy Implementation

#### v1.1.15 - Strategy Implementation & Documentation

- [x] **SPIKE HUNTER STRATEGY IMPLEMENTED** 🎯
  - Created `src/strategies/spike_hunter.py`
  - Detects 2%+ price moves in <30 seconds
  - Mean-reversion trades with tight stops (3% SL, 1.5% TP)
  - Max 5 min hold time, max 3 concurrent positions
  - Based on Twitter alpha from @0xReflection, @hanakoxbt, @carverfomo

- [x] **ALL STRATEGIES ENABLED FOR SIMULATION** ✅
  - Changed all `enable_*` config defaults from False to True
  - Strategies now enabled by default:
    - ✅ Spike Hunter (NEW)
    - ✅ BTC Bracket Arb
    - ✅ Bracket Compression
    - ✅ Kalshi Mention Snipe
    - ✅ Whale Copy Trading
    - ✅ Selective Whale Copy
    - ✅ Macro Board
    - ✅ Fear Premium Contrarian
    - ✅ Congressional Tracker
    - ✅ Political Event Strategy
    - ✅ High Conviction Strategy
    - ✅ AI Superforecasting
    - ✅ 15-Min Crypto Scalping

- [ ] **UPDATE DOCUMENTATION** 📝
  - [ ] Update `/docs` page with new Spike Hunter strategy
  - [ ] Update strategy explanations for all 14+ strategies
  - [ ] Add Twitter research sources and expected returns
  - [ ] Document config keys and their defaults

- [x] **UPDATE STRATEGIES PAGE** 📊 ✅
  - [x] Add Spike Hunter to `admin/src/app/strategies/page.tsx`
  - [x] Verify all strategies have config toggles
  - [ ] Add expected return ranges for each strategy
  - [x] Wire up settings sliders for Spike Hunter

- [ ] **UPDATE WORKFLOWS PAGE** 🔄
  - [ ] Add Spike Hunter workflow diagram
  - [ ] Document WebSocket integration for real-time detection
  - [ ] Show strategy interconnections

- [ ] **WIRE UP NEW STRATEGIES TO ALL PAGES** 🔌
  - [ ] Analytics page: Add Spike Hunter to strategy breakdown charts
  - [ ] Dashboard: Show Spike Hunter in active strategies
  - [ ] History page: Include Spike Hunter trades in history
  - [ ] Insights page: Add Spike Hunter performance metrics
  - [ ] Strategy Builder: Include Spike Hunter as base template

- [ ] **IMPLEMENT LIVE TRADING** 🚨 (PRIORITY #1 for post-simulation)
  - `bot_runner.py` line 1287: `if self.simulation_mode:` has no `else` for live execution
  - Need to implement actual order placement for single-platform arbitrage
  - Wire up Polymarket API for live order execution (via CLOB)
  - Wire up Kalshi API for live order execution
  - **BLOCKED UNTIL:** Simulation shows consistent profitability

- [ ] **Monitor v1.1.14 conversion rate** - Target 60-80% for single-platform arb
  - Was 12% due to double-filtering bug (FIXED)
  - Check logs for "SINGLE-ARB" trades

- [ ] **Validate Polymarket single-platform P&L**
  - Was showing -$587 with 59% win rate (BAD!)
  - Fixed simulation parameters:
    - Single-platform loss rate: 3% (was 18%)
    - Single-platform exec failure: 8% (was 20%)
    - Polymarket fee: 0% (was applying 7%)
  - Expected after fix: ~85% win rate, positive P&L

- [ ] **Investigate live opportunities not being traded** (from screenshot)
  - +13.05%, +19.80%, +6.75%, +9.00% opportunities showing in UI
  - Check if scanner is detecting, why paper trader not executing
  - Could be cooldown logic, market already traded, or timing

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

---

## 🏗️ Infrastructure Scaling Plan

**Current State**: AWS Lightsail MICRO tier ($7/mo), single container
**Target**: Scale-ready architecture, potential AWS DB migration

### Current Architecture

| Component | Service | Cost | Status |
|-----------|---------|------|--------|
| Bot | Lightsail Container (MICRO) | $7/mo | ✅ Running |
| Admin UI | Vercel (Free tier) | $0 | ✅ Running |
| Database | Supabase (Free tier) | $0 | ✅ Running |
| Domain | polyparlay.io | ~$12/yr | ✅ Active |

### Scaling Milestones

| Users | Bot Tier | Database | Monthly Cost |
|-------|----------|----------|--------------|
| 0-50 | Lightsail MICRO | Supabase Free | ~$7 |
| 50-200 | Lightsail SMALL | Supabase Pro ($25) | ~$32 |
| 200-500 | Lightsail MEDIUM | Supabase Pro | ~$65 |
| 500-1K | Lightsail LARGE | AWS RDS | ~$150 |
| 1K+ | Fargate/ECS | AWS RDS Multi-AZ | ~$300+ |

### AWS Database Migration (When Ready)

- [ ] **Create RDS PostgreSQL** - us-east-1
- [ ] **Migrate Schema** - Export Supabase → Import RDS
- [ ] **Update Connection Strings** - Bot + Admin UI
- [ ] **Enable RLS Alternative** - Use application-level checks
- [ ] **Set Up Backups** - Automated daily snapshots
- [ ] **Monitoring** - CloudWatch alarms

### Why Keep Supabase (For Now)

1. **Free RLS** - Row-level security built-in
2. **Free Auth** - Could use for backup auth
3. **Realtime** - WebSocket subscriptions
4. **Edge Functions** - Serverless compute
5. **Storage** - File uploads if needed

### Future Considerations

- **Read Replicas** - For analytics queries
- **Connection Pooling** - PgBouncer for high concurrency
- **Caching** - Redis for frequently accessed data
- **CDN** - CloudFront for static assets

---

## 📊 Strategic Priorities Summary

### Week 1 (URGENT - Launch Blocker)

1. ✅ ~~IBKR Web API~~ - Complete
2. ✅ ~~AlpacaClient Multi-Tenant~~ - Update for per-user keys - DONE
3. ✅ ~~CCXTClient Multi-Tenant~~ - Update for per-user keys - DONE
4. ✅ ~~Enable BotManager~~ - Per-user bot instances - DONE (bot_runner updated)
5. ✅ ~~Email System~~ - Resend.com integration - DONE

### Week 2 (User Experience)

1. ✅ ~~Landing Page~~ - polyparlay.io public site - EXISTS at /landing
2. 📋 **Admin Logs Page** - Bot troubleshooting
3. 🎲 **Parlay Backend** - Port poly-parlay analytics

### Week 3 (Growth)

1. 🎲 **Parlay UI** - Parlay builder page
2. 🔗 **Referral Program** - Viral growth
3. 📊 **Backtesting UI** - Historical testing

### Target Launch Criteria

- [x] Per-user API key isolation ✅
- [x] Email system working ✅
- [x] Landing page live ✅
- [ ] At least 5 beta testers
- [ ] 0 critical bugs

---

*Last Updated: December 27, 2025*

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
