# Multi-Tenancy Architecture

PolyParlay is designed as a multi-tenant SaaS where each user has their own:

- Bot configuration
- Exchange credentials  
- Trade history
- Positions and opportunities
- Strategy settings

## Quick Setup

### 1. Run Database Migration

```sql
-- Run this in Supabase SQL Editor
\i scripts/add_multi_tenant_columns.sql
```

### 2. Set Environment Variables

See `/docs/ENV_VARS_SETUP.md` for complete list.

## Database Schema

All user-specific tables include a `user_id` column that references `auth.users(id)`.

### Core Tables with Multi-Tenancy

| Table | Description | Multi-Tenant |
|-------|-------------|--------------|
| `polybot_config` | Bot configuration | ✅ `user_id` |
| `polybot_status` | Bot running status | ✅ `user_id` |
| `polybot_simulated_trades` | All trades | ✅ `user_id` |
| `polybot_opportunities` | Detected opportunities | ✅ `user_id` |
| `polybot_positions` | Open positions | ✅ `user_id` |
| `polybot_manual_trades` | Manual trades | ✅ `user_id` |
| `polybot_disabled_markets` | Markets to skip | ✅ `user_id` |
| `polybot_simulation_stats` | Stats snapshots | ✅ `user_id` |
| `polybot_tracked_traders` | Copy trading targets | ✅ `user_id` |
| `polybot_copy_signals` | Copy trading signals | ✅ `user_id` |
| `polybot_market_alerts` | Price/news alerts | ✅ `user_id` |
| `user_exchange_credentials` | User's API keys | ✅ `user_id` |
| `polybot_user_profiles` | User profiles | ✅ `id` (is user_id) |
| `polybot_key_vault` | Admin secrets | ❌ Admin only |
| `polybot_markets_cache` | Market data cache | ❌ Shared |
| `polybot_news_items` | News feed | ❌ Shared |

### Row Level Security (RLS)

All multi-tenant tables have RLS policies that:

1. Allow users to read/write only their own data (`auth.uid() = user_id`)
2. Allow service role full access (for bot operations)

## Frontend Hooks (Multi-Tenant)

All data-fetching hooks in `/admin/src/lib/hooks.ts` filter by user_id:

```typescript
// Example: Fetching trades
const { data: trades } = useSimulatedTrades(50, 'paper');
// Internally filters: .eq('user_id', user.id)
```

### Multi-Tenant Hooks

- `useBotStatus()` - User's bot status
- `useBotConfig()` - User's bot configuration
- `useSimulatedTrades()` - User's trades
- `useOpportunities()` - User's detected opportunities
- `usePositions()` - User's open positions
- `useManualTrades()` - User's manual trades
- `useDisabledMarkets()` - User's disabled markets
- `useRealTimeStats()` - User's stats
- `useStrategyPerformance()` - User's strategy performance
- `usePnLHistory()` - User's P&L history
- `useOpportunityStats()` - User's opportunity stats
- `useMissedMoney()` - User's missed opportunities
- `useAggregateStats()` - User's aggregate stats

### Shared Hooks (Not Multi-Tenant)

- `useMarketCache()` - Global market data cache
- `useBotVersion()` - Bot version info

## Exchange Credentials

Each user stores their own exchange API keys encrypted:

```sql
CREATE TABLE user_exchange_credentials (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    exchange TEXT NOT NULL, -- 'alpaca', 'coinbase', etc.
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT NOT NULL,
    -- ... additional fields
    UNIQUE(user_id, exchange)
);
```

### Exchange Clients

Exchange clients have factory methods for multi-tenant usage:

```python
# Python bot
from src.alpaca_client import AlpacaClient

# For admin/system operations (uses polybot_key_vault)
client = AlpacaClient()

# For user-specific operations (uses user_exchange_credentials)
client = AlpacaClient.for_user(user_id)
```

## Bot Runner (Multi-Tenant)

The bot runner operates per-user:

```python
class ArbitrageBotRunner:
    def __init__(self, user_id: Optional[str] = None):
        self.user_id = user_id
        
    async def _init_exchanges(self):
        if self.user_id:
            # Load user's credentials
            creds = await self.db.get_user_credentials(self.user_id)
            self.alpaca = AlpacaClient.for_user(self.user_id)
            # ...
```

## API Endpoints

All API endpoints that handle user data extract `user_id` from the session:

```typescript
// /api/user-credentials/route.ts
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user?.id;

// Query with user_id filter
const { data } = await supabase
  .from('user_exchange_credentials')
  .select('*')
  .eq('user_id', userId);
```

## Migration Script

To add multi-tenancy to an existing database:

```bash
# Run the migration
psql -f scripts/add_multi_tenant_columns.sql
```

This adds:

1. `user_id` columns to all relevant tables
2. Indexes on `user_id` columns
3. RLS policies for data isolation
4. User-filtered views for performance

## Security Considerations

1. **RLS is enabled** on all multi-tenant tables
2. **Service role** is used for bot operations (bypasses RLS)
3. **API keys are encrypted** in the database
4. **Users cannot see** other users' data
5. **Admin role** can access all data (for support)

## Testing Multi-Tenancy

```bash
# Create test users
npm run test:multi-tenant

# Verify data isolation
npm run test:isolation
```

## Common Issues

### "No data showing for new user"

- User needs to start their bot to generate data
- Run migration script to add user_id columns

### "User sees all data"

- RLS not enabled on table
- Migration script not run
- Using service role accidentally

### "Bot not recording trades"

- Bot not passing user_id when inserting
- Check bot runner configuration
