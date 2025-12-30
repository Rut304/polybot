# PolyBot Agent Handoff Document

**Last Updated:** December 29, 2025  
**Current Version:** v1.1.25 (Build #98)  
**Bot Deployment:** v29 ACTIVE on AWS Lightsail (us-east-1)  
**Admin UI:** Auto-deploys from GitHub to Vercel (admin-app → polyparlay.io)  
**Status:** 🟢 RUNNING - Simulation Mode

---

## 🎯 MISSION CRITICAL: THE PATH TO PRODUCTION

### Why This Project Matters

PolyBot aims to be **THE** automated prediction market trading platform - not another "SaaS bot that disappears." The key differentiator is **PERFECT ACCURACY** in all metrics, calculations, and data consistency.

### Current Phase: Pre-Production Validation

We are in the final stretch before accepting paying customers. The critical path is:

1. ✅ **Core Infrastructure** - AWS Lightsail + Supabase + Vercel (COMPLETE)
2. ✅ **35+ Trading Strategies** - All implemented and configurable (COMPLETE)
3. ✅ **Admin Dashboard** - 42 pages, full control (COMPLETE)
4. 🔄 **E2E Testing Suite** - 261+ tests, needs data verification (IN PROGRESS)
5. ⚠️ **Perfect Accuracy** - Metrics must match reality 100% (CRITICAL)
6. ⏳ **Live Trading** - Enable real money after validation (PENDING)

---

## 🆕 SESSION COMPLETED: December 29, 2025

### Major Accomplishments

#### 1. Bot Deployment Fixed (v29 ACTIVE)

- **Root Cause**: IB Gateway sidecar container was still in deploy.sh after Web API migration
- **Fix**: Removed IB Gateway container - bot now uses IBKRWebClient (REST API) only
- **Result**: Deployment v29 successful - bot running Build #98

#### 2. Vercel Deployment Errors Fixed

- Added `export const dynamic = 'force-dynamic'` to `/api/ibkr/quote` route
- Removed `started_by` column reference (doesn't exist in polybot_status table)
- Build succeeds locally and on Vercel

#### 3. E2E Tests Fixed & Passing

- Fixed timeout issues in metrics-accuracy.spec.ts
- Fixed navigation errors in data-verification.spec.ts
- All 114 metrics/data tests now pass

#### 4. Diagnostics Page Enhanced

- Added Lightsail container status widget (live health check)
- Added external monitoring links (Vercel Speed Insights, Lightsail Console, Supabase)
- Created `/api/admin/lightsail` endpoint

#### 5. Redeploy Button Added

- Added "Redeploy Dashboard" button to /admin page
- Requires `VERCEL_DEPLOY_HOOK_URL` environment variable

#### 6. IB Gateway Investigation & Removal

- **What**: Heavyweight Docker container running IBKR Trader Workstation headlessly
- **Problem**: Too resource-intensive for Lightsail micro tier, caused deployment failures
- **Solution**: Already migrated to IBKRWebClient (REST API) - just needed cleanup
- **Commit**: `cbd0b0f` - Removed from deploy.sh

---

## 📊 CURRENT STATUS MATRIX

| Component | Status | Version | Notes |
|-----------|--------|---------|-------|
| Bot (Lightsail) | 🟢 RUNNING | v1.1.25 (Build #98) | Deployment v29 ACTIVE |
| Admin UI (Vercel) | 🟢 LIVE | Auto-deploy | polyparlay.io |
| Supabase | 🟢 HEALTHY | N/A | RLS enabled |
| E2E Tests | 🟡 261 tests | 16 spec files | Some need data validation |
| Metrics Accuracy | ⚠️ NEEDS VALIDATION | N/A | Critical for production |
| Live Trading | ⏸️ DISABLED | Simulation only | Enable after validation |

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              POLYBOT ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐         ┌─────────────────────────────────────┐   │
│   │   ADMIN DASHBOARD   │         │         BOT ENGINE (Python)          │   │
│   │   (Next.js 14)      │         │         AWS Lightsail                │   │
│   │                     │         │                                       │   │
│   │  • 42 pages         │  HTTP   │  • 35+ trading strategies            │   │
│   │  • Vercel hosted    │ ◄─────► │  • Multi-exchange support            │   │
│   │  • polyparlay.io    │         │  • Heartbeat monitoring              │   │
│   └─────────────────────┘         │  • Simulation & Live modes           │   │
│            │                       └─────────────────────────────────────┘   │
│            │                                        │                        │
│            ▼                                        ▼                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         SUPABASE (PostgreSQL)                        │   │
│   │                                                                       │   │
│   │  • polybot_config          - Bot configuration                       │   │
│   │  • polybot_simulated_trades - All trade history                      │   │
│   │  • polybot_positions       - Current positions                       │   │
│   │  • polybot_status          - Bot health/heartbeat                    │   │
│   │  • polybot_profiles        - User management                         │   │
│   │  • polybot_secrets         - API keys (encrypted columns ready)      │   │
│   │  • polybot_teams           - Team/collaboration                      │   │
│   │  • user_exchange_credentials - Per-user exchange OAuth               │   │
│   │                                                                       │   │
│   │  RLS ENABLED ✓                                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                           EXCHANGES                                   │   │
│   │                                                                       │   │
│   │  • Polymarket (CLOB + Gamma API)    • Kalshi                         │   │
│   │  • Alpaca (Stocks)                  • IBKR (Web API - OAuth)         │   │
│   │                                                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 KEY FILES & DIRECTORIES

### Python Bot (`/Users/rut/polybot/src/`)

```
src/
├── bot_runner.py           # Main orchestrator (3800+ lines)
├── config.py               # All configuration (1500+ lines)
├── exchanges/
│   ├── polymarket_client.py   # Polymarket CLOB integration
│   ├── kalshi_client.py       # Kalshi API integration
│   ├── alpaca_client.py       # Stock trading via Alpaca
│   ├── ibkr_web_client.py     # IBKR REST API (OAuth) - PREFERRED
│   └── ibkr_client.py         # Legacy ib_insync (local only)
└── strategies/
    ├── arbitrage_*.py         # Arbitrage strategies
    ├── whale_copy_trading.py  # Whale following
    ├── momentum_*.py          # Momentum strategies
    ├── ai_superforecasting.py # Gemini AI predictions
    ├── crypto_15min_scalping.py # High-frequency scalping
    └── ... (35+ total)
```

### Admin Dashboard (`/Users/rut/polybot/admin/`)

```
admin/
├── src/app/
│   ├── page.tsx              # Dashboard (main landing)
│   ├── admin/page.tsx        # Admin controls & redeploy
│   ├── strategies/page.tsx   # Strategy configuration
│   ├── settings/page.tsx     # Bot settings
│   ├── analytics/page.tsx    # Performance charts
│   ├── diagnostics/page.tsx  # System health
│   ├── secrets/page.tsx      # API key management
│   └── api/                   # API routes
│       ├── bot/              # Bot control endpoints
│       ├── admin/            # Admin-only endpoints
│       └── ibkr/             # IBKR quote API
├── e2e/                       # Playwright E2E tests (16 spec files)
│   ├── metrics-accuracy.spec.ts
│   ├── data-verification.spec.ts
│   ├── trading.spec.ts
│   └── ...
└── playwright.config.ts       # Test configuration
```

### Scripts (`/Users/rut/polybot/scripts/`)

```
scripts/
├── deploy.sh                 # Bot deployment (Lightsail) - FIXED
├── bump-version.sh           # Version management
├── fix_user_management.sql   # DB migrations
└── create_*.sql              # Various DB setup scripts
```

---

## 🧪 E2E TESTING GUIDE

### Running Tests

```bash
# Run all tests
cd /Users/rut/polybot/admin && npx playwright test

# Run specific test file
npx playwright test metrics-accuracy.spec.ts

# Run with UI
npx playwright test --ui

# Run single test
npx playwright test -g "should display paper balance"
```

### Test Coverage (261+ tests across 16 files)

| File | Tests | Purpose |
|------|-------|---------|
| `navigation.spec.ts` | 12 | Page navigation |
| `auth.spec.ts` | 12 | Authentication flows |
| `dashboard.spec.ts` | 14 | Dashboard rendering |
| `trading.spec.ts` | 26 | Trading workflows |
| `settings.spec.ts` | 20 | Settings persistence |
| `metrics-accuracy.spec.ts` | 57 | **CRITICAL**: Number accuracy |
| `data-verification.spec.ts` | 57 | **CRITICAL**: Data consistency |
| `workflows.spec.ts` | 28 | User workflows |
| `pages-coverage.spec.ts` | 33 | All pages render |
| `accessibility.spec.ts` | 24 | WCAG compliance |

### Adding New Tests

```typescript
// e2e/your-new-test.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Your Feature', () => {
  test('should do something correctly', async ({ page }) => {
    await page.goto('/your-page');
    await page.waitForLoadState('networkidle');
    
    // Use expect() for assertions
    const element = page.locator('[data-testid="your-element"]');
    await expect(element).toBeVisible();
    
    // For API verification
    const response = await page.request.get('/api/your-endpoint');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.value).toBe(expectedValue);
  });
});
```

---

## 💰 TRADING STRATEGIES (35+)

### High-Confidence Strategies (>85%)

| Strategy | Confidence | Expected APY | Risk |
|----------|-----------|--------------|------|
| Single-Platform Arbitrage | 95% | 50-200% | Low |
| Cross-Platform Arbitrage | 90% | 30-100% | Low |
| 15-Min Crypto Scalping | 90% | 50-200% | Medium |
| BTC Bracket Arbitrage | 85% | 20-50% | Low |
| AI Superforecasting | 85% | 30-60% | Medium |
| Funding Rate Arbitrage | 85% | 15-50% | Low |

### Strategy Configuration

All strategies are configured in Supabase `polybot_config` table:

```sql
-- Enable a strategy
UPDATE polybot_config SET 
  enable_arbitrage = true,
  enable_whale_copy_trading = true,
  enable_15min_crypto_scalping = false  -- Enable when ready
WHERE id = 1;
```

---

## 🔧 ENVIRONMENT SETUP

### Required Environment Variables

#### Bot (.env at project root)

```bash
# Supabase
SUPABASE_URL=https://ytaltvltxkkfczlvjgad.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Service role, not anon!

# Exchanges
POLYMARKET_API_KEY=...
POLYMARKET_SECRET=...
KALSHI_API_KEY=...
IBKR_USERNAME=...
IBKR_PASSWORD=...

# Optional
GEMINI_API_KEY=...  # For AI Superforecasting
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
```

#### Admin UI (Vercel Environment Variables)

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
BOT_URL=https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com
VERCEL_DEPLOY_HOOK_URL=...  # Optional, for redeploy button
```

### Useful Commands

```bash
# Deploy bot to Lightsail
./scripts/deploy.sh

# Check bot status
curl -s "https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status" | jq .

# Build admin locally
cd admin && npm run build

# Run E2E tests
cd admin && npx playwright test

# Check Lightsail deployments
aws lightsail get-container-service-deployments --service-name polyparlay --region us-east-1 --query 'deployments[0].{version:version,state:state}'
```

---

## 📋 TODO LIST (By Priority)

### 🔴 CRITICAL (Must Complete Before Production)

1. **Perfect Metrics Accuracy**
   - [ ] Verify P&L calculations match trade history exactly
   - [ ] Verify win rate calculations across all pages
   - [ ] Verify balance calculations (Polymarket + Kalshi + Simulation)
   - [ ] Ensure data consistency between dashboard, analytics, history pages

2. **Complete E2E Test Coverage**
   - [x] Fix failing metrics tests (DONE)
   - [ ] Add tests that verify mathematical accuracy of calculations
   - [ ] Add tests that compare data across pages
   - [ ] Add tests for edge cases (zero trades, negative P&L, etc.)

3. **Database Schema Cleanup**
   - [ ] Add `started_by` column to `polybot_status` if needed
   - [x] Run `fix_user_management.sql` (user reported done)
   - [ ] Verify all RLS policies work correctly

### 🟡 HIGH (Before Launch)

4. **User Actions Required**
   - [ ] Delete orphan "admin" Vercel project (keep "admin-app")
   - [ ] Create Deploy Hook at Vercel for redeploy button
   - [ ] Add `VERCEL_DEPLOY_HOOK_URL` to Vercel env vars

5. **Page Consolidation** (per docs/PAGE_ANALYSIS.md)
   - [ ] Remove 4 orphan/unused pages
   - [ ] Merge 10 page pairs for simplification
   - [ ] Target: 33% fewer pages

6. **Live Trading Prep**
   - [ ] Create live trading checklist
   - [ ] Set up paper trading validation period
   - [ ] Configure risk limits and position caps

### 🟢 MEDIUM (Post-Launch Enhancements)

7. **Data Encryption**
   - [ ] Implement actual encryption for API keys (columns exist)
   - [ ] pgcrypto functions for encrypt/decrypt

8. **Monitoring & Alerting**
   - [ ] Set up CloudWatch alarms for bot health
   - [ ] Configure Discord webhook notifications
   - [ ] Add email alerts for critical events

9. **Performance Optimization**
   - [ ] Optimize slow queries
   - [ ] Add database indexes
   - [ ] Review bundle size

---

## 🚀 NEXT AGENT PROMPT

Copy this comprehensive prompt to onboard the next engineer:

---

**PROMPT FOR NEXT ENGINEER**

You are taking over as the CTO/CPO/Architect/Developer/QA for PolyBot.io - an automated prediction market trading platform. This is a real product with real users coming soon.

### Quick Start (5 minutes)

```bash
# 1. Clone and understand the project
cd /Users/rut/polybot
cat AGENT_HANDOFF.md  # This file - read it first!
cat TODO.md           # Current priorities
cat docs/STATUS_DEC29.md  # Latest status

# 2. Check current status
curl -s "https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status" | jq .

# 3. Run tests to verify everything works
cd admin && npx playwright test --reporter=line

# 4. Start local development
npm run dev  # Admin at http://localhost:3000
```

### Your Mission

The #1 goal is **PERFECT ACCURACY**. Every number, metric, and calculation must be 100% correct. Without this, we're just another SaaS bot that disappears.

### Key Files to Read

1. `AGENT_HANDOFF.md` - This file (complete project context)
2. `TODO.md` - Prioritized task list
3. `docs/PAGE_ANALYSIS.md` - UI consolidation recommendations
4. `src/bot_runner.py` - Main bot logic (3800 lines)
5. `admin/e2e/metrics-accuracy.spec.ts` - Critical accuracy tests
6. `admin/e2e/data-verification.spec.ts` - Data consistency tests

### Current Infrastructure

- **Bot**: AWS Lightsail container (v1.1.25, Build #98)
- **Admin**: Vercel (auto-deploys from GitHub main branch)
- **Database**: Supabase (PostgreSQL with RLS)
- **Monitoring**: Vercel Speed Insights, Lightsail Console

### Trading Strategy Research

- Read `docs/TRADING_STRATEGIES.md` for strategy explanations
- Read `PROFITABLE_STRATEGIES.md` for confidence ratings
- Check `ALGO_TRADING_DEEP_RESEARCH.md` for market analysis

### Competition Analysis

- Polymarket.com - largest prediction market
- Kalshi.com - regulated US prediction market
- Various GitHub bots - see ARBITRAGE_STRATEGY.md for analysis

### What Success Looks Like

1. All E2E tests pass (especially metrics-accuracy and data-verification)
2. Dashboard numbers match database reality exactly
3. Zero calculation errors in P&L, win rate, ROI
4. Users trust the platform because numbers are always right
5. Bot successfully executes profitable trades

### Immediate Tasks

1. Run `npx playwright test` and fix any failures
2. Review TODO.md and prioritize
3. Verify metrics accuracy across pages
4. Test the deployed bot at polyparlay.io
5. Check Vercel logs for any remaining errors

### Commands You'll Use Often

```bash
# Deploy bot
./scripts/deploy.sh

# Build admin
cd admin && npm run build

# Run tests
cd admin && npx playwright test

# Check bot status
curl -s "https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status"

# Check Lightsail deployment
aws lightsail get-container-service-deployments --service-name polyparlay --region us-east-1

# Push to deploy admin
git push origin main  # Auto-deploys to Vercel
```

Good luck! Make this the trading platform that actually works.

---

**End of Agent Handoff Document**
