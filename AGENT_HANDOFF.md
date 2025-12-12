# PolyBot Agent Handoff Document

**Last Updated:** December 12, 2025  
**Current Version:** v1.1.11 (Build #72)  
**Status:** 🟢 RUNNING in Simulation Mode - +3.4% P&L, 83% Win Rate

---

## 🎯 PERFECT HANDOFF PROMPT - COPY THIS FOR NEXT SESSION

```
You are the CTO, Architect, and Lead Quantitative Developer for PolyBot - a production-grade autonomous algorithmic trading platform for prediction markets, crypto, and stocks.

## CRITICAL: READ AGENT_HANDOFF.md FIRST

Before making ANY changes, you MUST:
1. Read /Users/rut/polybot/AGENT_HANDOFF.md completely - it contains critical context
2. Understand the architecture, deployment process, and security requirements
3. Check current bot status with: aws lightsail get-container-log --region us-east-1 --service-name polyparlay --container-name polybot --start-time "$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ)"

## YOUR EXPERTISE
- PhD-level quantitative finance and algorithmic trading
- Market microstructure and arbitrage theory  
- Full-stack development (Python backend, Next.js/React frontend)
- AWS Lightsail containers and DevOps
- Supabase/PostgreSQL database design

## SECURITY CRITICAL - READ CAREFULLY

1. **NEVER hardcode secrets in code** - GitGuardian monitors the repo and will alert
2. **All secrets stored in Supabase** `polybot_secrets` table
3. **Supabase credentials MUST be passed as environment variables** in Lightsail deployments
4. **Get the service_role key from Supabase Dashboard** > Settings > API > service_role

## DEPLOYMENT COMMANDS (MUST USE THESE)

### Deploy Bot to Lightsail
```bash
cd /Users/rut/polybot

# 1. Build
docker build --platform linux/amd64 -t polybot:vX.X.X-bNN .

# 2. Push  
aws lightsail push-container-image --region us-east-1 --service-name polyparlay --label polybot --image polybot:vX.X.X-bNN

# 3. Deploy (MUST include SUPABASE env vars!)
aws lightsail create-container-service-deployment --region us-east-1 --service-name polyparlay \
  --containers '{"polybot":{"image":":polyparlay.polybot.XX","ports":{"8080":"HTTP"},"environment":{"BOT_VERSION":"X.X.X","LOG_LEVEL":"INFO","SUPABASE_URL":"https://ytaltvltxkkfczlvjgad.supabase.co","SUPABASE_KEY":"<GET_FROM_SUPABASE_DASHBOARD>"}}}' \
  --public-endpoint '{"containerName":"polybot","containerPort":8080,"healthCheck":{"path":"/health","intervalSeconds":30}}'
```

### Deploy Admin UI
```bash
cd /Users/rut/polybot/admin && npx vercel --prod
```

## WHAT IS POLYBOT?

PolyBot trades across THREE asset classes:
- **Prediction Markets**: Polymarket (0% fees!), Kalshi (7% on profits)
- **Crypto**: Bybit, OKX, Coinbase, Kraken (funding arb, grid trading)
- **Stocks**: Alpaca ($0 commission) - mean reversion, momentum

Current focus: Prediction market arbitrage (Polymarket has ZERO fees = pure profit)

## CURRENT STRATEGIES (22 Total)

### Active (Scanning Now)
- Polymarket Single-Platform Arb (0.2% min profit)
- Kalshi Single-Platform Arb (8.0% min - high due to 7% fees)
- Cross-Platform Arb (Polymarket ↔ Kalshi)

### NEW - Twitter-Derived (Just Implemented, Ready to Enable)
These 6 strategies were added Dec 12 based on analyzing profitable Twitter traders:

| Strategy | File | Confidence | Expected Returns |
|----------|------|------------|------------------|
| BTC Bracket Arb | btc_bracket_arb.py | 90% | $20K-200K/month |
| Bracket Compression | bracket_compression.py | 70% | 15-30% APY |
| Kalshi Mention Snipe | kalshi_mention_snipe.py | 80% | $120+/event |
| Whale Copy Trading | whale_copy_trading.py | 70% | 25-50% APY |
| Macro Board | macro_board.py | 75% | $62K/month |
| Fear Premium Contrarian | fear_premium_contrarian.py | 70% | 50-200%/trade |

### Ready But Disabled
- Market Making, News Arbitrage
- Funding Rate Arb, Grid Trading, Pairs Trading (need crypto keys)
- Stock strategies (5 types - need market hours)
- Options strategies (5 types)

## KEY FILES

### Backend (/src/)
- `bot_runner.py` - Main orchestrator (~2100 lines)
- `config.py` - All trading parameters (~1200 lines)
- `bootstrap_config.py` - Secure credential loading
- `database/client.py` - Supabase client
- `strategies/` - All 22 strategy implementations

### Frontend (/admin/src/app/)
- `settings/page.tsx` - Strategy toggles (~4700 lines!)
- `workflows/page.tsx` - Strategy documentation
- `analytics/page.tsx` - Performance metrics

### Documentation
- `AGENT_HANDOFF.md` - THIS FILE (read first!)
- `ALGO_TRADING_DEEP_RESEARCH.md` - Strategy research
- `PROFITABLE_STRATEGIES.md` - Twitter trader analysis

## DATABASE

Supabase project: `ytaltvltxkkfczlvjgad`

Key tables:
- `polybot_config` - Strategy toggles and parameters
- `polybot_secrets` - API keys (28 configured)
- `polybot_simulated_trades` - Trade history
- `polybot_opportunities` - Detected opportunities

## URLS

| Resource | URL |
|----------|-----|
| Admin UI | https://admin-qyj8xxwtx-rut304s-projects.vercel.app |
| Bot Health | https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/health |
| Supabase | https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad |
| GitHub | https://github.com/Rut304/polybot |

## RECENT CHANGES (Dec 12, 2025)

1. ✅ Implemented 6 Twitter-derived strategies with full UI integration
2. ✅ Fixed security issue (removed hardcoded secrets from bootstrap_config.py)
3. ✅ Deployed v1.1.11-b72 with secure credential loading
4. ✅ Updated AGENT_HANDOFF.md with complete context

## NEXT PRIORITIES

1. Enable and test BTC Bracket Arb strategy (90% confidence)
2. Monitor new strategies in simulation mode
3. Consider rotating Supabase service_role key (was briefly in git history)
4. Optimize existing strategies based on analytics data
```

---

## 📁 COMPLETE FILE STRUCTURE

```
polybot/
├── admin/                      # Next.js admin UI (Vercel)
│   └── src/app/
│       ├── page.tsx           # Dashboard
│       ├── settings/page.tsx  # Strategy config (4700 lines!)
│       ├── workflows/page.tsx # Strategy docs
│       ├── analytics/page.tsx # Performance
│       └── api/               # Backend API routes
├── src/                        # Python bot (Lightsail)
│   ├── bot_runner.py          # Main orchestrator
│   ├── config.py              # Trading parameters
│   ├── bootstrap_config.py    # Secure credential loading
│   ├── main.py                # Entry point
│   ├── database/
│   │   └── client.py          # Supabase client
│   ├── arbitrage/
│   │   ├── detector.py        # Cross-platform arb
│   │   └── single_platform_scanner.py
│   ├── strategies/            # 22 strategy files
│   │   ├── __init__.py        # Exports all strategies
│   │   ├── btc_bracket_arb.py # NEW
│   │   ├── bracket_compression.py # NEW
│   │   ├── kalshi_mention_snipe.py # NEW
│   │   ├── whale_copy_trading.py # NEW
│   │   ├── macro_board.py     # NEW
│   │   ├── fear_premium_contrarian.py # NEW
│   │   └── ... (16 more)
│   ├── simulation/
│   │   └── paper_trader_realistic.py
│   ├── exchanges/
│   │   ├── alpaca_client.py
│   │   └── ccxt_client.py
│   └── clients/
│       ├── polymarket_client.py
│       └── kalshi_client.py
├── scripts/
│   ├── deploy.sh              # Deployment script
│   └── add_twitter_strategies_config.sql # DB schema
├── Dockerfile
├── requirements.txt
├── AGENT_HANDOFF.md           # THIS FILE
├── ALGO_TRADING_DEEP_RESEARCH.md
├── PROFITABLE_STRATEGIES.md
└── TODO.md
```

---

## 🔐 SECURITY & CREDENTIALS

### NEVER DO THIS:
```python
# ❌ WRONG - GitGuardian will catch this
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### ALWAYS DO THIS:
```python
# ✅ CORRECT - Read from environment
import os
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')
```

### How Credentials Work
1. **Local dev**: Use `.env` file (gitignored)
2. **Production**: Pass as Lightsail environment variables in deployment command
3. **All other secrets**: Stored in Supabase `polybot_secrets` table, loaded at runtime

### Getting the Supabase Service Role Key
1. Go to https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad
2. Settings > API
3. Copy the `service_role` key (starts with `eyJ...`)
4. Use in deployment command as `SUPABASE_KEY` env var

---

## 🚀 DEPLOYMENT GUIDE

### Deploy Bot to AWS Lightsail

```bash
cd /Users/rut/polybot

# 1. Increment version
echo "1.1.12" > VERSION

# 2. Build Docker image (MUST use linux/amd64 for Lightsail)
docker build --platform linux/amd64 -t polybot:v1.1.12-b73 .

# 3. Push to Lightsail container registry
aws lightsail push-container-image \
  --region us-east-1 \
  --service-name polyparlay \
  --label polybot \
  --image polybot:v1.1.12-b73

# Note the image reference in output, e.g., ":polyparlay.polybot.65"

# 4. Deploy with environment variables (CRITICAL!)
aws lightsail create-container-service-deployment \
  --region us-east-1 \
  --service-name polyparlay \
  --containers '{
    "polybot": {
      "image": ":polyparlay.polybot.65",
      "ports": {"8080": "HTTP"},
      "environment": {
        "BOT_VERSION": "1.1.12",
        "BUILD_NUMBER": "73",
        "LOG_LEVEL": "INFO",
        "SUPABASE_URL": "https://ytaltvltxkkfczlvjgad.supabase.co",
        "SUPABASE_KEY": "<PASTE_SERVICE_ROLE_KEY_HERE>"
      }
    }
  }' \
  --public-endpoint '{
    "containerName": "polybot",
    "containerPort": 8080,
    "healthCheck": {
      "path": "/health",
      "intervalSeconds": 30,
      "timeoutSeconds": 5
    }
  }'

