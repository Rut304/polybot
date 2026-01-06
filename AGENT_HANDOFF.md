# PolyBot Agent Handoff Document

**Last Updated:** January 6, 2026  
**Current Version:** v1.1.32 (Build #121)  
**Bot Deployment:** v29 ACTIVE on AWS Lightsail (us-east-1)  
**Admin UI:** Auto-deploys from GitHub to Vercel (admin-app → polyparlay.io)  
**Status:** 🔴 CRITICAL ISSUES - Live Mode has bugs

---

## 🚨🚨🚨 CRITICAL ISSUES - FIX IMMEDIATELY 🚨🚨🚨

### Issue 1: Bot Making Long-Dated Bets (CRITICAL)
**Problem:** Bot placed 7 bets on NBA/eSports parlays that expire January 20, 2026 - nearly 12 months out!  
**Impact:** User's $87.18 is locked in positions that won't resolve for a year  
**Root Cause:** UNKNOWN - Need to investigate `src/bot_runner.py` market selection logic  
**Fix Required:** Add market expiration filter - should NOT bet on markets > 30 days out by default

### Issue 2: P&L Dashboard Shows Wrong Mode Data (HIGH)
**Problem:** When user is in LIVE mode, P&L Dashboard still shows PAPER trading data  
**Location:** `/admin/src/app/business/page.tsx`  
**Root Cause:** Dashboard doesn't filter by `trading_mode` - shows all historical data  
**Fix Required:** Add `tradingMode` filter matching user's profile `is_simulation` setting

### Issue 3: Secrets Architecture Confusion (HIGH)
**Problem:** Unclear if site uses AWS Secrets Manager or .env files  
**Current State:**
- Bot runner (`src/bot_runner.py`): Uses `.env` file locally
- Admin UI API routes: Try AWS Secrets, fallback to env vars
- Concern: If laptop shuts down with .env, does site break?

**Investigation Needed:** 
- Verify Vercel has all needed env vars configured
- Ensure NO dependency on local .env for production site
- Bot on Lightsail has its own container env vars (separate from laptop)

### Issue 4: Analytics Page Empty for Live Mode (PARTIALLY FIXED)
**Problem:** Analytics shows "No Trading Data Yet" for live mode  
**Partial Fix Applied:** Updated `useStrategyPerformance` hook to compute from raw trades  
**Still Needed:** Test and verify fix works after Vercel redeploys

---

## 🚨 VERCEL DEPLOYMENT - READ FIRST 🚨

**ROOT CAUSE DOCUMENTED:** The Vercel project `admin-app` has `Root Directory: admin` configured for Git deployments.

| Action | Result |
|--------|--------|
| `git push` from anywhere | ✅ Works - Vercel uses `admin/` as root |
| `vercel --prod` from `/Users/rut/polybot` | ✅ Works - Vercel adds `admin/` |
| `vercel --prod` from `/Users/rut/polybot/admin` | ❌ FAILS - Becomes `admin/admin` |
| `vercel link` without `--project admin-app` | ❌ Creates DUPLICATE project |

**ALWAYS USE GIT PUSH FOR DEPLOYMENTS. The CLI is a trap.**

---

## 📊 CURRENT DATA STATE

### User Account
- **Email:** rutrohd@gmail.com
- **User ID:** `b2629537-3a31-4fa1-b05a-a9d523a008aa`
- **Mode:** LIVE (`is_simulation: false` in `polybot_profiles`)

### Kalshi Account (LIVE)
- **Portfolio Value:** $97.31 total
- **Positions:** $87.18 across 7 open positions
- **Cash:** $10.13 available
- **Contracts:** 501 total

### Live Positions (All Pending - EXPIRE JAN 20, 2026!)
| Market | Cost | Contracts |
|--------|------|-----------|
| LA Clippers + Lauri Markkanen 25+ | $24.82 | 139 |
| Deni Avdija + Lauri Markkanen 25+ | $24.64 | 136 |
| Lauri + Jimmy Butler parlay | $12.00 | 66 |
| Stephen Curry + Jimmy Butler | $6.67 | 39 |
| Jimmy Butler parlay | $6.00 | 30 |
| Jimmy Butler + Stephen Curry | $6.00 | 45 |
| Stephen Curry eSports | $7.05 | 46 |

### Database Tables
- `polybot_live_trades`: 17 records (7 executed, 10 canceled)
- `polybot_simulated_trades`: 7 live positions with `trading_mode: 'live'`
- `user_exchange_credentials`: Kalshi added for UI detection

---

## 🔧 RECENT FIXES (v1.1.31 - v1.1.32)

### v1.1.32 - Atomic Arbitrage Fix
- **Problem:** If YES order succeeded but NO order failed, bot left orphaned YES position
- **Fix:** Auto-cancels YES order if NO order fails
- **File:** `src/bot_runner.py` lines 1800-1900

### v1.1.31 - Data Backfill
- Backfilled 17 Kalshi orders from API to database
- Added market titles with readable names
- Inserted 7 live positions for UI display

### Analytics Hook Fix (Latest)
- **File:** `/admin/src/lib/hooks.ts` - `useStrategyPerformance()`
- **Change:** When VIEW returns empty (all trades pending), compute stats from raw trades
- **Status:** Pushed, needs verification after Vercel deploy

---

## 🏗️ COMPLETE ARCHITECTURE

### System Components
```
┌─────────────────────────────────────────────────────────────────┐
│                         POLYBOT SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Lightsail  │     │    Vercel    │     │   Supabase   │    │
│  │  Bot Runner  │────▶│   Admin UI   │────▶│   Database   │    │
│  │  (Python)    │     │  (Next.js)   │     │  (Postgres)  │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                    │             │
│         │                    │                    │             │
│         ▼                    ▼                    │             │
│  ┌──────────────┐     ┌──────────────┐           │             │
│  │  Container   │     │    Vercel    │           │             │
│  │  Env Vars    │     │   Env Vars   │           │             │
│  └──────────────┘     └──────────────┘           │             │
│                              │                    │             │
│                              ▼                    │             │
│                       ┌──────────────┐           │             │
│                       │ AWS Secrets  │◀──────────┘             │
│                       │   Manager    │                         │
│                       └──────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key URLs
- **Admin UI:** https://polyparlay.io
- **Bot API:** https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com
- **Supabase:** https://ytaltvltxkkfczlvjgad.supabase.co

### Database Schema (Key Tables)
```
polybot_profiles          - User profiles with is_simulation flag (SOURCE OF TRUTH for mode)
polybot_user_config       - Strategy settings per user
polybot_simulated_trades  - All trade records (paper + live), filtered by trading_mode column
polybot_live_trades       - Raw exchange order records
user_exchange_credentials - OAuth tokens / connection markers
polybot_strategy_performance - VIEW aggregating completed trades (excludes pending!)
```

---

## 📋 FULL TODO LIST

### CRITICAL (Fix Immediately)
- [ ] **Market Expiration Filter** - Prevent bot from betting on markets > 30 days out
- [ ] **P&L Dashboard Mode** - Show live data when in live mode, paper when in paper mode
- [ ] **Verify Secrets Architecture** - Ensure Vercel has all env vars, site works without local machine

### HIGH Priority
- [ ] **Test Analytics Fix** - Verify pending trades show in analytics after deploy
- [ ] **Add Current Price Display** - Show current market prices vs entry prices for positions
- [ ] **Investigate Kalshi Market Selection** - Why did bot choose year-long parlays?

### MEDIUM Priority
- [ ] Position exit functionality (close positions manually)
- [ ] Real-time P&L tracking with current market prices
- [ ] Strategy performance by time period

### LOW Priority
- [ ] Historical trade export (CSV)
- [ ] Email notifications for trade events
- [ ] Mobile-responsive improvements

---

## 🔐 SECRETS MANAGEMENT

### Current State (NEEDS VERIFICATION)
| Component | Secrets Source | Production Ready? |
|-----------|---------------|-------------------|
| Bot (Lightsail) | Container env vars | ✅ Yes - runs independently |
| Admin UI (Vercel) | Vercel env vars + AWS Secrets | ⚠️ VERIFY - may need AWS keys |
| Local Development | .env file | N/A - dev only |

### AWS Secrets Manager (us-east-1)
```
app/config              - Various API keys
polyparlay/production   - Production credentials
polybot/polymarket-api-key
polybot/polymarket-secret
polybot/supabase-url
polybot/supabase-key
```

### Required Vercel Environment Variables (VERIFY THESE EXIST)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AWS_ACCESS_KEY_ID        ← For AWS Secrets Manager access
AWS_SECRET_ACCESS_KEY    ← For AWS Secrets Manager access
AWS_REGION=us-east-1
```

---

## 🧪 TESTING

### E2E Tests
```bash
cd /Users/rut/polybot/admin
npx playwright test --reporter=line
```

### Health Check
```bash
curl -s "https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status" | jq .
```

### Database Queries
```bash
# Quick DB check via Python
cd /Users/rut/polybot && source .venv/bin/activate
python3 << 'EOF'
import os
from supabase import create_client
from dotenv import load_dotenv
load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
user_id = 'b2629537-3a31-4fa1-b05a-a9d523a008aa'
result = supabase.table('polybot_profiles').select('is_simulation').eq('id', user_id).execute()
print(f"User mode: {'PAPER' if result.data[0]['is_simulation'] else 'LIVE'}")
EOF
```

---

## 📁 KEY FILES

### Bot Logic
- `src/bot_runner.py` - Main bot orchestration (market selection, order execution)
- `src/strategies/` - Individual strategy implementations
- `src/kalshi_client.py` - Kalshi API integration

### Admin UI
- `admin/src/app/` - Next.js pages
- `admin/src/app/business/page.tsx` - P&L Dashboard (BUG: ignores trading mode)
- `admin/src/app/positions/page.tsx` - Positions display
- `admin/src/app/analytics/page.tsx` - Analytics (uses trading mode)
- `admin/src/lib/hooks.ts` - Data fetching hooks
- `admin/src/lib/useTier.tsx` - User profile/mode context
- `admin/src/lib/PlatformContext.tsx` - Platform filtering logic
- `admin/src/app/api/user-exchanges/route.ts` - Exchange detection API

### Configuration
- `.env` - Local secrets (gitignored) - DEV ONLY
- `admin/.env.local` - Admin UI local config
- `Dockerfile.bot` - Bot container definition

---

## 🔄 DEPLOYMENT

### Admin UI (Vercel) - ALWAYS USE THIS
```bash
git add -A
git commit -m "description"
git push origin main
# Auto-deploys to polyparlay.io in ~2 minutes
```

### Bot (Lightsail)
The bot runs on AWS Lightsail containers. It does NOT depend on your local machine.
```bash
# Only needed when updating bot code
docker build -f Dockerfile.bot -t polybot .
# Push to ECR and update Lightsail deployment
```

---

## 📞 SUPPORT RESOURCES

- **Repository:** https://github.com/Rut304/polybot
- **Supabase Dashboard:** https://app.supabase.com/project/ytaltvltxkkfczlvjgad
- **Vercel Dashboard:** https://vercel.com/rut304/admin-app
- **AWS Console:** us-east-1 region, Lightsail service

---

## 📝 CHANGE LOG

### January 6, 2026
- v1.1.32: Fixed atomic arbitrage (auto-cancel on partial failure)
- Backfilled Kalshi trades to database
- Added Kalshi to user_exchange_credentials
- Fixed useStrategyPerformance for pending trades
- **DISCOVERED:** Long-dated market selection bug (bot betting 12 months out)
- **DISCOVERED:** P&L Dashboard mode filtering bug

### January 4-5, 2026
- v1.1.25-v1.1.31: Various bug fixes
- Fixed HTTP errors in scanner
- Fixed settings persistence
- Fixed zero-balance trading prevention

---

*Document maintained by AI agents. Update after every significant change.*
