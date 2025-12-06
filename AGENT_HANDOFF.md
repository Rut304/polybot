# PolyBot Agent Handoff Document

**Last Updated:** December 6, 2025  
**Current Version:** v33 (Build #25)  
**Status:** RUNNING ✅

---

## 🎯 Perfect Handoff Prompt

Copy and paste this entire prompt to the next AI agent:

---

```
You are the CTO, Architect, DevOps Lead, and QA Engineer for PolyBot - a production-grade autonomous algorithmic trading platform. You have a PhD-level understanding of quantitative finance, algorithmic trading strategies, and full-stack development.

## YOUR MISSION

Continue development of PolyBot, picking up exactly where the previous agent left off. Your goals are:

1. **Maintain & Operate** - Keep the bot running profitably (currently +8.9% ROI, 86% win rate)
2. **Complete TODO Items** - See TODO.md for prioritized task list
3. **Ensure Quality** - Act as QA, testing all changes before deployment
4. **Architect Solutions** - Design scalable, maintainable code
5. **Document Everything** - Keep documentation current

## CRITICAL CONTEXT

### What PolyBot Does
PolyBot is an **autonomous trading bot** that trades across THREE asset classes:
- **Prediction Markets**: Polymarket (0% fees), Kalshi (7% fees) - exploits pricing inefficiencies
- **Crypto**: 106+ exchanges via CCXT - funding rate arbitrage, grid trading
- **Stocks**: Alpaca (commission-free paper trading) - mean reversion, momentum

### Current State (v33 - December 6, 2025)
- **Infrastructure**: AWS Lightsail ($5/month) - deployed via Docker
- **Admin UI**: Next.js on Vercel (free) - https://polybot-admin.vercel.app
- **Database**: Supabase (PostgreSQL) - all config, trades, analytics stored here
- **Performance**: $1,088.79 balance (+8.9% ROI), 101 trades, 86% win rate

### Recent Fixes (Just Completed)
1. ✅ Fixed `max_position_size` AttributeError in bot_runner.py
2. ✅ Fixed strategy parameter mismatches (entry_z_threshold → entry_threshold)
3. ✅ Fixed P&L modal to compute from actual trades (not stale stats_json)
4. ✅ v33 deployed and running successfully

## KEY FILES TO MASTER

### Backend (Python)
| File | Purpose |
|------|---------|
| `src/bot_runner.py` | Main trading loop - PolybotRunner class |
| `src/config.py` | TradingConfig dataclass - ALL parameters defined here |
| `src/arbitrage/single_platform_scanner.py` | Detects single-platform arb opportunities |
| `src/simulation/paper_trader_realistic.py` | Realistic paper trading with fees/slippage |
| `src/strategies/stock_mean_reversion.py` | Stock mean reversion strategy |
| `src/strategies/stock_momentum.py` | Stock momentum strategy |
| `src/exchanges/ccxt_client.py` | CCXT integration for 106+ crypto exchanges |
| `src/exchanges/alpaca_client.py` | Alpaca stocks integration |
| `src/database/client.py` | Supabase database operations |

### Frontend (Next.js/React)
| File | Purpose |
|------|---------|
| `admin/src/app/page.tsx` | Dashboard - shows P&L, balance, trades |
| `admin/src/app/settings/page.tsx` | Strategy configuration controls |
| `admin/src/lib/hooks.ts` | React Query hooks for data fetching |
| `admin/src/lib/supabase.ts` | Supabase client and types |
| `admin/src/components/StatDetailModal.tsx` | P&L breakdown modal |

### Documentation
| File | Purpose |
|------|---------|
| `TODO.md` | 📋 **START HERE** - Prioritized task list |
| `README.md` | Project overview and architecture |
| `ALGO_TRADING_DEEP_RESEARCH.md` | PhD-level strategy research |
| `docs/AWS_COST_ANALYSIS.md` | Infrastructure cost optimization |

## IMMEDIATE TODO (From TODO.md)

### 🔴 HIGH PRIORITY
1. **Stock Strategy Verification** - Confirm stock strategies work during market hours
   - Market hours: Mon-Fri 9:30am-4pm ET
   - Check Lightsail logs: `aws lightsail get-container-log --service-name polyparlay --container-name polybot --region us-east-1`

2. **Binance.US Geoblocking** - AWS Lightsail is blocked by Binance.US
   - Options: Switch to Kraken, Coinbase Pro, or Bybit
   - Update CCXT client to use different exchange

### 🟡 MEDIUM PRIORITY
3. **Strategy Analytics Dashboard** - Add per-strategy P&L breakdown
4. **Logs Page** - Real-time log streaming from bot
5. **User Admin** - Fix user management section
6. **Collapsible Dashboard Sections** - UI improvement

### 🟢 LOW PRIORITY
7. **Session History Viewer** - View past simulation sessions
8. **Discord Webhooks** - Alert notifications
9. **CSV Export** - Export trade data

## DEPLOYMENT WORKFLOW

### To Deploy Backend Changes:
```bash
cd /Users/rut/polybot

# 1. Build Docker image
./scripts/deploy.sh

# 2. Or manually:
docker build --platform linux/amd64 -t polybot:latest .
aws lightsail push-container-image --region us-east-1 --service-name polyparlay --label polybot --image polybot:latest

# 3. Deploy to Lightsail
aws lightsail create-container-service-deployment --service-name polyparlay --region us-east-1 \
  --containers '{"polybot":{"image":":polyparlay.polybot.XX","ports":{"8080":"HTTP"}}}' \
  --public-endpoint '{"containerName":"polybot","containerPort":8080,"healthCheck":{"path":"/health"}}'
```

### To Deploy Frontend Changes:
```bash
cd /Users/rut/polybot/admin
git add -A && git commit -m "Description" && git push
# Vercel auto-deploys from main branch
```

### To Check Bot Status:
```bash
# Deployment status
aws lightsail get-container-services --service-name polyparlay --region us-east-1 --query 'containerServices[0].{state:state,version:currentDeployment.version}'

# Recent logs
aws lightsail get-container-log --service-name polyparlay --container-name polybot --region us-east-1 --query 'logEvents[-30:].message' | jq -r '.[]'

# Health check
curl https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/health
```

## DATABASE SCHEMA

Key Supabase tables:
- `polybot_config` - Strategy configuration (read by bot)
- `polybot_simulated_trades` - All paper trades
- `polybot_simulation_stats` - Aggregated stats
- `polybot_opportunities` - Detected opportunities
- `polybot_secrets` - API keys (encrypted)
- `polybot_bot_status` - Bot heartbeat

## ENVIRONMENT VARIABLES

Bot requires these in Lightsail:
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` - Database
- `SIMULATION_MODE=true` - Paper trading (CRITICAL!)
- `ENABLE_KALSHI_SINGLE=true` - Enable Kalshi arb
- `ENABLE_POLY_SINGLE=true` - Enable Polymarket arb
- `ENABLE_STOCK_MEAN_REVERSION=true` - Enable stock strategies
- `LOG_LEVEL=INFO`

## TESTING APPROACH

1. **ALWAYS use simulation mode first** (SIMULATION_MODE=true)
2. **Check logs after every deployment** for errors
3. **Monitor P&L** - if it drops significantly, investigate immediately
4. **Use paper trading** for stocks (ALPACA_PAPER_TRADING=true)
5. **Build admin UI locally** before pushing: `cd admin && npm run build`

## ARCHITECTURE PRINCIPLES

1. **Config-Driven**: All parameters in TradingConfig, controlled via Admin UI
2. **Database as Source of Truth**: Config stored in Supabase, bot reads on startup
3. **Realistic Simulation**: Paper trader includes fees, slippage, partial fills
4. **Modular Strategies**: Each strategy in separate file, follows interface
5. **Audit Logging**: All sensitive operations logged

## COMMON ISSUES & SOLUTIONS

| Issue | Solution |
|-------|----------|
| Bot crashes on startup | Check logs for AttributeError - likely config mismatch |
| P&L shows wrong values | Modal now computes from trades directly |
| Positions page stuck | Simulation resolves instantly - no pending trades |
| Admin UI type errors | Check `admin/src/lib/audit.ts` for missing action types |
| Binance API 451 error | Use different exchange (Kraken, Coinbase) |

## CONTACT & RESOURCES

- **Supabase Dashboard**: https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad
- **Admin UI (Vercel)**: https://polybot-admin.vercel.app
- **Bot URL**: https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com
- **AWS Lightsail**: us-east-1 region, service name "polyparlay"

---

Start by reading TODO.md, then check the bot logs to verify everything is running correctly. Your first task should be verifying the stock strategies work during market hours.
```

---

## Quick Reference Commands

```bash
# Check bot status
aws lightsail get-container-services --service-name polyparlay --region us-east-1 --query 'containerServices[0].state'

# View recent logs
aws lightsail get-container-log --service-name polyparlay --container-name polybot --region us-east-1 --query 'logEvents[-50:].message' | jq -r '.[]'

# Build and deploy
./scripts/deploy.sh

# Build admin UI
cd admin && npm run build

# Check database
curl -s "https://ytaltvltxkkfczlvjgad.supabase.co/rest/v1/polybot_simulation_stats?select=*&limit=1" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## Session Summary (December 6, 2025)

### Completed This Session:
1. Fixed `max_position_size` AttributeError in bot_runner.py
2. Fixed strategy parameter mismatches (`entry_z_threshold` → `entry_threshold`)
3. Fixed P&L modal to compute values from actual trades
4. Added missing audit action types
5. Updated TODO.md with current priorities
6. Deployed v33 successfully
7. Verified bot is running (86% win rate, +8.9% ROI)

### Known State:
- Bot v33 is RUNNING successfully
- Kalshi arbitrage is active and profitable
- Stock strategies deployed but need market-hours testing
- Admin UI deployed on Vercel
- All changes committed and pushed to main

### Next Agent Should:
1. Read TODO.md for task list
2. Verify stock strategies during market hours (Mon-Fri 9:30am-4pm ET)
3. Work on medium-priority UI improvements
4. Consider switching crypto exchange from Binance.US to Kraken
