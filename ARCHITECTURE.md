# PolyBot Architecture - Clear Separation of Concerns

## 🏗️ Infrastructure Overview

### **TWO COMPLETELY SEPARATE SYSTEMS**

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN UI (Frontend)                       │
│                                                                  │
│  Deployment: Vercel (admin-gules-chi.vercel.app)                │
│  Source: /admin folder                                           │
│  Purpose: View-only dashboard, NO trading capability             │
│  Auto-deploy: GitHub push → Vercel builds automatically         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Reads data from
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Database)                          │
│                                                                  │
│  Tables:                                                         │
│  - polybot_simulated_trades  (SIMULATION trades - never real)   │
│  - polybot_opportunities     (Detected arb opportunities)        │
│  - polybot_config           (Bot settings)                       │
│  - polybot_secrets          (API keys - encrypted)              │
│  - polybot_balances         (Portfolio balances)                 │
│  - polybot_news_items       (News feed)                          │
│  - polybot_bot_logs         (Bot logs)                           │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Writes data to
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    TRADING BOT (Backend)                         │
│                                                                  │
│  Deployment: AWS Lightsail Container Service                    │
│  Source: /src folder                                             │
│  URL: polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com │
│  Deploy: Manual via ./scripts/deploy.sh                         │
│                                                                  │
│  THIS IS WHERE ALL TRADING LOGIC RUNS                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚨 SIMULATION vs LIVE MODE - CRITICAL DISTINCTION

### **simulation_mode = True (CURRENT STATE)**

When `simulation_mode=True` in `bot_runner.py`:

1. **NO REAL TRADES EVER EXECUTE**
   - `dry_run=True` passed to ALL strategies
   - `paper=True` for Alpaca (paper trading API)
   - `sandbox=True` for CCXT exchanges
   - `private_key=None` for Polymarket (can't sign transactions)
   - `auto_claim=False` for position manager

2. **SIMULATED TRADES ARE FAKE**
   - Written to `polybot_simulated_trades` table
   - Paper trader simulates slippage, fees, failures
   - Shows what WOULD have happened if live
   - Starting balance: $1,000 (simulated)

3. **P&L IS SIMULATED**
   - The $585.35 / $1,279 you see is SIMULATED profit
   - No real money moved
   - Based on market prices at time of "trade"

### **simulation_mode = False (LIVE MODE - NOT ENABLED)**

When `simulation_mode=False`:

1. **REAL TRADES WOULD EXECUTE**
   - `dry_run=False` - strategies execute real orders
   - `paper=False` - uses live Alpaca API
   - `sandbox=False` - real exchange orders
   - `private_key` set - can sign Polymarket transactions

2. **REQUIRES EXPLICIT CHANGE**
   - Must change `simulation_mode=True` to `False` in code
   - Must have real API keys configured
   - Must have real funds in accounts

---

## 📊 Data Flow Explanation

### Where P&L Numbers Come From

```
Bot detects opportunity → Paper Trader simulates trade → 
  Saves to polybot_simulated_trades → Dashboard reads and displays
```

### Dashboard Time Windows

- **Dashboard cards**: May show filtered time window (24h, 7d, etc.)
- **Win Rate modal**: Shows ALL trades ever
- **This explains different numbers**

### Verified Data (from Supabase):
- Total trades: 1000
- Wins: 758 (75.8%)
- Losses: 147
- Failed executions: 95
- Total P&L: ~$1,279 (all-time simulated)

---

## 🔒 Deployment Setup - What Runs Where

### Admin UI (Vercel)
- **Project**: `admin` (prj_bN7avcXG0SRU3XNHF3ymz3KccTm5)
- **URL**: https://admin-gules-chi.vercel.app
- **Git Connected**: Yes, to Rut304/polybot
- **Auto-Deploy**: Yes, on push to main
- **No local laptop needed**: ✅

### Bot (AWS Lightsail)
- **Service**: `polyparlay`
- **Region**: us-east-1
- **URL**: https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com
- **Current Version**: 49
- **Deploy**: Via `./scripts/deploy.sh` (needs laptop currently)
- **Health Check**: /health returns "OK"

### How to Make Bot Deploy Autonomously
To remove laptop dependency for bot deployments:
1. Set up GitHub Actions to build and push to Lightsail on commit
2. Or use AWS CodePipeline triggered by GitHub

---

## ✅ Verification Checklist

### Vercel Projects
- [x] `admin` project exists and connected to GitHub
- [x] Redundant `polybot` Vercel project was deleted earlier
- [x] No root-level `.vercel` folder (removed)

### AWS Lightsail
- [x] Service `polyparlay` running in us-east-1
- [x] Health check passing
- [x] Deployment version 49 active

### Data Integrity
- [x] All trades in `polybot_simulated_trades` are SIMULATED
- [x] No real money has been traded
- [x] Bot mode is explicitly SIMULATION

---

## 🎯 To Go Live (When Ready)

**DO NOT DO THIS UNTIL THOROUGHLY TESTED**

1. Add real API keys to `polybot_secrets` table
2. Change `simulation_mode=True` to `simulation_mode=False` in `bot_runner.py`
3. Deploy new version to Lightsail
4. Trades would then be REAL and use REAL MONEY

---

## Summary

| Component | Location | Deploys From | Auto-Deploy? |
|-----------|----------|--------------|--------------|
| Admin UI | Vercel | GitHub push | ✅ Yes |
| Bot | AWS Lightsail | Manual script | ❌ No (needs action) |
| Database | Supabase | N/A | N/A |

**Current State**: SIMULATION MODE - No real money at risk.