# 5. Check deployment status
aws lightsail get-container-services \
  --region us-east-1 \
  --service-name polyparlay \
  --query 'containerServices[0].{state:state,version:currentDeployment.version}'

# 6. Check logs
aws lightsail get-container-log \
  --region us-east-1 \
  --service-name polyparlay \
  --container-name polybot \
  --start-time "$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ)" 2>&1 | \
  grep '"message"' | head -30
```

### Deploy Admin UI to Vercel

```bash
cd /Users/rut/polybot/admin
npx vercel --prod

# Or commit and push (auto-deploys):
git add -A && git commit -m "Update" && git push
```

---

## 📊 STRATEGY CONFIGURATION

### Via Admin UI (Recommended)
1. Go to Settings page in admin UI
2. Toggle strategies ON/OFF
3. Adjust parameters (min profit %, max position size, etc.)
4. Click Save - updates Supabase immediately
5. Bot picks up changes within 60 seconds

### Via SQL (Direct)
```sql
-- Enable BTC Bracket Arb
UPDATE polybot_config 
SET enable_btc_bracket_arb = true,
    btc_bracket_min_discount_pct = 0.5,
    btc_bracket_max_position_usd = 50
WHERE id = 1;
```

### Current Strategy Settings
| Strategy | Enabled | Min Profit | Max Position |
|----------|---------|------------|--------------|
| Polymarket Single | ✅ | 0.2% | $100 |
| Kalshi Single | ✅ | 8.0% | $30 |
| Cross-Platform | ✅ | 2.5%/9.0% | $75 |
| BTC Bracket Arb | ❌ | 0.5% | $50 |
| All others | ❌ | Various | Various |

---

## 🐛 TROUBLESHOOTING

### Bot Not Starting
```bash
# Check logs for startup errors
aws lightsail get-container-log --region us-east-1 --service-name polyparlay \
  --container-name polybot --start-time "$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ)"
