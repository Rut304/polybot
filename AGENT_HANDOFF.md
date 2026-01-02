# PolyBot Agent Handoff Document

**Last Updated:** January 1, 2026  
**Current Version:** v1.1.25 (Build #98)  
**Bot Deployment:** v29 ACTIVE on AWS Lightsail (us-east-1)  
**Admin UI:** Auto-deploys from GitHub to Vercel (admin-app → polyparlay.io)  
**Status:** 🟢 RUNNING - Simulation Mode

---

## 🚨 READ THIS FIRST - NEW AGENT ONBOARDING

Welcome to PolyBot! This is a sophisticated automated trading platform. **DO NOT make changes until you understand the system.** This document is your bible.

### Required Reading Order (30 min investment)

1. **This document** - Complete architecture, rules, and context
2. **`TODO.md`** - Current priorities and task status
3. **`docs/STRATEGY_ARCHITECTURE.md`** - How 35+ strategies work
4. **`src/bot_runner.py` (lines 1-200)** - Bot orchestration overview
5. **`admin/src/app/docs/page.tsx`** - UI strategy documentation

### Quick Health Check Commands

```bash
# 1. Check if bot is alive
curl -s "https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status" | jq .

# 2. Check recent deployments
aws lightsail get-container-service-deployments --service-name polyparlay --region us-east-1 --query 'deployments[0].{version:version,state:state}'

# 3. Run E2E tests
cd /Users/rut/polybot/admin && npx playwright test --reporter=line

# 4. Check for uncommitted changes
git status
```

---

## ⚠️ CRITICAL RULES - VIOLATIONS BREAK PRODUCTION

### Rule 1: NEVER Use Vercel CLI

```bash
# ❌ WRONG - Creates orphan projects
vercel
vercel --prod

# ✅ CORRECT - Always use Git
git push origin main
```

**Root Cause:** Running `vercel` CLI creates `/.vercel/project.json` pointing to a new project. Only `/admin/.vercel/` should exist (linked to admin-app). Delete any `/.vercel/` at repo root immediately.

### Rule 2: Database Changes Need Migration Scripts

Never modify the database schema directly. Always:
1. Create a SQL file in `/scripts/` 
2. Test locally first
3. Run via Supabase SQL Editor OR use `python scripts/run_sql.py`
4. Document in this handoff

### Rule 3: Test Before AND After Changes

```bash
# Before making changes
cd admin && npx playwright test

# After making changes
cd admin && npx playwright test
git push origin main  # Only if tests pass
```

### Rule 4: Never Commit Secrets

- All secrets go in `.env` (gitignored)
- GitHub Secrets for CI/CD
- Use `os.environ.get()` in code

---

## 🏗️ COMPLETE ARCHITECTURE

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              POLYBOT ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐         ┌─────────────────────────────────────┐   │
│   │   ADMIN DASHBOARD   │         │         BOT ENGINE (Python)          │   │
│   │   Next.js 14        │         │         AWS Lightsail                │   │
│   │                     │   REST  │                                       │   │
│   │  • 50+ pages        │ ◄─────► │  • 35+ trading strategies            │   │
│   │  • Vercel hosted    │         │  • Multi-exchange support            │   │
│   │  • polyparlay.io    │         │  • 12 exchanges integrated           │   │
│   └─────────────────────┘         │  • Simulation & Live modes           │   │
│            │                       └─────────────────────────────────────┘   │
│            │                                        │                        │
│            ▼                                        ▼                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         SUPABASE (PostgreSQL)                        │   │
│   │                                                                       │   │
│   │  CORE TABLES:                                                        │   │
│   │  • polybot_config          - 349+ columns of bot configuration       │   │
│   │  • polybot_simulated_trades- All trade history (simulation + live)   │   │
│   │  • polybot_positions       - Current open positions                  │   │
│   │  • polybot_status          - Bot health/heartbeat                    │   │
│   │  • polybot_profiles        - User profiles + roles                   │   │
│   │  • user_secrets            - Encrypted API keys                      │   │
│   │  • user_exchange_credentials - Per-user exchange OAuth               │   │
│   │                                                                       │   │
│   │  MULTI-TENANT: RLS (Row Level Security) ENABLED ✓                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         12 SUPPORTED EXCHANGES                        │   │
│   ├─────────────────────────────────────────────────────────────────────┤   │
│   │  PREDICTION MARKETS:          CRYPTO:            TRADITIONAL:        │   │
│   │  • Polymarket (CLOB API)      • Binance          • Alpaca (Stocks)   │   │
│   │  • Kalshi                     • Coinbase         • IBKR (Web API)    │   │
│   │                               • Kraken           • Webull            │   │
│   │                               • KuCoin                               │   │
│   │                               • OKX                                  │   │
│   │                               • Bybit                                │   │
│   │                               • Hyperliquid                          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action (UI) 
    → API Route (/api/*)
    → Supabase Query (with RLS)
    → Response to UI

Bot Action:
    → Strategy Signals
    → Trade Execution (exchange APIs)
    → Log to Supabase (polybot_simulated_trades)
    → Update polybot_status (heartbeat)
```

---

## 📁 CODEBASE STRUCTURE

### Python Bot (`/src/`)

```
src/
├── bot_runner.py              # Main orchestrator (4000+ lines) - THE BRAIN
├── config.py                  # Configuration manager (1500+ lines)
├── manager.py                 # Supabase data manager
├── logging_handler.py         # Structured logging
├── bootstrap_config.py        # Startup configuration
│
├── exchanges/                 # Exchange integrations
│   ├── __init__.py           # Exchange registry
│   ├── polymarket_client.py  # Polymarket CLOB + Gamma API
│   ├── kalshi_client.py      # Kalshi REST API
│   ├── alpaca_client.py      # Alpaca stock trading
│   ├── ibkr_web_client.py    # IBKR Web API (OAuth) ← PREFERRED
│   ├── binance_client.py     # Binance spot/futures
│   ├── coinbase_client.py    # Coinbase Advanced Trade
│   └── ... (12 total)
│
├── strategies/                # Trading strategies (35+)
│   ├── arbitrage_single.py   # Single-platform arbitrage
│   ├── arbitrage_cross.py    # Cross-platform arbitrage
│   ├── whale_copy_trading.py # Follow whale wallets
│   ├── crypto_15min_scalping.py # High-frequency scalping
│   ├── ai_superforecasting.py # Gemini AI predictions
│   ├── momentum_*.py         # Various momentum strategies
│   ├── mean_reversion_*.py   # Mean reversion strategies
│   └── ... (35+ total)
│
├── services/                  # Shared services
│   └── unified_market_data.py # Multi-source market data
│
└── database/                  # Database utilities
    ├── client.py             # Supabase client wrapper
    └── sql/                  # Migration scripts
```

### Admin Dashboard (`/admin/`)

```
admin/
├── src/
│   ├── app/                   # Next.js 14 App Router (50+ pages)
│   │   ├── page.tsx          # Landing/redirect
│   │   ├── dashboard/        # Main dashboard
│   │   ├── settings/         # Bot configuration (2357 lines!)
│   │   ├── strategies/       # Strategy management
│   │   ├── analytics/        # Performance charts
│   │   ├── docs/             # Strategy documentation
│   │   ├── diagnostics/      # System health
│   │   ├── secrets/          # API key management
│   │   ├── users/            # User management (admin)
│   │   └── api/              # 25+ API routes
│   │
│   ├── components/            # Reusable components
│   │   ├── PlatformSetupWizard.tsx # Exchange setup guide (NEW)
│   │   ├── BotStartCTA.tsx   # Start bot prompt (NEW)
│   │   ├── Header.tsx        # Navigation header
│   │   └── ... (30+ components)
│   │
│   └── lib/                   # Utilities
│       ├── supabase.ts       # Supabase client
│       ├── hooks.ts          # React Query hooks
│       ├── auth.tsx          # Auth context
│       └── useTier.tsx       # Subscription tiers
│
├── e2e/                       # Playwright E2E tests
│   ├── schema-validation.spec.ts # NEW: DB schema checks
│   ├── metrics-accuracy.spec.ts  # Critical: number accuracy
│   ├── data-verification.spec.ts # Critical: data consistency
│   └── ... (16 spec files, 261+ tests)
│
└── public/
    └── docs/
        └── platforms-reference.md # Platform setup guide
```

### Scripts & DevOps

```
scripts/
├── deploy.sh                  # Bot deployment to Lightsail
├── bump-version.sh            # Version management
├── validate_schema.py         # NEW: Schema mismatch detection
├── auto_fix_schema.py         # NEW: Generate fix SQL
├── run_sql.py                 # NEW: Execute SQL via Management API
├── run_sql_direct.py          # NEW: Execute SQL via direct connection
└── *.sql                      # Database migrations (50+ files)

.github/workflows/
├── schema-validation.yml      # NEW: CI/CD schema checks (notify only)
├── deploy-bot.yml             # Bot deployment workflow
└── ... (other workflows)
```

---

## 💰 TRADING STRATEGIES DEEP DIVE

### Strategy Categories

| Category | Strategies | Risk Profile |
|----------|------------|--------------|
| **Prediction Market Arbitrage** | Single-platform, Cross-platform, BTC Bracket | Low |
| **Crypto Scalping** | 15-min Scalping, Spike Hunter, Grid Trading | Medium-High |
| **Momentum** | Stock Momentum, Sector Rotation, Earnings | Medium |
| **Mean Reversion** | RSI, Pairs Trading, Dividend Growth | Medium |
| **Copy Trading** | Whale Following, Congressional Tracker | Medium |
| **AI-Powered** | Superforecasting (Gemini), News Sentiment | Medium |
| **Options** | Covered Calls, Iron Condor, Wheel Strategy | Medium-High |

### High-Confidence Strategies (Production Ready)

| Strategy | Confidence | Expected APY | How It Works |
|----------|------------|--------------|--------------|
| **Single-Platform Arb** | 95% | 50-200% | Buy YES+NO when sum < $1 |
| **Cross-Platform Arb** | 90% | 30-100% | Price diff Polymarket vs Kalshi |
| **15-Min Crypto Scalping** | 90% | 50-200% | Quick trades on price spikes |
| **BTC Bracket Arb** | 85% | 20-50% | Exploit bracket pricing |
| **Funding Rate Arb** | 85% | 15-50% | Long spot, short perp when funding high |

### Strategy Configuration

All strategies configured via `polybot_config` table (349+ columns):

```sql
-- Example: Enable arbitrage strategies
UPDATE polybot_config SET 
  enable_polymarket_single_arb = true,
  enable_kalshi_single_arb = true,
  enable_cross_platform_arb = true,
  poly_single_min_profit_pct = 0.5,  -- 0.5% minimum profit
  max_position_size = 500            -- $500 max per trade
WHERE user_id = 'your-user-id';
```

---

## 🔧 ENVIRONMENT & SECRETS

### Local Development (.env)

```bash
# Core Supabase (UPDATED Jan 1, 2026)
SUPABASE_URL=https://ytaltvltxkkfczlvjgad.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Service role (bypasses RLS)
SUPABASE_ANON_KEY=eyJ...            # Public anon key
SUPABASE_ACCESS_TOKEN=sbp_...       # Management API token
SUPABASE_MANAGEMENT_TOKEN=sbp_...   # Same as above (alias)

# Exchanges (examples)
POLYMARKET_API_KEY=...
POLYMARKET_SECRET=...
KALSHI_API_KEY=...
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
IBKR_USERNAME=...
IBKR_PASSWORD=...

# Optional
GEMINI_API_KEY=...                  # For AI Superforecasting
```

### GitHub Secrets (CI/CD)

Required secrets in GitHub repo settings:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (UPDATED Jan 1, 2026)
- `SUPABASE_MANAGEMENT_TOKEN` (UPDATED Jan 1, 2026)
- `SUPABASE_ACCESS_TOKEN` (UPDATED Jan 1, 2026)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `LIGHTSAIL_CONTAINER_NAME`

### Vercel Environment Variables

Set in Vercel project settings for admin-app:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOT_URL` (Lightsail container URL)
- `VERCEL_DEPLOY_HOOK_URL` (optional, for redeploy button)

---

## 🧪 TESTING GUIDE

### Running E2E Tests

```bash
cd /Users/rut/polybot/admin

# Run all tests
npx playwright test

# Run with UI (debugging)
npx playwright test --ui

# Run specific file
npx playwright test schema-validation.spec.ts

# Run specific test
npx playwright test -g "should verify all config columns exist"

# Show report
npx playwright show-report
```

### Test Coverage (261+ tests)

| Spec File | Tests | Purpose |
|-----------|-------|---------|
| `schema-validation.spec.ts` | NEW | DB schema matches code |
| `metrics-accuracy.spec.ts` | 57 | **CRITICAL**: Number accuracy |
| `data-verification.spec.ts` | 57 | **CRITICAL**: Data consistency |
| `settings.spec.ts` | 20 | Settings save correctly |
| `trading.spec.ts` | 26 | Trading workflows |
| `navigation.spec.ts` | 12 | Page routing |
| `auth.spec.ts` | 12 | Login/logout flows |
| `accessibility.spec.ts` | 24 | WCAG compliance |

### Schema Validation (NEW!)

We now have automated schema validation to prevent the `scalp_15min_entry_threshold` type errors:

```bash
# Run schema validator
python scripts/validate_schema.py

# If mismatches found, generate fix SQL
python scripts/auto_fix_schema.py

# Execute fix SQL
python scripts/run_sql.py scripts/fix_all_missing_columns.sql
```

CI/CD automatically checks schema on push and creates GitHub Issues for mismatches.

---

## 📊 CURRENT STATUS

### System Health Matrix

| Component | Status | Details |
|-----------|--------|---------|
| Bot (Lightsail) | 🟢 RUNNING | v1.1.25, Build #98, Deployment v29 |
| Admin UI (Vercel) | 🟢 LIVE | polyparlay.io, auto-deploy from main |
| Database (Supabase) | 🟢 HEALTHY | 349+ config columns, RLS enabled |
| E2E Tests | 🟢 PASSING | 261+ tests across 16 spec files |
| Schema Validation | 🟢 NEW | Auto-checks on CI/CD |

### Recent Session Accomplishments (Jan 1, 2026)

1. ✅ **Schema Validation CI/CD** - Auto-detects DB column mismatches, creates GitHub issues
2. ✅ **SQL Runner Scripts** - Execute SQL without manual copy-paste (`run_sql.py`)
3. ✅ **Fixed Crisp Double-Loading** - Was causing account ban (removed from layout.tsx)
4. ✅ **Removed Hardcoded Secrets** - All scripts now use env vars
5. ✅ **Platform Setup Wizard** - Guided setup for all 12 exchanges (sim vs live modes)
6. ✅ **Bot Start CTA** - Prominent start button with subscription check
7. ✅ **Fixed Vercel Duplicate** - Deleted orphan root `.vercel/` folder
8. ✅ **Updated All Supabase Keys** - .env + GitHub secrets refreshed

**Files Created/Modified This Session:**
- `.github/workflows/schema-validation.yml` (NEW)
- `scripts/validate_schema.py` (NEW)
- `scripts/auto_fix_schema.py` (NEW)
- `scripts/run_sql.py` (NEW)
- `scripts/run_sql_direct.py` (NEW)
- `scripts/fix_all_missing_columns.sql` (NEW)
- `admin/src/components/PlatformSetupWizard.tsx` (NEW)
- `admin/src/components/BotStartCTA.tsx` (NEW)
- `admin/e2e/schema-validation.spec.ts` (NEW)
- `admin/src/app/layout.tsx` (removed Crisp duplicate)
- `scripts/reset_simulation.py` (removed hardcoded secrets)
- `scripts/test_p0_*.py` (removed hardcoded secrets)

---

## 📋 NEXT STEPS & RECOMMENDATIONS

### Immediate Priorities

1. **Test Settings Save** - With Muschnick2 account, verify all settings save without errors
2. **Run the Schema Fix SQL** - Execute `scripts/fix_all_missing_columns.sql` if not done
3. **Verify Crisp Ban Resolution** - Check if chat widget works, contact support@crisp.chat if needed

### High Priority (Before Launch)

1. **Perfect Metrics Accuracy**
   - P&L calculations must match trade history
   - Win rate must be mathematically correct
   - ROI calculations verified against raw data

2. **Live Trading Validation**
   - Paper trade for 2 weeks minimum
   - Compare simulation vs actual execution
   - Verify risk limits work correctly

3. **User Onboarding Flow**
   - Platform setup wizard complete ✅
   - Add success confirmation messages
   - Add error recovery guidance

### Medium Priority (Post-Launch)

1. **Mobile Optimization** - Dashboard responsive but needs polish
2. **Performance** - Large settings page (2357 lines) could be split
3. **Monitoring** - Add CloudWatch alarms, PagerDuty integration
4. **Data Export** - Tax reports, trade history CSV

### Technical Debt

1. **Settings Page Refactor** - 2357 lines, should be componentized
2. **Strategy Page Cleanup** - Some strategies have incomplete UI
3. **Test Data Fixtures** - Need consistent test data for E2E

---

## 🎯 NEXT AGENT PERFECT PROMPT

Copy everything below the line and paste as your first message to the next agent:

---

# PolyBot Agent Onboarding

I'm the new lead engineer for PolyBot. Before I touch anything, I'm going to fully understand this system.

## My Onboarding Checklist

### Step 1: Health Check (Do First!)

```bash
# Check bot is alive
curl -s "https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status" | jq .

# Check for uncommitted changes
cd /Users/rut/polybot && git status

# Run E2E tests
cd admin && npx playwright test --reporter=line
```

### Step 2: Read Core Documentation

```bash
# Read handoff document (THIS IS CRITICAL)
cat /Users/rut/polybot/AGENT_HANDOFF.md

# Read current priorities
cat /Users/rut/polybot/TODO.md | head -200

# Check recent commits
git log --oneline -20
```

### Step 3: Understand Architecture

- **Bot Engine**: Python on AWS Lightsail, 35+ trading strategies
- **Admin UI**: Next.js 14 on Vercel, 50+ pages, polyparlay.io
- **Database**: Supabase PostgreSQL with RLS, 349+ config columns
- **Exchanges**: 12 integrated (Polymarket, Kalshi, Alpaca, IBKR, Binance, etc.)

### Step 4: Key Files to Review

| File | Lines | Purpose |
|------|-------|---------|
| `src/bot_runner.py` | 4000+ | Main bot orchestrator |
| `src/config.py` | 1500+ | Configuration management |
| `admin/src/app/settings/page.tsx` | 2357 | Settings UI (complex!) |
| `admin/src/app/strategies/page.tsx` | 900+ | Strategy management |
| `admin/e2e/*.spec.ts` | 16 files | E2E test coverage |

## What I Know

1. **Current State**: Bot v1.1.25 running simulation mode on Lightsail
2. **Recent Work**: Schema validation, SQL runners, Crisp fix, platform wizard
3. **Critical Rule**: NEVER use `vercel` CLI - always `git push origin main`
4. **Priority**: Perfect accuracy in all metrics and calculations

## My Rules

1. Read AGENT_HANDOFF.md before making ANY changes
2. Run E2E tests before AND after changes
3. Never commit secrets to code
4. Update AGENT_HANDOFF.md at end of session
5. Create SQL migration files for DB changes

## Questions for Context

Before I start working, please tell me:
1. What specific task would you like me to focus on?
2. Are there any urgent bugs or issues?
3. What was the last thing that broke (so I can avoid it)?

## Commands I'll Use

```bash
# Deploy bot
./scripts/deploy.sh

# Deploy admin
git push origin main

# Run tests
cd admin && npx playwright test

# Check bot status
curl -s "https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status" | jq .

# Run schema validation
python scripts/validate_schema.py

# Execute SQL
python scripts/run_sql.py scripts/your_file.sql
```

I'm ready to help. What should I focus on first?

---

**END OF NEXT AGENT PROMPT**

---

## 📚 ADDITIONAL DOCUMENTATION

For deeper context on specific topics:

| Document | Location | Purpose |
|----------|----------|---------|
| Strategy Details | `docs/STRATEGY_ARCHITECTURE.md` | Deep dive on all 35+ strategies |
| AWS Deployment | `LIGHTSAIL_DEPLOYMENT.md` | Container deployment guide |
| Arbitrage Analysis | `ARBITRAGE_STRATEGY.md` | Mathematical breakdown |
| Infrastructure | `INFRASTRUCTURE.md` | AWS + Vercel + Supabase setup |
| Multi-tenancy | `docs/MULTITENANCY_ARCHITECTURE.md` | User isolation design |
| Fee Structures | `docs/FEE_STRUCTURES.md` | Exchange fees reference |

---

## 📝 SESSION LOG

### January 1, 2026

**Agent Session Summary:**

1. Fixed database schema mismatch (`scalp_15min_entry_threshold` missing)
2. Created schema validation CI/CD pipeline (notifies, doesn't fail)
3. Created SQL runner scripts (`run_sql.py`, `run_sql_direct.py`)
4. Fixed Crisp double-loading bug (was in layout.tsx AND CrispChat.tsx)
5. Removed hardcoded secrets from test scripts
6. Added Platform Setup Wizard with simulation/live modes
7. Added Bot Start CTA component to dashboard
8. Fixed Vercel duplicate project (deleted orphan root `.vercel/`)
9. Updated all Supabase keys in .env and GitHub secrets
10. Created comprehensive handoff document

### December 30, 2025

- Fixed null email constraint error in user profile creation
- Added platform setup documentation
- E2E test improvements

### December 29, 2025

- Bot deployment v29
- Multi-tenant configuration updates
- Strategy parameter tuning

---

*This document should be updated at the end of every agent session.*
