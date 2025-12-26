# PolyBot SaaS Productization Plan

## Executive Summary

Transform PolyBot from a single-user trading bot into a multi-tenant SaaS platform where users can:

- Sign up via Privy (passwordless auth + embedded wallets)
- Subscribe via Stripe (tiered pricing)
- Trade in simulation or live mode with a UI toggle
- Connect their own exchange accounts securely

---

## Current Implementation Status

### ✅ ALREADY IMPLEMENTED (60% Complete)

#### Database Schema (Multitenancy)

Located in `scripts/multitenancy_migration.sql`:

- `polybot_user_profiles` - User profiles with subscription tiers
- `polybot_user_secrets` - Per-user encrypted API keys (Polymarket, Kalshi, Alpaca, IBKR)
- `polybot_user_config` - Per-user trading settings
- `polybot_status.user_id` - Bot status per user
- RLS policies filtering by `auth.uid()`

#### Bot Infrastructure

- `src/main.py` - Supports `--user-id` flag for per-user execution
- `src/manager.py` - Multi-tenant orchestrator spawning bots per user
- `src/bot_runner.py` - Takes `user_id` parameter
- `src/database/client.py`:
  - `get_user_config()` - Fetches user-specific config
  - `get_user_secrets()` - Fetches user-specific API keys
  - `increment_trade_count()` - For billing/limits

#### Admin Dashboard (Next.js)

- **Auth**: `AuthProvider.tsx` with Supabase auth (email/password)
- **Subscription UI**: `SubscriptionStatus.tsx`, `PricingTable.tsx`
- **Stripe Integration**:
  - `/api/stripe/checkout/route.ts` - Creates checkout sessions
  - `/api/stripe/webhook/route.ts` - Handles subscription events
  - `/api/stripe/portal/route.ts` - Billing portal access
- **Feature Gating**: `adminOnly` flag on nav items (but not tier-based)

### 🚧 GAPS TO ADDRESS

1. **Auth**: Using Supabase email/password, NOT Privy
2. **Tier Enforcement**: No runtime checks on feature access
3. **Simulation Toggle**: No UI toggle for sim vs live trading
4. **User Onboarding**: No API key connection wizard
5. **Billing**: Placeholder Stripe price IDs ($99/$499 pricing shown)

---

## Poly-Parlay Reference Implementation

From `Rut304/poly-parlay`, we have proven implementations:

### Privy Auth (`privy_auth.py`)

```python
# Email OTP, SMS 2FA, Passkeys
send_email_otp(email)
verify_otp(otp_code)
# Embedded non-custodial wallets
get_user_wallet() -> {"address": ..., "chain": "polygon"}
request_transaction_signature(tx_params) -> signed_tx
```

### Stripe Billing (`webhook_handler.py`)

- Tiers: Starter $4.99, Pro $9.99, Elite $19.99
- 14-day free trials
- Webhook handling for subscription lifecycle

---

## Tiered Feature Matrix (Recommended)

| Feature | Free | Pro ($19.99/mo) | Elite ($49.99/mo) |
|---------|------|-----------------|-------------------|
| Dashboard | ✅ Basic | ✅ Full | ✅ Full |
| Simulation Trading | ✅ | ✅ | ✅ |
| Live Trading | ❌ | ✅ | ✅ |
| Strategies | Basic 3 | All 10+ | All + Custom |
| Markets | ✅ View | ✅ Trade | ✅ Priority |
| Whale Tracker | ❌ | ❌ | ✅ |
| Tax Center | ❌ | ✅ | ✅ |
| Missed Money Analyzer | ❌ | ✅ | ✅ |
| Congress Tracker | ❌ | ❌ | ✅ |
| AI Superforecasting | ❌ | ✅ | ✅ Unlimited |
| API Access | ❌ | ❌ | ✅ |
| Monthly Trades | 100 | 1,000 | Unlimited |
| Support | Community | Email | Priority |

### Hidden Features (Free → Pro Upgrade)

1. **Tax Center** (`/taxes`) - Currently `adminOnly`, should be `proOnly`
2. **Missed Money** (`/missed-opportunities`) - Shows upgrade CTA
3. **Whale Tracker** (`/whales`) - Elite only
4. **Congress Tracker** (`/congress`) - Elite only

