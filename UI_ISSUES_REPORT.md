# PolyBot UI Issues Report
**Generated: December 15, 2025**

## Critical Issues Found

### 1. ❌ Missing Database Tables (Pages Will Error)

| Table | Used By Page | Impact |
|-------|--------------|--------|
| `polybot_config_changes` | `/strategy-history` | Page shows empty or errors |
| `polybot_news_events` | `/news` | News page has no data |
| `polybot_markets_cache` | hooks.ts | Market data fetching fails |
| `polybot_notifications_settings` | `/notifications` | Settings don't save properly |
| `polybot_tax_events` | `/taxes` | Tax events not tracked |

### 2. ❌ Missing Database Columns

#### `polybot_config` table missing notification columns:
- `discord_webhook` - Notifications page can't save Discord webhook
- `telegram_bot_token` - Telegram settings won't work  
- `telegram_chat_id` - Telegram settings won't work
- `notifications_enabled` - Can't toggle notifications
- `notify_on_opportunity` - Setting won't persist
- `notify_on_trade` - Setting won't persist
- `notify_on_error` - Setting won't persist
- `notify_daily_summary` - Setting won't persist

#### `polybot_simulated_trades` table missing:
- `fees_paid` - Referenced by `/taxes` and previously `/business` pages

### 3. ⚠️ Empty Tables (Features Won't Work)

| Table | Rows | Impact |
|-------|------|--------|
| `polybot_balance_history` | 0 | No balance chart on `/balances` |
| `polybot_positions` | 0 | Positions page shows empty |
| `polybot_tracked_whales` | 0 | Whales page has no tracked whales |
| `polybot_whale_trades` | 0 | No whale trade history |
| `polybot_trades` (live) | 0 | Live trading mode shows no trades |
| `polybot_manual_trades` | 0 | Manual trades feature unused |

### 4. ⚠️ Code Issues

#### `/leaderboard/page.tsx` - Uses ANON_KEY directly
```tsx
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
```
This creates a new client instance instead of using the shared one. May fail if anon key is removed.

#### `/strategy-history/page.tsx` - Same issue
```tsx
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
```

#### `/taxes/page.tsx` - References non-existent `fees_paid` column
Lines 35, 152, 178, 256, 257, 292, 760 all reference `t.fees_paid` which doesn't exist.

#### `/notifications/page.tsx` - Wrong query pattern
The page tries to query `polybot_config` as a key-value store with `.select('key, value')` but our config table is a single-row table with columns, not a key-value store.

### 5. ⚠️ Strategy Implementation Status

| Strategy | Enabled in DB | Has Code | Has Trades | Notes |
|----------|--------------|----------|------------|-------|
| kalshi_single | ✅ | ✅ | ✅ 580 | Working |
| polymarket_single | ✅ | ✅ | ✅ 265 | Working |
| overlapping_arb | ❌ | ✅ | ✅ 22 | Has trades but disabled |
| btc_bracket_arb | ✅ | ✅ | ❌ 0 | **No markets available** |
| bracket_compression | ✅ | ✅ | ❌ 0 | No opportunities found |
| macro_board | ✅ | ✅ | ❌ 0 | No opportunities found |
| whale_copy_trading | ✅ | ✅ | ❌ 0 | No whales tracked |
| congressional_tracker | ❌ | ✅ | ❌ 0 | Disabled |
| grid_trading | ✅ | ✅ | ❌ 0 | Needs crypto exchange |
| pairs_trading | ✅ | ✅ | ❌ 0 | Needs crypto exchange |
| funding_rate_arb | ❌ | ✅ | ❌ 0 | Needs futures exchange |

### 6. 🔧 BTC Bracket Arbitrage - Market Availability

**Checked Dec 15, 2025:**
- Polymarket: 0 BTC bracket markets found
- Kalshi: 0 BTC markets found

This strategy requires specific "BTC will be between X and Y in 15 minutes" markets. These markets are not currently active on either platform. The strategy code is correct but there's nothing to trade.

---

## Fix Priority

### P0 - Critical (Breaking)
1. Fix `/taxes/page.tsx` - remove `fees_paid` references
2. Fix `/notifications/page.tsx` - use correct config table structure
3. Fix `/leaderboard/page.tsx` and `/strategy-history/page.tsx` - use shared supabase client

### P1 - High (Features Broken)
1. Create missing tables: `polybot_config_changes`, `polybot_markets_cache`
2. Add notification columns to `polybot_config`
3. Populate `polybot_balance_history` from bot

### P2 - Medium (Empty States)
1. Add UI handling for empty whale/position data
2. Show "No markets available" for BTC bracket strategy
3. Add proper loading states and empty state messages

### P3 - Low (Enhancements)
1. Add `fees_paid` column to simulated_trades (or calculate)
2. Create news events tracking table
3. Implement tax events tracking

---

## SQL to Create Missing Tables

```sql
-- Config Changes Table (for strategy-history page)
CREATE TABLE IF NOT EXISTS polybot_config_changes (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by TEXT,
    change_type TEXT,
    parameter_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT,
    session_label TEXT
);

-- Markets Cache Table
CREATE TABLE IF NOT EXISTS polybot_markets_cache (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    market_id TEXT NOT NULL,
    title TEXT,
    data JSONB,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, market_id)
);

-- Add notification columns to config
ALTER TABLE polybot_config 
ADD COLUMN IF NOT EXISTS discord_webhook TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notify_on_opportunity BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_on_trade BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_on_error BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_daily_summary BOOLEAN DEFAULT TRUE;
```
