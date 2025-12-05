# PolyBot To-Do List

## Active Tasks (December 4, 2025)

### 1. 🚨 HIGH PRIORITY - Production Deployment Issue

- [x] Check if latest changes are deployed to production
- [x] Identify if old task/container version is running on ECS
- [ ] **ACTION NEEDED**: Commit and push changes to deploy

**Status**: All changes are LOCAL ONLY. Need to:

```bash
git add -A
git commit -m "Add balances, positions, notifications, stock strategies, secrets sync"
git push origin main
```

### 2. 🔐 Secrets Page Security

- [x] Add 2FA/re-authentication layer to secrets page
- [x] Wire up to AWS Secrets Manager (API route created)
- [x] Wire up to GitHub Secrets (API route created)
- [x] Ensure secure storage and access patterns

### 3. 📊 Market Browser Enhancements

- [x] Add filter by data source (Polymarket, Kalshi, Alpaca, CCXT)
- [x] Add filter by asset type (prediction market, stock, crypto)
- [ ] Implement stock data feed integration (needs Alpaca API)
- [ ] Implement crypto data feed integration (needs CCXT setup)

### 4. 💰 AWS Cost Analysis - COMPLETED

See `/docs/AWS_COST_ANALYSIS.md` for full breakdown.

**Key Finding**: ECS costs $54.84/day = $1,645/month!

**Root Cause**:

- admin-ui (1 vCPU, 2GB): ~$25/day
- video-render-cluster (1 vCPU, 2GB): ~$25/day

**Recommended Actions**:

- [ ] Stop admin-ui on ECS (use Vercel instead - FREE)
- [ ] Stop video-render-cluster if unused
- [ ] Keep polybot-service (only $2.50/day)

---

## Completed Tasks

- [x] Stock trading strategies (Mean Reversion, Momentum)
- [x] Balance aggregator integration
- [x] Notifications page
- [x] Positions page
- [x] Balances page
- [x] Navigation updates
- [x] AWS cost analysis
- [x] Secrets page security enhancements

---

## Next Steps

1. **Commit & Deploy**: Push all local changes
2. **Stop ECS services**: Save $50/day immediately
3. **Set up Alpaca/CCXT feeds**: For stock/crypto data in Markets page
