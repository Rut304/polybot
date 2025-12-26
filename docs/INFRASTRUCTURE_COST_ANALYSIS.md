# PolyBot SaaS Infrastructure Cost Analysis

## Executive Summary

This document analyzes the infrastructure costs and options for running PolyBot as a SaaS business. We compare the current setup with optimized alternatives to maximize profitability.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT SETUP                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐      │
│  │   Vercel     │    │  Supabase    │    │   AWS Lightsail         │      │
│  │  (Frontend)  │    │  (Database)  │    │   (Trading Bot)         │      │
│  │              │    │              │    │                          │      │
│  │  • Admin UI  │◄──►│  • Postgres  │◄──►│  • Python Bot            │      │
│  │  • Landing   │    │  • Auth      │    │  • 24/7 Scanner          │      │
│  │  • API Routes│    │  • Realtime  │    │  • Trade Execution       │      │
│  │              │    │              │    │                          │      │
│  │  $0/month    │    │  $0-25/month │    │  $5-7/month              │      │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘      │
│                                                                              │
│                      Total Current: ~$5-35/month                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Breakdown by Component

### 1. Frontend (Admin Dashboard & Landing Page)

| Provider | Plan | Cost | Features |
|----------|------|------|----------|
| **Vercel** | Hobby | **$0** | 100GB bandwidth, Serverless Functions, Edge |
| Vercel | Pro | $20/mo | Team features, more bandwidth |
| Netlify | Free | $0 | Similar to Vercel |
| AWS Amplify | Pay-per-use | ~$2/mo | Tightly integrated with AWS |

**Recommendation:** Stay on **Vercel Free** tier. It handles:
- ✅ Admin dashboard
- ✅ Landing page
- ✅ API routes (Stripe webhooks, config reads)
- ✅ Server-side rendering
- ✅ Automatic HTTPS & CDN

### 2. Database (Supabase)

| Plan | Cost | Limits | Use Case |
|------|------|--------|----------|
| **Free** | **$0** | 500MB DB, 2GB storage, 50k monthly users | Development, <100 users |
| **Pro** | **$25/mo** | 8GB DB, 100GB storage, unlimited users | Production SaaS |
| Pro + | $599/mo | 100GB DB, team features | Large scale |

**Supabase Pro Includes:**
- 8GB database space
- Daily backups retained 7 days
- Point-in-time recovery
- 250GB bandwidth
- Email support
- Row-level security
- Real-time subscriptions

**Recommendation:** 
- Start with **Free** tier during beta/launch
- Upgrade to **Pro** ($25/mo) when you hit 100+ paying users
- Break-even: Just 2-3 Pro tier subscribers covers this cost

### 3. Trading Bot Backend

| Option | Monthly Cost | Pros | Cons |
|--------|-------------|------|------|
| **Lightsail Instance** | **$5-10** | SSH access, simple, cheap | Manual scaling |
| Lightsail Container | $7-25 | Docker native | Slightly more expensive |
| EC2 t4g.nano (ARM) | $3-4 | Cheapest compute | Requires more setup |
| ECS Fargate | $50-150 | Auto-scaling | Expensive for single bot |
| Railway | $5-20 | Easy deploys | Less control |
| Fly.io | $0-10 | Global, free tier | Learning curve |

**Current Setup:** Lightsail Container Service @ $7/month

**Recommendation:** Stay with **Lightsail** ($7/mo) until you need multi-region or auto-scaling.

---

## SaaS Scaling Scenarios

### Scenario 1: MVP Launch (0-50 users)
```
Component              Monthly Cost
─────────────────────────────────
Vercel (Free)          $0
Supabase (Free)        $0
Lightsail              $7
Domain (annual/12)     $1
────────────────────────────────
TOTAL                  $8/month
```

**Margin Analysis at MVP:**
- 5 Pro users ($29/mo × 5) = $145 revenue
- Costs: $8
- **Gross Margin: 94.5%**

### Scenario 2: Growth (50-500 users)
```
Component              Monthly Cost
─────────────────────────────────
Vercel (Free/Pro)      $0-20
Supabase Pro           $25
Lightsail (2x)         $14
Monitoring (Basic)     $10
Email (Resend)         $20
────────────────────────────────
TOTAL                  $69-89/month
```

**Margin Analysis at Growth:**
- 50 Pro users ($29 × 50) = $1,450/mo
- 10 Elite users ($99 × 10) = $990/mo
- Total Revenue: $2,440/mo
- Costs: $89
- **Gross Margin: 96.4%**

### Scenario 3: Scale (500-5000 users)
```
Component              Monthly Cost
─────────────────────────────────
Vercel Pro             $20
Supabase Pro+          $599
AWS ECS (auto-scale)   $200
CloudWatch Monitoring  $50
Email (SendGrid)       $90
Support Tools          $100
────────────────────────────────
TOTAL                  ~$1,059/month
```

**Margin Analysis at Scale:**
- 500 Pro users = $14,500/mo
- 100 Elite users = $9,900/mo
- Total Revenue: $24,400/mo
- Costs: $1,059
- **Gross Margin: 95.7%**

---

## Cost Optimization Strategies

### 1. Keep Infrastructure Minimal
The trading bot is a **single Python process** that:
- Scans markets periodically
- Executes trades via APIs
- Logs to Supabase

This doesn't need Kubernetes, auto-scaling, or complex orchestration.

