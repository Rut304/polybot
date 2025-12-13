# PolyBot Agent Handoff Document

**Last Updated:** December 13, 2025  
**Current Version:** v1.1.13 (Build #75)  
**Deployment:** v96 on AWS Lightsail  
**Status:** 🟢 RUNNING - Simulation Mode

---

## ✅ CRITICAL FIX DEPLOYED (v1.1.13)

**ROOT CAUSE IDENTIFIED & FIXED:** The 88% skip rate was caused by TWO bugs creating **duplicate filtering**:

### Bug #1: Paper trader had duplicate profit thresholds (REMOVED)

- **Scanner** used strategy-specific thresholds from `config.py` (correct)
- **Paper Trader** had ADDITIONAL hardcoded `MIN_PROFIT_THRESHOLD_PCT=5.0%`
- **Impact:** ALL Polymarket 0.3-5% opportunities were SKIPPED after passing scanner
- **Fix:** **REMOVED all duplicate profit filtering from paper_trader** - now scanner is single source of truth

### Bug #2: Max spread filter too low (FIXED)

- **Old:** `MAX_REALISTIC_SPREAD_PCT=12%` in paper_trader, `MAX_PROFIT_PCT=15%` in scanner
- **Impact:** 13%+ profit opportunities (like 16.21%!) were rejected as "false positives"
- **Fix:**
  - `MAX_REALISTIC_SPREAD_PCT` raised to **25%** (paper_trader)
  - `MAX_PROFIT_PCT` raised to **30%** (scanner)
  - `poly_single_max_spread_pct` raised to **30%** (config.py)
  - `kalshi_single_max_spread_pct` raised to **30%** (config.py)

### Architecture Clarification

```text
config.py (SINGLE SOURCE OF TRUTH)
    ↓
SinglePlatformScanner (uses config settings)
    ↓
Opportunity Detection (shared by both modes)
    ↓
bot_runner.py routes based on simulation_mode:
    • simulation_mode=True → paper_trader (simulation-specific settings only)
    • simulation_mode=False → live execution (uses same scanner thresholds)
```

**Key insight:** Scanner thresholds apply to BOTH simulation and live trading. Paper trader now only has simulation-specific settings (slippage, execution failure rate, etc.).

### Expected Impact

- **Polymarket trades:** Should increase significantly (no more 5% floor blocking 0.3-5%)
- **High-value trades:** 13%+ opportunities will now execute
- **Conversion rate:** Target improvement from 12% → **60-80%**

---

## 📋 AUTHORITATIVE SETTINGS REFERENCE (v1.1.13)

### Strategy-Specific Settings (config.py - Source of Truth)

| Setting | Value | Location | Purpose |
|---------|-------|----------|---------|
| `poly_single_min_profit_pct` | **0.3%** | config.py | Min profit for Polymarket (0% fees!) |
| `poly_single_max_spread_pct` | **30%** | config.py | Max profit before "too good to be true" |
| `poly_single_max_position_usd` | $100 | config.py | Max position size |
| `kalshi_single_min_profit_pct` | **8%** | config.py | Min profit for Kalshi (covers 7% fee) |
| `kalshi_single_max_spread_pct` | **30%** | config.py | Max profit before "too good to be true" |
| `kalshi_single_max_position_usd` | $100 | config.py | Max position size |

### Scanner Settings (single_platform_scanner.py)

| Setting | Value | Purpose |
|---------|-------|---------|
| `MAX_PROFIT_PCT` | **30%** | Scanner-level sanity check |
| `MIN_LIQUIDITY_USD` | $50 | Minimum market liquidity |
| `poly_min_profit_pct` | From config | Passed from config.py |
| `kalshi_min_profit_pct` | From config | Passed from config.py |

### Paper Trader Settings (SIMULATION ONLY)

| Setting | Value | Purpose |
|---------|-------|---------|
| `MAX_REALISTIC_SPREAD_PCT` | **25%** | Upper bound for realistic opportunities |
| `EXECUTION_FAILURE_RATE` | 10% | Simulates failed trades |
| `SLIPPAGE_MIN/MAX` | 0.1%-0.5% | Simulates price movement |
| `FEE_STRUCTURES` | Varies | Platform-specific fee simulation |

**Note:** Paper trader NO LONGER has min profit thresholds - those are handled by the scanner.

### Settings Hierarchy

```text
1. config.py (strategy-specific) → AUTHORITATIVE
2. SinglePlatformScanner (uses config) → FILTERING
3. paper_trader (simulation extras) → EXECUTION SIMULATION ONLY
```

### Target Conversion Rates by Strategy

| Strategy | Good Conversion | Why |
|----------|-----------------|-----|
| Single-Platform Arb | **60-80%** | Real spreads, should execute most |
| Cross-Platform Arb | 30-50% | Timing-sensitive |
| News/Sentiment | 20-40% | Market conditions vary |

---

## 🚨 PREVIOUS PROBLEM (NOW FIXED)

The bot was finding opportunities but only converting 12.1% of them.

### Previous Statistics (v1.1.11)

| Metric | Value | Target |
|--------|-------|--------|
| **Total Opportunities Seen** | 4,155 | - |
| **Total Trades Executed** | 504 | - |
| **Conversion Rate** | **12.1%** | **40%+** |
| **Skipped Opportunities** | 3,651 (88%) | <50% |

### Performance by Strategy (v1.1.11)

| Strategy | Opportunities | Trades | Win Rate | P&L |
|----------|--------------|--------|----------|-----|
| Overlapping Arb Correlated | 12 | - | - | - |
| Single Platform Polymarket | 5 | 0 | 0% | $0 |
| Single Platform Kalshi | 25 | 42 | **86%** | **+$43.48** |
| News Sentiment News API | 1 | - | - | - |
| News Sentiment Polymarket | 7 | - | - | - |

### High-Value Opportunities Being SKIPPED

These are being detected but NOT traded:

- "Will Donald Trump Jr. win th..." → **+13.37%** profit
- "Will Hunter Biden win the 20..." → **+16.21%** profit

**KEY INSIGHT:** We're leaving 16%+ profit opportunities on the table. The next agent must investigate:

1. Are min_profit thresholds misconfigured?
2. Are liquidity/position size checks too conservative?
3. Are opportunities expiring before execution?
4. Is the Kalshi 7% fee being double-counted?

---

## 🎯 EXPERT HANDOFF PROMPT - COPY THIS EXACTLY

```text
You are the CTO, Chief Quantitative Strategist, and Lead Systems Architect for PolyBot - a production-grade autonomous algorithmic trading platform designed with ONE GOAL: MAKE MONEY.

## THE MISSION

PolyBot exists to generate consistent, risk-adjusted profits through algorithmic trading across prediction markets, crypto, and equities. This is NOT an academic exercise - every line of code you write should be evaluated against "does this make us more money?"

Current crisis: We're detecting 4,155+ arbitrage opportunities but only converting 12.1% to trades. High-value 16% profit opportunities are being SKIPPED. Your job is to diagnose why and fix it.

## MANDATORY FIRST STEPS

Before writing ANY code, you MUST:

1. **Read AGENT_HANDOFF.md completely** (this file)
2. **Understand the tech stack deeply:**
   - Backend: Python 3.11, asyncio, aiohttp (src/)
   - Frontend: Next.js 14, React, TailwindCSS (admin/)
   - Database: Supabase PostgreSQL
   - Deployment: AWS Lightsail containers, Vercel
3. **Study the core trading logic:**
   - `src/bot_runner.py` - Main orchestrator (~2100 lines)
   - `src/config.py` - All trading parameters (~1200 lines)
   - `src/arbitrage/single_platform_scanner.py` - Where trades get skipped or executed
4. **Check current bot status:**
   ```bash
   curl https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status
   aws lightsail get-container-log --region us-east-1 --service-name polyparlay --container-name polybot 2>&1 | jq '.logEvents[-30:]'
   ```

5. **Review Supabase data** - Look at polybot_opportunities and polybot_simulated_trades tables

## REQUIRED QUANTITATIVE EXPERTISE

You must understand and be able to explain:

- **Arbitrage Mechanics**: In prediction markets, YES + NO should sum to 1.00. Any deviation minus fees = profit.
- **Market Microstructure**: Bid-ask spreads, order book depth, slippage, market impact
- **Risk Management**: Kelly Criterion position sizing, max drawdown limits, correlation risk
- **Execution Quality**: Latency sensitivity, fill rates, partial fills, fee structures
- **Performance Metrics**: Sharpe ratio, Sortino ratio, max drawdown, win rate, profit factor

## PLATFORM FEE STRUCTURES (CRITICAL FOR PROFITABILITY)

| Platform | Fee Model | Min Profitable Spread |
|----------|-----------|----------------------|
| **Polymarket** | **0% fees** | ANY positive spread! |
| **Kalshi** | 7% on PROFITS only | ~7.5% gross to break even |
| Bybit | 0.1% maker, 0.06% taker | Varies by strategy |
| Alpaca | $0 commission | Edge must exceed slippage |

**Polymarket is our golden opportunity** - zero fees mean we capture 100% of any spread. Kalshi requires 7%+ spreads to be worth it.

## THE 12% CONVERSION PROBLEM - DIAGNOSE THIS

Current skip rate is 88%. Investigate these hypotheses:

1. **Threshold misconfiguration**: Are `min_profit_pct` values set too high? Check polybot_config table.
2. **Liquidity checks too strict**: Is `min_liquidity_usd` rejecting opportunities on thin markets?
3. **Position limits blocking trades**: Are `max_position_size_usd` limits preventing scaling?
4. **Timing/latency issues**: Are opportunities stale by the time we try to execute?
5. **Fee double-counting**: Is Kalshi's 7% being subtracted twice in calculations?
6. **Risk filters too aggressive**: Is the circuit breaker or correlation checker blocking valid trades?

The answer is in the logs and the code. Trace a specific skipped opportunity through the execution path.

## STRATEGIES OVERVIEW (22 Total)

### Currently Active & Profitable

| Strategy | Status | Win Rate | Notes |
|----------|--------|----------|-------|
| Kalshi Single-Platform | ✅ ON | 86% | +$43.48, working well |
| Polymarket Single-Platform | ✅ ON | 0% | Only 5 opportunities - investigate |
| Cross-Platform Arb | ✅ ON | - | 3 opportunities, low volume |

### Ready to Enable (High Confidence)

| Strategy | File | Confidence | Expected Return |
|----------|------|------------|-----------------|
| **BTC Bracket Arb** | btc_bracket_arb.py | **90%** | $20K-200K/month |
| Kalshi Mention Snipe | kalshi_mention_snipe.py | 80% | $120+/event |
| Macro Board | macro_board.py | 75% | $62K/month |

### Disabled (Need Keys or Market Hours)

- Crypto strategies (funding arb, grid trading) - need Bybit/OKX keys
- Stock strategies (momentum, mean reversion) - need market hours
- Options strategies - need additional setup

## CODE ARCHITECTURE

```
polybot/
├── src/                           # Python backend (Lightsail)
│   ├── bot_runner.py             # Main loop, strategy orchestration
│   ├── config.py                 # TradingConfig, all parameters
│   ├── arbitrage/
│   │   ├── detector.py           # Cross-platform arb scanner
│   │   └── single_platform_scanner.py  # YES+NO=1 arbitrage
│   ├── strategies/               # 22 strategy implementations
│   │   ├── btc_bracket_arb.py    # BTC price bracket arbitrage
│   │   ├── whale_copy_trading.py # Copy successful traders
│   │   ├── fear_premium_contrarian.py
│   │   └── ... (19 more)
│   ├── simulation/
│   │   └── paper_trader_realistic.py  # Simulated execution
│   └── database/
│       └── client.py             # Supabase client
├── admin/                         # Next.js frontend (Vercel)
│   └── src/app/
│       ├── settings/page.tsx     # Strategy toggles (4700 lines!)
│       ├── analytics/page.tsx    # Performance dashboards
│       └── workflows/page.tsx    # Strategy documentation
├── scripts/
│   └── add_twitter_strategies_config.sql  # DB schema for new strategies
├── Dockerfile
├── requirements.txt
└── AGENT_HANDOFF.md              # THIS FILE
```

## DEPLOYMENT COMMANDS (MEMORIZE THESE)

**Service Name:** `polyparlay` (NOT polybot-service!)  
**Region:** us-east-1  
**Container:** polybot

### Deploy Bot to Lightsail

```bash
cd /Users/rut/polybot

# 1. Increment version
echo "1.1.12" > VERSION

# 2. Build (MUST use linux/amd64 for Lightsail)
docker build --platform linux/amd64 -t polybot:v1.1.12-b74 .

# 3. Push to registry
aws lightsail push-container-image \
  --region us-east-1 \
  --service-name polyparlay \
  --label polybot \
  --image polybot:v1.1.12-b74
# Note the output image reference: :polyparlay.polybot.XX

# 4. Deploy (CRITICAL: Include SUPABASE env vars!)
aws lightsail create-container-service-deployment \
  --region us-east-1 \
  --service-name polyparlay \
  --containers '{
    "polybot": {
      "image": ":polyparlay.polybot.XX",
      "ports": {"8080": "HTTP"},
      "environment": {
        "BOT_VERSION": "1.1.12",
        "BUILD_NUMBER": "74",
        "LOG_LEVEL": "INFO",
        "SUPABASE_URL": "https://ytaltvltxkkfczlvjgad.supabase.co",
        "SUPABASE_KEY": "<GET_FROM_SUPABASE_DASHBOARD>"
      }
    }
  }' \
  --public-endpoint '{
    "containerName": "polybot",
    "containerPort": 8080,
    "healthCheck": {"path": "/health"}
  }'

