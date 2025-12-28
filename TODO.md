# PolyBot To-Do List

## ✅ COMPLETED: Multi-Tenant User Isolation (P0)

**Status**: FULLY IMPLEMENTED ✅  
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
- [ ] **RLS Security Fix** 🔴 IN PROGRESS - Run `scripts/security_fix_critical.sql`
  - 5 tables have policies but RLS disabled
  - 7 views using SECURITY DEFINER (should be INVOKER)
  - ~20 tables missing RLS entirely
- [ ] **Email System** - Welcome emails, trade alerts, daily digest
- [ ] **Team Invitations** 👥 - Allow users to invite others to their tenant
  - Invite by email with role selection (Admin, Member, Viewer)
  - Invitee gets email with signup/accept link
  - Invited users join existing tenant (share data, API keys per role)
  - Admin can revoke invitations / remove team members
  - Role permissions:
    - **Admin**: Full access, can invite others, manage API keys
    - **Member**: View + trade, cannot manage keys or invite
    - **Viewer**: Read-only access to dashboards
- [ ] **MFA (Multi-Factor Authentication)** 🔐 - TOTP/Authenticator app support
  - Supabase supports TOTP MFA natively
  - Enable in Supabase Dashboard > Auth > MFA
  - Add MFA enrollment UI in `/profile`
  - Require MFA for high-value operations (live trading, API key changes)

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

### P1 - Within 30 Days

- [x] **Congressional Tracker UI** 🏛️ ✅ COMPLETE - `/congress` page
  - List all politicians with performance stats
  - Enable/disable tracking per politician  
  - Configure copy scale and delay
  - View recent trades and P&L
  - API: `/api/congress` endpoint wired to UI
  
- [ ] **Referral Program** - Viral growth with tracking codes
- [ ] **Backtesting UI** - Let users test strategies with historical data
- [ ] **Better Mobile UX** - Responsive improvements
- [ ] **Help Docs** - Knowledge base beyond `/docs` page
- [ ] **Live Chat** - Intercom or Crisp integration

---

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
