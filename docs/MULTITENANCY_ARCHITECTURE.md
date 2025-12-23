# PolyBot Multitenancy Architecture

## Overview

This document outlines the architectural approach for implementing multitenancy in PolyBot, enabling multiple independent users to run their own trading bots with isolated configurations, balances, and strategies.

## Current State

The system already has partial multitenancy support:

### Existing Infrastructure

1. **User Authentication**: Supabase Auth with `auth.users` table
2. **User ID References**: Most tables have `user_id` foreign key
3. **RLS Policies**: Row-Level Security on most tables
4. **Database Class**: Accepts `user_id` parameter for filtering
5. **Bot Manager**: `src/manager.py` exists for orchestrating multiple instances

### Gaps to Address

1. Bot runner doesn't dynamically load per-user config
2. Secrets management is global, not per-user
3. API keys (Polymarket, Kalshi, Alpaca, IBKR) need per-user storage
4. Billing/subscription tracking doesn't exist
5. Resource isolation (CPU/memory) per tenant

## Architecture Tiers

### Tier 1: Soft Multitenancy (Current Phase)

- Single bot process serves all users
- User isolation via database row-level security
- Shared API rate limits
- Manual key management per user

### Tier 2: Process Multitenancy (Target)

- One bot process per active user
- Bot Manager orchestrates multiple PolybotRunner instances
- Per-user config and secrets loaded at startup
- Process restart on config change

### Tier 3: Container Multitenancy (Future)

- One container per user
- Full resource isolation
- Kubernetes/ECS orchestration
- Automatic scaling

## Database Schema Changes

### 1. User Profile Table (Enhanced)

```sql
CREATE TABLE IF NOT EXISTS polybot_user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    
    -- Subscription/Billing
    subscription_tier TEXT DEFAULT 'free', -- 'free', 'basic', 'pro', 'enterprise'
    subscription_expires_at TIMESTAMPTZ,
    monthly_trade_limit INT DEFAULT 100,
    trades_this_month INT DEFAULT 0,
    
    -- Trading Limits
    max_trade_size_usd DECIMAL(10, 2) DEFAULT 50.00,
    max_daily_loss_usd DECIMAL(10, 2) DEFAULT 100.00,
    max_positions INT DEFAULT 5,
    
    -- Feature Flags
    features_enabled JSONB DEFAULT '{
        "copy_trading": false,
        "news_arbitrage": true,
        "cross_platform": false,
        "single_platform": true,
        "overlapping_arb": false
    }'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    
    -- Onboarding
    onboarding_completed BOOLEAN DEFAULT FALSE,
    accepted_terms_at TIMESTAMPTZ
);
```

### 2. Per-User Secrets Table

```sql
CREATE TABLE IF NOT EXISTS polybot_user_secrets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'polymarket', 'kalshi', 'alpaca', 'ibkr'
    
    -- Encrypted key storage
    -- In production, use Supabase Vault or AWS Secrets Manager
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    private_key_encrypted TEXT,
    additional_config JSONB,
    
    -- Key metadata
    is_paper BOOLEAN DEFAULT TRUE,  -- Paper/sandbox vs live keys
    is_active BOOLEAN DEFAULT TRUE,
    last_validated_at TIMESTAMPTZ,
    validation_status TEXT DEFAULT 'pending', -- 'valid', 'invalid', 'expired'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, platform, is_paper)
);

-- RLS Policy
ALTER TABLE polybot_user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own secrets"
    ON polybot_user_secrets
    FOR ALL
    USING (auth.uid() = user_id);
```

### 3. Per-User Config Table

```sql
CREATE TABLE IF NOT EXISTS polybot_user_config (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Trading Config
    dry_run BOOLEAN DEFAULT TRUE,
    min_profit_pct DECIMAL(8, 4) DEFAULT 1.0,
    max_trade_size_usd DECIMAL(10, 2) DEFAULT 50.00,
    max_daily_loss_usd DECIMAL(10, 2) DEFAULT 100.00,
    
    -- Strategy Toggles
    enable_copy_trading BOOLEAN DEFAULT FALSE,
    enable_single_platform_arb BOOLEAN DEFAULT TRUE,
    enable_cross_platform_arb BOOLEAN DEFAULT FALSE,
    enable_overlapping_arb BOOLEAN DEFAULT FALSE,
    enable_news_arbitrage BOOLEAN DEFAULT TRUE,
    
    -- Platform Toggles
    enable_polymarket BOOLEAN DEFAULT TRUE,
    enable_kalshi BOOLEAN DEFAULT TRUE,
    enable_alpaca BOOLEAN DEFAULT FALSE,
    enable_ibkr BOOLEAN DEFAULT FALSE,
    
    -- Notification Prefs
    notify_on_trade BOOLEAN DEFAULT TRUE,
    notify_on_opportunity BOOLEAN DEFAULT FALSE,
    notify_daily_summary BOOLEAN DEFAULT TRUE,
    notification_channels JSONB DEFAULT '["email"]'::jsonb,
    
    -- Advanced Config (JSON for flexibility)
    advanced_config JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Code Changes

### 1. Enhanced Bot Runner

```python
# src/bot_runner.py - Multitenancy-aware initialization

