# PolyBot Productization Roadmap

> Saved for future reference - to revisit when ready to open to friends/public

## 🎯 Product Vision

Allow friends and eventually the public to use PolyBot with their own API keys for prediction market arbitrage.

---

## 💰 Subscription Tiers

### Free Trial (14 days)

- Paper trading only
- 10 markets/day scan limit
- Basic analytics
- Email support

### Starter ($29/mo)

- Paper trading unlimited
- All markets scanned
- Email alerts (daily digest)
- Standard analytics

### Pro ($99/mo)

- **Live trading enabled**
- Real-time alerts (Discord, Telegram)
- Advanced analytics (Sharpe, drawdown)
- Priority support
- API access

### Enterprise ($299/mo)

- Multiple accounts
- Custom strategies
- White-label options
- Dedicated support
- SLA guarantees

---

## 🔐 Multi-User Architecture

### Database Changes

```sql
-- Users table
CREATE TABLE polybot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  subscription_tier TEXT DEFAULT 'free',
  subscription_ends_at TIMESTAMP,
  stripe_customer_id TEXT,
  settings JSONB DEFAULT '{}'
);

-- User API Keys (encrypted)
CREATE TABLE polybot_user_keys (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES polybot_users(id),
  platform TEXT NOT NULL, -- 'polymarket' or 'kalshi'
  encrypted_key TEXT NOT NULL,
  encrypted_secret TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_validated TIMESTAMP,
  is_valid BOOLEAN DEFAULT false
);

-- Per-user trades
ALTER TABLE polybot_simulated_trades ADD COLUMN user_id UUID REFERENCES polybot_users(id);
ALTER TABLE polybot_opportunities ADD COLUMN user_id UUID REFERENCES polybot_users(id);

-- RLS Policies
ALTER TABLE polybot_simulated_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own trades" ON polybot_simulated_trades
  FOR ALL USING (auth.uid() = user_id);
```

### Backend Changes

- Spawn separate bot instances per user (ECS tasks)
- Queue system for fair resource allocation
- Rate limiting per tier
- Key encryption with AWS KMS

### Frontend Changes

- Onboarding flow for new users
- API key input with validation
- Subscription management page
- User settings/preferences

---

## 💳 Payment Integration

### Stripe Setup

1. Create Stripe account
2. Set up products/prices for each tier
3. Implement checkout session
4. Handle webhooks for subscription events

### Required Endpoints

```typescript
// Create checkout session
POST /api/stripe/create-checkout
{ priceId: 'price_xxx', userId: 'xxx' }

// Handle webhook
POST /api/stripe/webhook
// Subscription created/updated/cancelled

// Customer portal
GET /api/stripe/portal
// Returns portal URL for subscription management
```

### Stripe Webhook Events

- `checkout.session.completed` - New subscription
- `invoice.paid` - Renewal success
- `invoice.payment_failed` - Payment failed
- `customer.subscription.deleted` - Cancelled

---

## 📧 Email System

### Provider Options

- **SendGrid** - $19.95/mo for 50k emails
- **Resend** - $20/mo for 50k emails (modern API)
- **AWS SES** - $0.10 per 1k emails (cheapest)

### Email Types

1. Welcome email
2. Daily performance digest
3. Trade alerts
4. Weekly summary
5. Subscription reminders
6. Password reset

---

## 🖥️ Infrastructure Scaling

### Current (Single User)

```
ECS: 1 task (256 CPU, 512 MB)
Supabase: Free tier
Cost: ~$10/mo
```

### 10 Users

```
ECS: 2-3 tasks with spot instances
Supabase: Pro tier ($25/mo)
Lambda: Alert processing
Cost: ~$50/mo
```

### 100 Users

```
ECS: Auto-scaling group (5-20 tasks)
Supabase: Team tier ($599/mo) or self-host
ElastiCache: Redis for caching
SQS: Job queues
Cost: ~$300-500/mo
```

---

## 📝 Legal Requirements

### Terms of Service

- Not financial advice disclaimer
- User responsibility for trades
- API key security
- Refund policy
- Termination clauses

### Privacy Policy

- Data collection (email, trade history)
- No selling of user data
- GDPR compliance for EU users
- Data retention periods
- Delete account process

### Risk Disclaimers

- Prediction markets are risky
- Past performance ≠ future results
- Paper trading may differ from live
- Platform outages possible

---

## 🚀 Launch Checklist

### Pre-Launch

- [ ] Multi-user auth working
- [ ] Stripe integration tested
- [ ] Email system configured
- [ ] Legal docs written
- [ ] Support system (email/Discord)
- [ ] Landing page
- [ ] Documentation

### Beta Launch (Friends)

- [ ] Invite 5-10 friends
- [ ] Gather feedback
- [ ] Fix critical bugs
- [ ] Refine onboarding

### Public Launch

- [ ] Product Hunt listing
- [ ] Twitter/X announcement
- [ ] Reddit posts (crypto, trading subs)
- [ ] SEO optimization
- [ ] Affiliate program

---

## 📊 Success Metrics

### User Metrics

- Monthly Active Users (MAU)
- Daily Active Users (DAU)
- Retention rate (Day 1, 7, 30)
- Churn rate

### Revenue Metrics

- Monthly Recurring Revenue (MRR)
- Average Revenue Per User (ARPU)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)

### Product Metrics

- Trades per user
- Win rate distribution
- Feature usage
- Error rates

---

## 💡 Future Feature Ideas

1. **Copy Trading** - Follow top performers
2. **Strategy Marketplace** - Buy/sell strategies
3. **Mobile App** - iOS/Android
4. **AI Predictions** - ML-based market analysis
5. **Social Features** - Comments, likes, follows
6. **Tournaments** - Paper trading competitions
7. **API for Developers** - Build on top of PolyBot

---

*Last updated: December 2, 2025*