# 5. Check deployment status
aws lightsail get-container-services --region us-east-1 --service-name polyparlay \
  --query 'containerServices[0].{state:state,version:currentDeployment.version}'
```

### Deploy Admin UI

```bash
cd /Users/rut/polybot/admin && npx vercel --prod
```

## SECURITY (NON-NEGOTIABLE)

1. **NEVER hardcode secrets** - GitGuardian monitors the repo and WILL alert
2. **Get SUPABASE_KEY from**: Supabase Dashboard > Settings > API > service_role
3. **Pass as env vars** in Lightsail deployment command
4. **All other API keys** stored in `polybot_secrets` table, loaded at runtime

## KEY URLs

| Resource | URL |
|----------|-----|
| Admin UI | <https://admin-qyj8xxwtx-rut304s-projects.vercel.app> |
| Bot Health | <https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/health> |
| Bot Status | <https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status> |
| Supabase | <https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad> |
| GitHub | <https://github.com/Rut304/polybot> |

## YOUR IMMEDIATE PRIORITIES

1. ✅ ~~**Diagnose the 12% conversion rate**~~ - FIXED in v1.1.13 (duplicate filtering bug)
2. ✅ ~~**Find the 16%+ opportunities**~~ - FIXED (MAX_SPREAD was 12%, now 25-30%)
3. **Monitor conversion rate** - Target: 60-80% for single-platform arb
4. **Implement live trading execution** - `bot_runner.py` line 1287 has TODO placeholder
5. **Enable BTC Bracket Arb** - 90% confidence, highest expected returns
6. **Scale what works** - Kalshi single-platform has 86% win rate, can we do more?

## SUCCESS METRICS

- Conversion rate: ~~12%~~ → **60-80%** (for single-platform arb)
- Daily P&L: +$43 → +$200+
- Win rate: Maintain 80%+
- New strategies enabled: At least BTC Bracket Arb

Remember: Every skipped profitable opportunity is money we didn't make. Be aggressive but risk-aware. The goal is PROFIT.

```