class PolybotRunner:
    def __init__(
        self,
        user_id: Optional[str] = None,  # Required for multitenancy
        # ... other params
    ):
        self.user_id = user_id
        
        # Database with user context
        self.db = Database(user_id=user_id)
        
        # Load user-specific config
        if user_id:
            self._load_user_config()
            self._load_user_secrets()
            self._validate_subscription()
        
    def _load_user_config(self):
        """Load configuration specific to this user."""
        config = self.db.get_user_config()
        if config:
            self.config.trading.dry_run = config.get('dry_run', True)
            self.config.trading.max_trade_size = config.get('max_trade_size_usd', 50)
            # ... more config
    
    def _load_user_secrets(self):
        """Load API keys for this user."""
        secrets = self.db.get_user_secrets()
        
        # Polymarket
        poly_secrets = secrets.get('polymarket', {})
        self.wallet_address = poly_secrets.get('wallet_address')
        self.private_key = poly_secrets.get('private_key')
        
        # Kalshi
        kalshi_secrets = secrets.get('kalshi', {})
        self.kalshi_api_key = kalshi_secrets.get('api_key')
        self.kalshi_private_key = kalshi_secrets.get('private_key')
        
    def _validate_subscription(self):
        """Check user's subscription allows trading."""
        profile = self.db.get_user_profile()
        
        if not profile:
            raise ValueError("User profile not found")
        
        tier = profile.get('subscription_tier', 'free')
        trades_this_month = profile.get('trades_this_month', 0)
        limit = profile.get('monthly_trade_limit', 100)
        
        if tier == 'free' and trades_this_month >= limit:
            raise ValueError(f"Monthly trade limit ({limit}) reached")
```

### 2. Enhanced Bot Manager

```python
# src/manager.py - Orchestrate multiple user bots

class BotManager:
    """Manage multiple PolybotRunner instances for different users."""
    
    def __init__(self):
        self.db = Database()  # Admin-level access
        self.runners: Dict[str, PolybotRunner] = {}
        self.tasks: Dict[str, asyncio.Task] = {}
        
    async def start(self):
        """Start bots for all active users."""
        active_users = self.db.get_active_users()
        
        for user in active_users:
            await self.start_user_bot(user['id'])
    
    async def start_user_bot(self, user_id: str):
        """Start a bot for a specific user."""
        if user_id in self.runners:
            logger.warning(f"Bot already running for user {user_id}")
            return
        
        try:
            runner = PolybotRunner(user_id=user_id)
            self.runners[user_id] = runner
            self.tasks[user_id] = asyncio.create_task(
                runner.run(),
                name=f"bot_{user_id[:8]}"
            )
            logger.info(f"Started bot for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to start bot for {user_id}: {e}")
    
    async def stop_user_bot(self, user_id: str):
        """Stop a specific user's bot."""
        if user_id not in self.runners:
            return
        
        await self.runners[user_id].shutdown()
        self.tasks[user_id].cancel()
        del self.runners[user_id]
        del self.tasks[user_id]
        logger.info(f"Stopped bot for user {user_id}")
    
    async def reload_user_config(self, user_id: str):
        """Reload config for a user (restart their bot)."""
        await self.stop_user_bot(user_id)
        await asyncio.sleep(1)
        await self.start_user_bot(user_id)
```

### 3. Database Enhancements

```python
# src/database/client.py - User-aware methods

