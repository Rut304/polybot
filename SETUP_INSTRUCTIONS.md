# PolyBot Setup - Start Here

## 🎯 Quick Start

This repo is ready for the 6-hour arbitrage bot build!

## 📂 What's Here

- `TRADING_BOT_ANALYSIS.md` - Research on 7 existing bots
- `BOT_QUICK_START.md` - Hour-by-hour build guide
- `MORNING_BRIEFING.md` - Executive summary
- `README.md` - Project overview

## 🚀 Next Steps

### 1. Set Up Kalshi Account (10 minutes)
```
1. Go to https://kalshi.com
2. Sign up (email + KYC verification)
3. Deposit $100 minimum
4. Request API access in Settings
5. Download private key (.pem file)
```

### 2. Add GitHub Secrets (5 minutes)
```bash
# From poly-parlay, copy these secrets:
gh secret set SUPABASE_URL -R Rut304/polybot
gh secret set SUPABASE_KEY -R Rut304/polybot
# NOTE: Use AMAZON_ prefix for AWS credentials (not AWS_)
gh secret set AMAZON_ACCESS_KEY_ID -R Rut304/polybot
gh secret set AMAZON_SECRET_ACCESS_KEY -R Rut304/polybot

# From Kalshi (after signup):
gh secret set KALSHI_API_KEY -R Rut304/polybot
gh secret set KALSHI_PRIVATE_KEY -R Rut304/polybot

# Optional (for alerts):
gh secret set DISCORD_WEBHOOK -R Rut304/polybot
```

### 3. Begin Hour 1 (60 minutes)

Open `BOT_QUICK_START.md` and follow:
- **Hour 1**: Fork jtdoherty/arb-bot, test locally
- **Hour 2**: Add database tracking
- **Hour 3**: Build execution engine
- **Hour 4**: Add risk management
- **Hour 5**: Deploy to AWS ECS
- **Hour 6**: Monitoring & alerts

## 📊 Status

- ✅ Repository created
- ✅ Documentation ready
- ✅ Kalshi confirmed legal & available
- ⏳ Waiting for Kalshi API credentials
- ⏳ Ready to begin build

## 🔗 Links

- **This Repo**: https://github.com/Rut304/polybot
- **Kalshi**: https://kalshi.com
- **Base Bot**: https://github.com/jtdoherty/arb-bot
- **PolyParlay**: https://github.com/Rut304/poly-parlay

## ⚠️ Safety First

- Start with $10-50 per trade
- Use dry-run mode initially
- Test thoroughly before going live
- Set conservative limits

---

**Ready to build? Open `BOT_QUICK_START.md` and start Hour 1!**