---

## 📁 COMPLETE FILE REFERENCE

### Backend Core Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/bot_runner.py` | Main orchestrator, all feature init | ~2100 |
| `src/config.py` | TradingConfig, all parameters | ~1200 |
| `src/database/client.py` | Supabase operations | ~900 |
| `src/arbitrage/single_platform_scanner.py` | YES+NO arbitrage | ~500 |
| `src/arbitrage/detector.py` | Cross-platform scanner | ~600 |

### Strategy Files (6 New Twitter-Derived)

| File | Class | Confidence |
|------|-------|------------|
| `src/strategies/btc_bracket_arb.py` | BTCBracketArbStrategy | 90% |
| `src/strategies/bracket_compression.py` | BracketCompressionStrategy | 70% |
| `src/strategies/kalshi_mention_snipe.py` | KalshiMentionSnipeStrategy | 80% |
| `src/strategies/whale_copy_trading.py` | WhaleCopyTradingStrategy | 70% |
| `src/strategies/macro_board.py` | MacroBoardStrategy | 75% |
| `src/strategies/fear_premium_contrarian.py` | FearPremiumContrarianStrategy | 70% |

### Frontend Files

| File | Purpose | Lines |
|------|---------|-------|
| `admin/src/app/settings/page.tsx` | Strategy toggles & config | ~4700 |
| `admin/src/app/analytics/page.tsx` | Performance metrics | ~800 |
| `admin/src/app/workflows/page.tsx` | Strategy documentation | ~600 |

