# PolyBot Root Cause Analysis & Multi-Tenant Infrastructure Plan

## 📋 Executive Summary

After deep analysis, we identified **5 critical issues** causing bot failures, and have solutions for each. Additionally, we've analyzed the geo-blocking situation and designed a scalable multi-tenant architecture.

---

## 🔴 Root Cause Analysis

### Issue #1: NewsArbitrageStrategy `scan_interval_sec` Bug

**Severity:** HIGH - Causes strategy to crash repeatedly  
**Status:** ✅ FIXED

```python
# BUG: Line 343 stores as self.scan_interval
self.scan_interval = scan_interval_sec

# BUG: Line 764 tries to access self.scan_interval_sec (doesn't exist!)
await asyncio.sleep(self.scan_interval_sec)  # AttributeError!
```

**Fix Applied:** Changed line 764 to use `self.scan_interval`

---

### Issue #2: Missing `executed_at` Column in Database

**Severity:** MEDIUM - Prevents trade execution tracking  
**Status:** 🔧 SQL READY (needs to be run in Supabase)

```
Error: "Could not find the 'executed_at' column of 'polybot_opportunities'"
```

**Fix:** Run `/scripts/add_executed_at_column.sql` in Supabase SQL Editor

---

### Issue #3: IBKR Gateway Not Running

**Severity:** LOW (for simulation mode) - Expected behavior  
**Status:** ℹ️ BY DESIGN

The bot correctly detects that IBKR Gateway isn't running in the container:

```
❌ IBKR Client failed to connect to port 4002
💡 CHECK: Is the IB Gateway container running?
```

**For Production:** Deploy IBKR Gateway as a sidecar container with credentials

---

### Issue #4: Crypto 15-min Scalping Empty Errors

**Severity:** LOW - Strategy silently fails  
**Status:** ⚠️ NEEDS INVESTIGATION

```
Error fetching 15-min markets: [empty]
```

The strategy catches exceptions but logs empty messages. Need to add better error context.

---

### Issue #5: NewsAPI Rate Limiting

**Severity:** LOW - Self-healing  
**Status:** ℹ️ BY DESIGN

```
NewsAPI rate limit - will retry later
```

This is expected behavior - the bot backs off and retries.

---

## 🌐 Exchange Geo-Blocking Analysis

### Test Results (from AWS us-east-1)

| Exchange | Endpoint | Status | Notes |
|----------|----------|--------|-------|
| **Polymarket** | gamma-api.polymarket.com | ✅ 200 OK | Primary platform - WORKING |
| **Kalshi** | api.elections.kalshi.com | ✅ 200 OK | Primary platform - WORKING |
| **Binance US** | api.binance.us | ✅ 200 OK | US-specific API - WORKING |
| **Coinbase** | api.exchange.coinbase.com | ✅ 200 OK | WORKING |
| **Kraken** | api.kraken.com | ✅ 200 OK | WORKING |
| **Binance Global** | api.binance.com | ❌ 451 Blocked | US IP blocked (legal) |
| **Alpaca** | api.alpaca.markets | ⚠️ 401 Unauthorized | Needs API key auth |

### Key Finding

**Binance Global (api.binance.com) is geo-blocked from ALL US IPs** - this is not AWS-specific. HTTP 451 = "Unavailable For Legal Reasons"

### Solutions for Binance Global Access

| Solution | Complexity | Cost | Latency | Legal Risk |
|----------|------------|------|---------|------------|
| **Use Binance US** | ✅ Easy | Free | Low | None |
| **VPN/Proxy (Non-US)** | Medium | $50-200/mo | +50-100ms | ⚠️ ToS violation |
| **AWS Tokyo/Singapore** | Medium | +$20-50/mo | +150-200ms | ⚠️ Legal gray area |
| **Partner with Binance** | Hard | Varies | Low | None |

**Recommendation:** Use **Binance US (api.binance.us)** for US operations. The API is similar, just uses different trading pairs.

---

## 🏗️ Multi-Tenant Infrastructure Architecture

### Current State (Single-Tenant)

```
┌─────────────────────────────────────────────┐
│           AWS Lightsail (us-east-1)         │
│  ┌───────────────────────────────────────┐  │
│  │     Container: polybot (micro)        │  │
│  │     RAM: 1GB | CPU: 0.25 vCPU         │  │
│  │     Cost: ~$7/month                   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│           Supabase (Free Tier)              │
│  Database: PostgreSQL                       │
│  Storage: 500MB | Bandwidth: 2GB           │
└─────────────────────────────────────────────┘
```

---

### Multi-Tenant Architecture Options

#### Option A: Shared Database, Isolated Bots (Recommended for 25-50 users)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS ECS Fargate Cluster                      │
│  ┌─────────────┐  ┌─────────────┐       ┌─────────────┐        │
│  │  Bot Pod 1  │  │  Bot Pod 2  │  ...  │  Bot Pod N  │        │
│  │  user_id=1  │  │  user_id=2  │       │  user_id=N  │        │
│  │  256MB/0.25 │  │  256MB/0.25 │       │  256MB/0.25 │        │
│  └─────────────┘  └─────────────┘       └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Pro ($25/mo)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Schema: public                                           │  │
│  │  ├── user_configs (tenant_id, settings, api_keys)        │  │
│  │  ├── user_opportunities (tenant_id, opportunity_data)    │  │
│  │  ├── user_trades (tenant_id, trade_data)                 │  │
│  │  └── user_balances (tenant_id, balance_data)             │  │
│  │                                                           │  │
│  │  RLS Policies: tenant_id = auth.uid()                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Pros:**