class Database:
    def get_user_config(self) -> Optional[Dict]:
        """Get config for current user."""
        if not self._client or not self.user_id:
            return None
        
        result = self._client.table('polybot_user_config').select(
            '*'
        ).eq('user_id', self.user_id).single().execute()
        
        return result.data
    
    def get_user_secrets(self) -> Dict[str, Dict]:
        """Get decrypted secrets for current user."""
        if not self._client or not self.user_id:
            return {}
        
        result = self._client.table('polybot_user_secrets').select(
            'platform, api_key_encrypted, api_secret_encrypted, '
            'private_key_encrypted, additional_config, is_paper'
        ).eq('user_id', self.user_id).eq('is_active', True).execute()
        
        secrets = {}
        for row in result.data:
            # TODO: Decrypt keys using Supabase Vault or AWS KMS
            secrets[row['platform']] = {
                'api_key': self._decrypt(row.get('api_key_encrypted')),
                'api_secret': self._decrypt(row.get('api_secret_encrypted')),
                'private_key': self._decrypt(row.get('private_key_encrypted')),
                'is_paper': row.get('is_paper', True),
                **row.get('additional_config', {}),
            }
        return secrets
    
    def get_user_profile(self) -> Optional[Dict]:
        """Get profile for current user."""
        if not self._client or not self.user_id:
            return None
        
        result = self._client.table('polybot_user_profiles').select(
            '*'
        ).eq('id', self.user_id).single().execute()
        
        return result.data
    
    def increment_trade_count(self) -> bool:
        """Increment monthly trade count for billing."""
        if not self._client or not self.user_id:
            return False
        
        self._client.rpc('increment_user_trades', {
            'p_user_id': self.user_id
        }).execute()
        return True
```

## API Endpoints

### User Config API

```typescript
// admin/src/app/api/user/config/route.ts

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  
  const { data } = await supabase
    .from('polybot_user_config')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  return Response.json(data);
}

export async function PUT(request: Request) {
  const user = await getAuthUser(request);
  const updates = await request.json();
  
  await supabase
    .from('polybot_user_config')
    .upsert({ 
      user_id: user.id, 
      ...updates,
      updated_at: new Date().toISOString()
    });
  
  // Trigger bot reload
  await fetch(`${BOT_API}/reload/${user.id}`, { method: 'POST' });
  
  return Response.json({ success: true });
}
```

### User Secrets API

```typescript
// admin/src/app/api/user/secrets/route.ts

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  const { platform, api_key, api_secret, private_key, is_paper } = await request.json();
  
  // Encrypt before storing
  const encrypted_api_key = await encryptWithVault(api_key);
  const encrypted_secret = await encryptWithVault(api_secret);
  const encrypted_private = await encryptWithVault(private_key);
  
  await supabase
    .from('polybot_user_secrets')
    .upsert({
      user_id: user.id,
      platform,
      api_key_encrypted: encrypted_api_key,
      api_secret_encrypted: encrypted_secret,
      private_key_encrypted: encrypted_private,
      is_paper,
    }, { onConflict: 'user_id,platform,is_paper' });
  
  return Response.json({ success: true });
}
```

## UI Changes

### 1. User Onboarding Flow

- Welcome screen with terms acceptance
- Platform connection wizard (Polymarket → Kalshi → Optional brokers)
- Initial config setup (risk tolerance, strategies)
- Subscription selection

### 2. API Keys Management Page

- Per-platform key entry forms
- Key validation status indicators
- Paper vs Live mode toggle per platform
- Key rotation support

### 3. Subscription/Billing Page

- Current plan display
- Usage metrics (trades this month, etc.)
- Upgrade/downgrade options
- Payment history

## Security Considerations

### Key Storage

1. **Option A: Supabase Vault** (Recommended)
   - Built into Supabase
   - Server-side encryption
   - Access controlled via RLS

2. **Option B: AWS Secrets Manager**
   - Industry standard
   - Automatic rotation
   - Cross-region replication

3. **Option C: Client-side Encryption**
   - Keys encrypted with user password
   - User must enter password to trade
   - Zero-knowledge approach

### Access Control

- All tables use RLS with `auth.uid() = user_id`
- Service role bypasses RLS for admin operations
- Audit logging for sensitive operations

## Rollout Plan

### Phase 1: Foundation (Week 1)

- [ ] Create database migrations
- [ ] Add user_config and user_secrets tables
- [ ] Update Database class with new methods

### Phase 2: Bot Changes (Week 2)

- [ ] Modify PolybotRunner to load per-user config
- [ ] Enhance BotManager for multi-user orchestration
- [ ] Add subscription validation

### Phase 3: UI (Week 3)

- [ ] API keys management page
- [ ] User config page
- [ ] Onboarding flow

### Phase 4: Testing (Week 4)

- [ ] Multi-user simulation testing
- [ ] Key rotation testing
- [ ] Subscription limit enforcement

### Phase 5: Production (Week 5)

- [ ] Gradual rollout to beta users
- [ ] Monitoring and alerting
- [ ] Documentation

## Monitoring

### Per-User Metrics

- Trades executed
- P&L by strategy
- API rate limit usage
- Error rates

### System Metrics  

- Active user count
- Total bot processes
- Resource utilization per user
- Database connection pool

## Future Enhancements

1. **White-label Support**: Custom branding per tenant
2. **API Access**: REST API for programmatic trading
3. **Webhook Integration**: Trade notifications to external systems
4. **Team Accounts**: Multiple users sharing one config
5. **Audit Trail**: Complete history of config changes