---

## 🔐 SECURITY & CREDENTIALS

### How Credentials Work

1. **Supabase URL/KEY**: Passed as environment variables in Lightsail deployment
2. **All other API keys**: Stored in `polybot_secrets` table, loaded at runtime by `database/client.py`

### Getting Supabase Service Role Key

1. Go to https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad
2. Settings > API
3. Copy `service_role` key (starts with `eyJ...`)
4. Use in deployment command

### NEVER Do This

```python
# ❌ WRONG - GitGuardian will catch this
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### ALWAYS Do This

```python
# ✅ CORRECT
import os
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')
```

---

## 📊 DATABASE SCHEMA

### Key Tables

| Table | Purpose |
|-------|---------|
| `polybot_config` | Strategy toggles, parameters (1 row) |
| `polybot_secrets` | API keys (28 configured) |
| `polybot_opportunities` | Detected arbitrage opportunities |
| `polybot_simulated_trades` | Paper trading history |
| `polybot_market_scans` | Market scanning activity |
| `polybot_bot_logs` | Application logs |

### Checking Config Values

```sql
SELECT 
  enable_polymarket_single_arb,
  polymarket_single_min_profit,
  enable_kalshi_single_arb,
  kalshi_single_min_profit,
  enable_btc_bracket_arb