- Lower cost per user
- Simpler to manage
- Shared infrastructure maintenance

**Cons:**

- Noisy neighbor risk
- Shared database bottleneck at scale

---

#### Option B: Database-per-Tenant (Recommended for 100+ users or enterprise)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes (EKS/GKE)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Bot Deployment                        │   │
│  │  replicas: N (1 per tenant)                             │   │
│  │  resources: 256Mi RAM, 100m CPU                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐     ┌───────────────┐
│  Supabase     │   │  Supabase     │     │  Supabase     │
│  Project 1    │   │  Project 2    │ ... │  Project N    │
│  (User 1)     │   │  (User 2)     │     │  (User N)     │
└───────────────┘   └───────────────┘     └───────────────┘
```

**Pros:**

- Complete isolation
- Independent scaling
- Easier compliance (GDPR data deletion)

**Cons:**

- Higher cost per user
- More complex orchestration
- More databases to manage

---

### Cost Analysis by Scale

#### 25 Users - Shared Model

| Component | Specification | Monthly Cost |
|-----------|--------------|--------------|
| ECS Fargate | 25 x (256MB, 0.25 vCPU) | ~$75 |
| Supabase Pro | 8GB database, 50GB bandwidth | $25 |
| Load Balancer | ALB | $16 |
| Secrets Manager | 25 secrets | ~$10 |
| CloudWatch | Logs/Metrics | ~$15 |
| **Total** | | **~$141/mo** |
| **Per User** | | **~$5.64/mo** |

#### 50 Users - Shared Model

| Component | Specification | Monthly Cost |
|-----------|--------------|--------------|
| ECS Fargate | 50 x (256MB, 0.25 vCPU) | ~$150 |
| Supabase Pro | 8GB database, 100GB bandwidth | $25 |
| Load Balancer | ALB | $16 |
| Secrets Manager | 50 secrets | ~$20 |
| CloudWatch | Logs/Metrics | ~$25 |
| Redis (ElastiCache) | cache.t3.micro | $13 |
| **Total** | | **~$249/mo** |
| **Per User** | | **~$4.98/mo** |

#### 100 Users - Hybrid Model

| Component | Specification | Monthly Cost |
|-----------|--------------|--------------|
| ECS Fargate | 100 x (256MB, 0.25 vCPU) | ~$300 |
| Supabase Team | 32GB database, 200GB bandwidth | $599 |
| Load Balancer | ALB | $16 |
| Secrets Manager | 100 secrets | ~$40 |
| CloudWatch | Logs/Metrics | ~$50 |
| Redis (ElastiCache) | cache.t3.small | $26 |
| SQS (job queue) | Standard queue | ~$5 |
| **Total** | | **~$1,036/mo** |
| **Per User** | | **~$10.36/mo** |

---

### Recommended Architecture for 25-100 Users

```
                         ┌────────────────────┐
                         │   Cloudflare CDN   │
                         │   (DDoS + Cache)   │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │  AWS ALB           │
                         │  (Load Balancer)   │
                         └─────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────▼────────┐  ┌───────▼───────┐  ┌────────▼────────┐
     │   Admin API     │  │   Bot Workers  │  │   Webhook      │
     │   (Next.js)     │  │   (Python)     │  │   Handler      │
     │   Vercel        │  │   ECS Fargate  │  │   Lambda       │
     └────────┬────────┘  └───────┬───────┘  └────────┬────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
           ┌────────▼────┐  ┌────▼─────┐  ┌────▼────┐
           │  Supabase   │  │  Redis   │  │   SQS   │
           │  (Postgres) │  │  (Cache) │  │ (Queue) │
           └─────────────┘  └──────────┘  └─────────┘
```

---

### Implementation Roadmap

#### Phase 1: Multi-Tenant Database (Week 1-2)

- [ ] Add `tenant_id` column to all tables
- [ ] Implement Row-Level Security (RLS) policies
- [ ] Create tenant provisioning API
- [ ] Migrate existing data to tenant_id=1

#### Phase 2: Bot Worker Orchestration (Week 3-4)

- [ ] Create ECS task definition with tenant_id env var
- [ ] Build orchestrator service to spawn/manage bots
- [ ] Implement per-tenant config loading
- [ ] Add tenant isolation for API keys

#### Phase 3: Admin Dashboard Multi-Tenant (Week 5-6)

- [ ] Add tenant selector to admin UI
- [ ] Implement tenant-scoped views
- [ ] Build tenant onboarding flow
- [ ] Add billing integration (Stripe)

#### Phase 4: Monitoring & Scaling (Week 7-8)

- [ ] Per-tenant metrics dashboards
- [ ] Auto-scaling based on active users
- [ ] Cost allocation tags
- [ ] SLA monitoring

---

## 🛠️ Immediate Action Items

### Today

1. ✅ Fixed `scan_interval_sec` bug in NewsArbitrageStrategy
2. 🔧 Run `add_executed_at_column.sql` in Supabase SQL Editor
3. 🔧 Deploy updated bot with fix

### This Week

1. Review and fix crypto_15min_scalping empty error logging
2. Add better error context to all strategies
3. Consider implementing circuit breakers for failed strategies

### Next Sprint

1. Begin Phase 1 of multi-tenant migration
2. Design tenant_id schema changes
3. Create RLS policies

---

## 📝 SQL to Run in Supabase

```sql
-- 1. Add executed_at column
ALTER TABLE polybot_opportunities 
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create index for executed_at
CREATE INDEX IF NOT EXISTS idx_polybot_opportunities_executed_at 
ON polybot_opportunities(executed_at) 
WHERE executed_at IS NOT NULL;
```

---

*Generated: December 22, 2025*
