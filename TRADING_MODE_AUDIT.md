# Trading Mode Data Isolation - Audit Report

## Date: January 4, 2026

## Executive Summary

Comprehensive audit of live/paper trading mode separation across the PolyParlay platform. Multiple critical issues were found and fixed.

---

## ✅ FIXES IMPLEMENTED

### 1. Database Sync Issue (CRITICAL)

**Problem:** `polybot_profiles.is_simulation = FALSE` (live) but `polybot_config.trading_mode = 'paper'`
**Fix:** Updated database + API now reads from `polybot_profiles` only
**Files:** `/api/user-exchanges/route.ts`, `/api/switch-mode/route.ts`

### 2. TradingModeBanner Using Wrong Hook

**Problem:** Used `usePlatforms().isSimulationMode` instead of `useTier().isSimulation`
**Fix:** Changed to use `useTier()` as source of truth
**File:** `src/components/TradingModeBanner.tsx`

### 3. TradingModeIndicator Using Wrong Hook

**Problem:** Same as above
**Fix:** Changed to use `useTier()` as source of truth
**File:** `src/components/TradingModeBanner.tsx`

### 4. Positions Page Mode Indicator

**Problem:** Used `isSimulationMode` from `usePlatforms()` for display
**Fix:** Changed to use `isUserSimMode` from `useTier()`
**File:** `src/app/positions/page.tsx`

---

## ⚠️ POTENTIAL ISSUES TO MONITOR

### 1. Bot Status vs Profile Mode Mismatch

**Description:** `botStatus.dry_run_mode` (what bot is running) may differ from `profile.is_simulation` (what user selected)
**Scenario:** User switches to live mode but bot hasn't restarted
**Impact:** Bot continues paper trading while UI shows live
**Mitigation:** BotStartCTA shows restart prompt, but could add explicit warning

### 2. Stale Data After Mode Switch

**Description:** React Query cache may show old mode's data briefly after switching
**Scenario:** User switches paper → live, sees paper trades for a moment
**Mitigation:** Mode switch should invalidate all relevant queries
**Location:** `useTier.tsx` - `setTradingMode` function

### 3. Opportunities Without trading_mode Column

**Description:** Until you run the SQL migration, opportunities table lacks `trading_mode`
**Impact:** All opportunities show in all modes (no filtering)
**Status:** SQL migration created, needs to be run
**File:** `scripts/add_trading_sessions.sql`

### 4. Session History Not Populated

**Description:** `polybot_trading_sessions` table needs to be created
**Impact:** Session history won't be saved on mode switches
**Status:** SQL migration created, needs to be run
**File:** `scripts/add_trading_sessions.sql`

---

## 🔍 ARCHITECTURE - SOURCE OF TRUTH

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA FLOW                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   polybot_profiles.is_simulation  ◄─── SINGLE SOURCE OF TRUTH   │
│              │                                                   │
│              ▼                                                   │
│   ┌──────────────────┐                                          │
│   │   useTier()      │ ◄─── All components should use this      │
│   │   .isSimulation  │                                          │
│   └──────────────────┘                                          │
│              │                                                   │
│              ▼                                                   │
│   ┌──────────────────────────────────────────────────────┐     │
│   │  Dashboard  │  Analytics  │  Positions  │  Bets  │...│     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   usePlatforms().isSimulationMode                               │
│       │                                                          │
│       └── ONLY for platform filtering (filterByPlatform)        │
│           NOT for determining current mode                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 CHECKLIST BEFORE GOING LIVE

### Database

- [ ] Run `scripts/add_trading_sessions.sql` in Supabase SQL Editor
- [x] Verify `polybot_profiles.is_simulation = false` for your user
- [x] Verify `polybot_config.trading_mode = 'live'` matches
- [x] Verify `user_exchange_credentials` has entries for connected platforms

### UI Verification

- [ ] Dashboard: NO paper trading banner in live mode
- [ ] Dashboard: Balance shows "Live Balance" badge in live mode
- [ ] Dashboard: Orange header shows "LIVE TRADING MODE"
- [ ] Positions: Mode indicator shows "Live - Connected Only"
- [ ] Bets: Trades filtered by trading_mode
- [ ] Balances: Shows actual exchange balances ($98 from Kalshi)

### API Verification

- [ ] `/api/user-exchanges` returns `is_simulation: false`
- [ ] `/api/balances` returns connected platforms only
- [ ] `/api/stats?trading_mode=live` returns only live stats

### E2E Tests

- [ ] Run `npm run test:e2e -- --grep "Trading Mode"`
- [ ] Verify no mode conflict errors
- [ ] Verify all pages load without errors

---

## 🚨 KNOWN LIMITATIONS

1. **Opportunities counter** - Currently shows ALL opportunities regardless of mode (needs SQL migration)

2. **P&L calculation** - Paper P&L and Live P&L are calculated separately but history may have mixed data

3. **Trade execution** - Bot uses `polybot_config.dry_run_mode`, ensure it matches profile

4. **Live balance refresh** - Balances come from `polybot_balances` table, requires bot to be running to update

---

## 📁 FILES MODIFIED IN THIS AUDIT

1. `admin/src/app/api/user-exchanges/route.ts` - Read from profiles, not config
2. `admin/src/app/api/switch-mode/route.ts` - NEW: Mode switching with session tracking
3. `admin/src/components/TradingModeBanner.tsx` - Use useTier() for mode
4. `admin/src/app/positions/page.tsx` - Use useTier() for mode indicator
5. `admin/src/lib/useTier.tsx` - Updated setTradingMode to use API
6. `admin/e2e/trading-mode-isolation.spec.ts` - NEW: Comprehensive E2E tests
7. `scripts/add_trading_sessions.sql` - NEW: Database migration

---

## 🧪 HOW TO RUN E2E TESTS

```bash
cd admin

# Run all trading mode tests
npx playwright test trading-mode-isolation.spec.ts --headed

# Run specific test
npx playwright test -g "Mode Indicator Consistency" --headed

# Generate test report
npx playwright test trading-mode-isolation.spec.ts --reporter=html
```

---

## 📞 NEXT STEPS

1. **IMMEDIATE**: Run SQL migration in Supabase
2. **IMMEDIATE**: Verify UI in production after Vercel deploy
3. **TODAY**: Run E2E tests locally
4. **THIS WEEK**: Add cache invalidation on mode switch
5. **FUTURE**: Add real-time sync between profile mode and bot mode