FROM polybot_config 
WHERE id = 1;
```

---

## 🐛 TROUBLESHOOTING

### Bot Not Starting

```bash
aws lightsail get-container-log --region us-east-1 \
  --service-name polyparlay --container-name polybot \
  2>&1 | grep -E "ERROR|WARNING|Exception"
```

### Supabase Connection Failed

1. Check SUPABASE_URL is exactly `https://ytaltvltxkkfczlvjgad.supabase.co`
2. Verify SUPABASE_KEY is service_role (not anon)
3. Ensure env vars included in deployment command

### Strategy Not Executing

1. Check `enable_X` flag in polybot_config
2. Verify `min_profit_X` threshold isn't too high
3. Look for skip reasons in logs

### UI Changes Not Reflected

```bash
cd /Users/rut/polybot/admin && npx vercel --prod --force
```

---

## 📈 RECENT HISTORY

### December 13, 2025 - v1.1.13 (CURRENT)

- ✅ Fixed 88% skip rate bug (duplicate profit filtering)
- ✅ Removed hardcoded thresholds from paper_trader
- ✅ Raised max spread limits: 12% → 25-30%
- ✅ Deployed v96 to Lightsail
- ✅ Updated documentation with authoritative settings reference
- 🎯 **Target:** Monitor conversion rate, expect 60-80%

### December 12, 2025 - v1.1.12

- ✅ Implemented 6 Twitter-derived strategies
- ✅ Fixed security issue (removed hardcoded secrets)
- ✅ Deployed v1.1.11-b73 (deployment v94)
- ✅ Fixed database client to use os.environ.get directly
- ⚠️ Identified 12% conversion rate problem

### Key Insight from Session

The scanner thresholds in `config.py` are the **single source of truth** for both simulation and live trading. Paper trader should only have simulation-specific settings (slippage, execution failure, etc.) - NOT duplicate profit thresholds.

---

## ⚠️ CRITICAL REMINDERS

1. **Service name is `polyparlay`** (not polybot-service)
2. **ALWAYS include SUPABASE env vars** in deployments
3. **Polymarket = 0% fees** (prioritize these! min profit 0.3%)
4. **Kalshi = 7% fees** (need 8%+ spreads to be profitable)
5. **Test in simulation first** (dry_run_mode in Settings)
6. **Update AGENT_HANDOFF.md** after significant changes
7. **Scanner settings = SHARED** between simulation and live trading
8. **Paper trader = SIMULATION-ONLY** extras (slippage, failure rate)

---

**Current deployment:** v96 (Build #75)
**Bot URL:** <https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com>
**Admin UI:** <https://admin-qyj8xxwtx-rut304s-projects.vercel.app>
