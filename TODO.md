# PolyBot To-Do List

## Active Tasks (December 6, 2025)

### 🔴 HIGH PRIORITY - Current Issues

#### Bot/Backend

- [x] **Stock/Crypto Data Flow** - Testing if stock strategies work after v33 fix
  - Fixed parameter mismatch (`entry_z_threshold` → `entry_threshold`)
  - v33 deployed and running successfully
  - Need to verify stock strategies initialize when market opens (Mon-Fri 9:30am-4pm ET)

- [x] **Binance.US Blocked** - Returns 451 "Service unavailable from restricted location"
  - AWS Lightsail in us-east-1 is geoblocked by Binance.US
  - User prefers Coinbase - enabled in settings, Bybit/Binance disabled

- [x] **Run Trading Mode Migration** - SQL columns added for paper/live tracking
  - User ran `scripts/add_trading_mode_columns.sql` in Supabase SQL Editor
  - User ran `scripts/fix_exchange_columns.sql` in Supabase SQL Editor
  - Added `trading_mode`, `strategy_type`, `platform`, `session_id` columns
  - Created `polybot_strategy_performance` view for analytics

- [x] **Market Maker Tight Loop** - Fixed
  - Was returning early when no markets found, causing rapid restarts
  - Added 5-minute delay when no suitable markets

#### Admin UI

- [x] **Settings Persistence Fixed** - Exchange toggles now save correctly
  - Added error handling with visible error/success messages
  - Fixed race condition where refetch would overwrite during save
  - Fixed Bybit toggle (was stuck at true in database)
  - Added console logging for debugging save issues

- [x] **P&L Calculation Fixed** - Now computes from actual trades instead of stale stats_json
  - Added Gross Profit display
  - Shows "Fees + Slippage" (difference between expected and actual)
  - Worst trade shows correct negative value

- [x] **Open Positions Page** - Confirmed working correctly
  - Simulation trades resolve instantly (no "pending" state)
  - Page shows "No open positions" when empty (correct behavior)

### 🟡 MEDIUM PRIORITY - Feature Requests

#### Strategy Analytics & Filtering

- [x] Database schema for strategy filtering (user ran SQL migration)
- [x] Per-strategy P&L breakdown in dashboard (StrategyBreakdown component added)
- [ ] Strategy success tracking with filterable analytics
- [ ] Collapsible strategy sections in dashboard
- [ ] Strategy performance comparison charts

#### User Management

- [ ] Fix User Admin section - should show list of users
- [ ] User role management (admin, viewer, trader)
- [ ] Activity log per user

#### Logging & Debugging

- [ ] Add Logs page for troubleshooting
  - Real-time log streaming from bot
  - Filter by log level (INFO, WARNING, ERROR)
  - Search/filter by strategy or component

#### UI Improvements

- [ ] Collapsible strategy sections on dashboard
- [ ] Better mobile responsiveness

### 🟢 LOW PRIORITY - Nice to Have

- [ ] Simulation session history viewer
- [ ] AI analysis of completed sessions
- [ ] Export session data to CSV
- [ ] Discord webhook integration
- [ ] Email alerts for significant events

---

## ✅ Completed Tasks

### December 6, 2025 (Latest)

- [x] Fixed single-platform opportunity logging (was missing buy_platform field)
- [x] Added database logging for admin UI logs page
- [x] Added per-strategy P&L breakdown to dashboard (StrategyBreakdown component)
- [x] Added useStrategyPerformance hook with fallback computation
- [x] Fixed market maker tight loop issue (was restarting every few seconds)
- [x] Disabled unnecessary strategies in database
- [x] Fixed settings persistence bug (Bybit toggle)
- [x] Fixed `max_position_size` AttributeError
- [x] Fixed strategy parameter mismatches in `bot_runner.py`
- [x] Fixed P&L modal to compute from actual trades
- [x] Added `secret.test`, `simulation.analyze`, `simulation.archive` to AuditAction types
- [x] v39 deployed to Lightsail with all fixes

### December 5, 2025

- [x] Migrated from ECS ($54/day) to Lightsail ($0.17/day)
- [x] Service role key working (17 secrets loading)
- [x] Binance.US mapping in CCXT client

### Earlier

- [x] Stock trading strategies (Mean Reversion, Momentum)
- [x] Balance aggregator integration
- [x] Notifications page
- [x] Positions page
- [x] Balances page
- [x] Navigation updates
- [x] AWS cost analysis
- [x] Secrets page security enhancements

---

## Current Bot Status

- **Version**: v39 (Build #28, image polybot-b28.26)
- **Status**: RUNNING ✅
- **Strategies Active**: kalshi_single, polymarket_single, cross_platform
- **Disabled**: market_making, news_arb, funding_rate, grid, pairs
- **Exchanges**: Coinbase enabled, Bybit/Binance disabled
- **Mode**: PAPER/SIMULATION
- **Balance**: ~$1,927 (as of v39 deployment)

---

## Known Limitations

1. Stock strategies only run during market hours (9:30 AM - 4:00 PM ET Mon-Fri)
2. Crypto strategies need non-Binance.US exchange for US deployment
3. Simulation trades resolve instantly (no "pending" positions state)