---

## Implementation Phases

### Phase 1: Auth Migration (Week 1)

**Goal**: Replace Supabase auth with Privy

#### Tasks

1. **Install Privy SDK**

   ```bash
   cd admin && npm install @privy-io/react-auth @privy-io/server-auth
   ```

2. **Create Privy Provider** (`admin/src/components/PrivyProvider.tsx`)
   - Wrap app in `<PrivyProvider>`
   - Configure login methods: email OTP, SMS, passkeys
   - Enable embedded wallets for Polygon

3. **Update AuthProvider**
   - On Privy login → upsert Supabase `polybot_profiles`
   - Store `privy_user_id` for reference
   - Map Privy user to Supabase UUID

4. **API Key Connection Wizard**
   - New page: `/settings/connect-accounts`
   - Form to input Polymarket, Kalshi, Alpaca keys
   - Validate keys before saving
   - Encrypt and store in `polybot_user_secrets`

### Phase 2: Subscription & Billing (Week 2)

**Goal**: Enforce tier-based access

#### Tasks

1. **Create Stripe Products/Prices**
   - Free tier: No Stripe product (default)
   - Pro: `price_pro_monthly` ($19.99)
   - Elite: `price_elite_monthly` ($49.99)

2. **Update PricingTable.tsx**
   - Replace placeholder price IDs
   - Add trial period (14 days)
   - Show current plan indicator

3. **Create Tier Context Hook** (`admin/src/lib/useTier.ts`)

   ```typescript
   export function useTier() {
     const { user } = useAuth();
     const [tier, setTier] = useState<'free' | 'pro' | 'elite'>('free');
     // Fetch from polybot_profiles.subscription_tier
     return { tier, isPro: tier !== 'free', isElite: tier === 'elite' };
   }
   ```

4. **Feature Gating Components**
   - `<ProFeature>` wrapper - shows upgrade CTA for free users
   - `<EliteFeature>` wrapper
   - Update Navigation.tsx to use tier checks instead of `adminOnly`

5. **Monthly Trade Limit Enforcement**
   - Add `monthly_trades_used` counter in DB
   - Reset counter on billing cycle
   - Show warning at 80%, block at 100%

### Phase 3: Simulation/Live Toggle (Week 3)

**Goal**: Single-click mode switching

#### Tasks

1. **Add Mode Toggle to Header**
   - Location: `admin/src/components/Header.tsx`
   - Toggle switch: "Simulation" ↔ "Live"
   - Confirmation modal for switching to live
   - Store in user config

2. **Update Bot Runner**
   - `src/bot_runner.py` reads `is_simulation` from user config
   - Switches between paper trader and real execution
   - API: `/api/bot/mode` to toggle mode

3. **Visual Indicators**
   - Different color scheme for simulation (green) vs live (red border)
   - Clear badge showing current mode
   - Trade history shows mode filter

4. **Safety Guards for Live Trading**
   - Require Pro+ subscription
   - Require at least 1 connected exchange account
   - Require email verification
   - Optional: 2FA enforcement for live mode

### Phase 4: User Onboarding (Week 4)

**Goal**: Smooth first-time experience

#### Tasks

1. **Onboarding Wizard**
   - Step 1: Account created (Privy)
   - Step 2: Choose trading mode (sim recommended)
   - Step 3: Connect accounts (optional, skip for sim)
   - Step 4: Select strategies
   - Step 5: Start bot

2. **Demo Mode**
   - Pre-populated with sample data
   - No account connection required
   - Shows platform capabilities

3. **Help & Documentation**
   - Inline tooltips
   - Video tutorials (embed YouTube)
   - Strategy explainers

### Phase 5: Polish & Launch (Week 5)

**Goal**: Production readiness

#### Tasks

1. **Error Handling**
   - API key validation errors
   - Insufficient funds warnings
   - Network/exchange errors

2. **Monitoring**
   - User activity tracking
   - Error alerting (Sentry)
   - Usage analytics

