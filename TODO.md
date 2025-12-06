# PolyBot To-Do List

## Active Tasks (December 4, 2025)

### 1. 🚨 HIGH PRIORITY - Production Deployment

- [x] Check if latest changes are deployed to production
- [x] Migrated from ECS to Lightsail (Dec 2025) - 10x cost savings!
- [ ] **ACTION NEEDED**: Commit and push changes, then rebuild on Lightsail

**Status**: All changes are LOCAL ONLY. Need to:

```bash
git add -A
git commit -m "Add balances, positions, notifications, stock strategies, secrets sync"
git push origin main

# Then SSH into Lightsail and rebuild:
# ssh ubuntu@<LIGHTSAIL_IP>
# cd ~/polybot && git pull && docker-compose up -d --build
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

**Key Finding**: Migrated from ECS ($54/day) to Lightsail ($0.17/day)!

**Completed Actions**:

- [x] Stop admin-ui on ECS (use Vercel instead - FREE)
- [x] Stop video-render-cluster if unused
- [x] Migrated polybot to Lightsail ($5/month)

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

1. **Commit & Deploy**: Push all local changes, rebuild on Lightsail
2. **Set up Alpaca/CCXT feeds**: For stock/crypto data in Markets page