### 2. Use Supabase Edge Functions for Webhooks
Instead of Vercel API routes, use Supabase Edge Functions (included in all plans):
- Stripe webhooks
- Privy authentication callbacks
- Scheduled tasks

### 3. Leverage Free Tiers Strategically
| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth, unlimited deploys |
| Supabase | 500MB DB, 50k monthly users |
| Resend | 3,000 emails/month |
| Crisp | 2 team members, basic chat |
| GitHub | Unlimited private repos |
| CloudFlare | Unlimited DNS, basic CDN |

### 4. Delay Expensive Upgrades
Only upgrade when you hit limits:
- Supabase Pro: When DB exceeds 500MB
- Vercel Pro: When bandwidth exceeds 100GB
- Multiple bot instances: When single instance can't keep up

---

## Per-User Cost Analysis

### Fixed Costs (Don't Scale with Users)
| Item | Monthly |
|------|---------|
| Lightsail Bot | $7 |
| Domain | $1 |
| **Total Fixed** | **$8** |

### Variable Costs (Scale with Users)
| Item | Per User/Month |
|------|----------------|
| Supabase Storage | ~$0.02 |
| Email (Resend) | ~$0.01 |
| Support Time | ~$0.50 (at scale) |
| **Total Variable** | **~$0.53/user** |

### Unit Economics

| Tier | Price | Variable Cost | Fixed Cost Allocation | **Net Margin** |
|------|-------|---------------|----------------------|----------------|
| Free | $0 | $0.02 | - | -$0.02 |
| Pro | $29 | $0.53 | $0.16 | **$28.31 (97.6%)** |
| Elite | $99 | $0.53 | $0.16 | **$98.31 (99.3%)** |

*Fixed cost allocation assumes 50 paying users*

---

## Build vs Buy: Infrastructure Services

### Authentication
| Option | Cost | Recommendation |
|--------|------|----------------|
| Privy (current) | $0-250/mo | ✅ Keep - Great UX, wallet support |
| Supabase Auth | $0 (included) | Alternative if Privy too expensive |
| Auth0 | $23-240/mo | Overkill for this use case |

### Payments
| Option | Cost | Recommendation |
|--------|------|----------------|
| Stripe | 2.9% + $0.30/txn | ✅ Keep - Industry standard |
| Paddle | 5% + $0.50/txn | Better for EU VAT handling |
| LemonSqueezy | 5% + $0.50/txn | Simpler merchant of record |

### Monitoring
| Option | Cost | Recommendation |
|--------|------|----------------|
| Sentry (free) | $0 | ✅ Error tracking |
| Vercel Analytics | $0 (included) | ✅ Basic analytics |
| Datadog | $15+/host | ❌ Overkill for MVP |
| Better Uptime | $20/mo | Consider for SLA monitoring |

### Customer Support
| Option | Cost | Recommendation |
|--------|------|----------------|
| Crisp | $0-25/mo | ✅ Free tier for MVP |
| Intercom | $74+/mo | Too expensive for MVP |
| Discord | $0 | ✅ Community support |

---

## Infrastructure Decision Matrix

| Decision | MVP (<50 users) | Growth (50-500) | Scale (500+) |
|----------|-----------------|-----------------|--------------|
| **Frontend** | Vercel Free | Vercel Free | Vercel Pro |
| **Database** | Supabase Free | Supabase Pro | Supabase Pro+ |
| **Bot Compute** | Lightsail $7 | Lightsail $14 | ECS Fargate |
| **Email** | Resend Free | Resend $20 | SendGrid |
| **Monitoring** | Vercel + Sentry | + Better Uptime | Datadog |
| **Support** | Discord | Crisp | Intercom |

---

## Action Items

### Immediate (Before Launch)
- [x] Vercel deployment configured
- [x] Supabase database ready
- [x] Lightsail bot running
- [ ] Set up Stripe webhooks
- [ ] Configure Privy authentication
- [ ] Set up error monitoring (Sentry)

### Post-Launch (1-3 months)
- [ ] Monitor Supabase usage, plan for Pro upgrade
- [ ] Set up automated alerts for system health
- [ ] Implement customer support channel (Discord/Crisp)

### Scale Phase (3-12 months)
- [ ] Evaluate multi-region bot deployment
- [ ] Consider dedicated database instance
- [ ] Implement proper CI/CD pipeline
- [ ] Add comprehensive monitoring

---

## Cost Projections by Revenue

| Monthly Revenue | Est. Users (Paying) | Infrastructure Cost | Gross Margin |
|----------------|---------------------|--------------------| -------------|
| $0 | 0 | $8 | -100% |
| $500 | 15-20 | $8 | 98.4% |
| $2,000 | 50-70 | $50 | 97.5% |
| $5,000 | 100-150 | $100 | 98.0% |
| $10,000 | 200-300 | $200 | 98.0% |
| $50,000 | 1000+ | $1,000 | 98.0% |

---

## Conclusion

**Current setup is highly efficient:**
- ~$8/month total infrastructure cost
- 97%+ gross margins achievable immediately
- No need for expensive "enterprise" infrastructure
- Scale triggers are clear (database size, bandwidth, support load)

**Key Insight:** At $29/month Pro tier, you need **less than 1 paying customer** to cover all infrastructure costs. Everything after that is profit (minus payment processing).

---

## References

- [Vercel Pricing](https://vercel.com/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
- [AWS Lightsail Pricing](https://aws.amazon.com/lightsail/pricing/)
- [Stripe Pricing](https://stripe.com/pricing)