3. **Legal**
   - Terms of Service
   - Privacy Policy
   - Risk disclaimers

---

## Code Changes Summary

### New Files to Create

```
admin/src/
├── components/
│   ├── PrivyProvider.tsx          # Privy auth wrapper
│   ├── TradingModeToggle.tsx      # Sim/Live switch
│   ├── FeatureGate.tsx            # Tier-based access control
│   └── OnboardingWizard.tsx       # New user flow
├── lib/
│   ├── privy.ts                   # Privy client config
│   └── useTier.ts                 # Subscription tier hook
├── app/
│   ├── settings/
│   │   └── connect-accounts/
│   │       └── page.tsx           # API key wizard
│   └── onboarding/
│       └── page.tsx               # First-time user flow
```

### Files to Modify

```
admin/src/
├── components/
│   ├── AuthProvider.tsx           # Integrate Privy
│   ├── Navigation.tsx             # Tier-based nav items
│   ├── Header.tsx                 # Add mode toggle
│   └── PricingTable.tsx           # Real Stripe price IDs
├── app/
│   ├── layout.tsx                 # Wrap with PrivyProvider
│   ├── taxes/page.tsx             # Add ProFeature gate
│   └── missed-opportunities/      # Add ProFeature gate
├── lib/
│   └── auth.ts                    # Privy integration

src/
├── bot_runner.py                  # Read is_simulation from user config
├── database/client.py             # Add get_trading_mode()
└── config.py                      # Per-user config loading
```

---

## Database Schema Updates

```sql
-- Add to polybot_profiles
ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS
  privy_user_id TEXT UNIQUE;

ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS
  monthly_trades_used INTEGER DEFAULT 0;

ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS
  monthly_trades_limit INTEGER DEFAULT 100;

ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS
  trial_ends_at TIMESTAMPTZ;

ALTER TABLE polybot_profiles ADD COLUMN IF NOT EXISTS
  onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add to polybot_user_config
ALTER TABLE polybot_user_config ADD COLUMN IF NOT EXISTS
  is_simulation BOOLEAN DEFAULT TRUE;

ALTER TABLE polybot_user_config ADD COLUMN IF NOT EXISTS
  enabled_strategies TEXT[] DEFAULT ARRAY['single_platform_arb'];

-- Monthly trade counter reset function
CREATE OR REPLACE FUNCTION reset_monthly_trades()
RETURNS void AS $$
BEGIN
  UPDATE polybot_profiles
  SET monthly_trades_used = 0
  WHERE subscription_status = 'active';
END;
$$ LANGUAGE plpgsql;
```

---

## Environment Variables (New)

```bash
# Privy
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-secret

# Stripe (update from placeholders)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Price IDs
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ELITE=price_xxx
```

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Auth | 5-7 days | Privy account setup |
| Phase 2: Billing | 5-7 days | Stripe products created |
| Phase 3: Sim/Live | 3-5 days | Phase 1 complete |
| Phase 4: Onboarding | 3-5 days | Phases 1-3 complete |
| Phase 5: Polish | 5-7 days | All phases complete |

**Total: 3-5 weeks** (depending on parallel work)

---

## Risk Mitigation

1. **API Key Security**
   - Use Supabase Vault for encryption
   - Never log or expose keys
   - Validate keys don't leak to frontend

2. **Financial Risk**
   - Default to simulation mode
   - Require explicit confirmation for live
   - Clear risk disclaimers

3. **Subscription Edge Cases**
   - Grace period for failed payments
   - Downgrade path preserves data
   - Trial expiry notifications

---

## Success Metrics

1. **User Acquisition**
   - Signups per week
   - Trial → Paid conversion rate

2. **Engagement**
   - Active bots running
   - Trades executed per user

3. **Revenue**
   - MRR (Monthly Recurring Revenue)
   - Churn rate
   - LTV (Lifetime Value)

---

## Next Steps

1. ✅ Review this plan
2. Set up Privy account and get app ID
3. Create Stripe products with real prices
4. Begin Phase 1 implementation
5. Schedule weekly check-ins to track progress

---

*Document created: Session summary of multitenancy audit and productization planning*
*Last updated: [Current Date]*