```

Common issues:
- Missing SUPABASE_URL/KEY in deployment → Add to environment
- Import error in strategies → Check `__init__.py` exports match class names
- Config mismatch → Ensure `config.py` TradingConfig matches `bot_runner.py` usage

### UI Not Updating
```bash
# Force redeploy admin
cd admin && npx vercel --prod --force
```

### Database Connection Failed
- Verify SUPABASE_URL is correct
- Verify SUPABASE_KEY is the service_role key (not anon key)
- Check Supabase dashboard for any outages

---

## 📞 RESOURCES

| Resource | URL |
|----------|-----|
| **Admin UI** | https://admin-qyj8xxwtx-rut304s-projects.vercel.app |
| **Bot Health** | https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/health |
| **Bot Status** | https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status |
| **Supabase** | https://supabase.com/dashboard/project/ytaltvltxkkfczlvjgad |
| **GitHub** | https://github.com/Rut304/polybot |
| **Lightsail Console** | https://lightsail.aws.amazon.com/ls/webapp/us-east-1/container-services/polyparlay |

---

## ⚠️ CRITICAL REMINDERS

1. **NEVER hardcode secrets** - Use environment variables
2. **ALWAYS include SUPABASE_URL and SUPABASE_KEY** in Lightsail deployments
3. **Test in simulation first** - `dry_run_mode` in Settings
4. **Kalshi has 7% fees** - Need 8%+ profit thresholds
5. **Polymarket has 0% fees** - Prioritize these opportunities
6. **Check logs after deployment** - Ensure no startup errors
7. **Update AGENT_HANDOFF.md** after significant changes

---

**Last deployed:** v1.1.11-b72 on December 12, 2025
**Bot status:** Running, Simulation Mode, +3.4% P&L
