# IBKR Web API Migration Guide

## Overview

This guide documents the migration from the **ib_insync + IB Gateway** approach to the **IBKR Web API (OAuth 2.0)** approach for IBKR integration.

### Why Migrate?

| Feature | IB Gateway (Old) | Web API (New) |
|---------|------------------|---------------|
| Container requirement | ❌ Requires sidecar container | ✅ No container needed |
| Multi-tenant | ❌ Single connection | ✅ Per-user OAuth sessions |
| Lightsail compatibility | ❌ Fails on micro tier | ✅ Works on any tier |
| Scalability | ❌ Limited | ✅ Unlimited users |
| Authentication | TWS login each restart | OAuth tokens (persistent) |

## Architecture

### Old Architecture (ib_insync)
```
┌─────────────────────────────────────────────────────┐
│              AWS Lightsail (Micro)                  │
│  ┌─────────────────┐   ┌─────────────────┐         │
│  │    polybot      │   │   ib-gateway    │ ← FAILS │
│  │   (main app)    │──▶│  (TWS headless) │         │
│  └─────────────────┘   └─────────────────┘         │
│                              │                      │
└──────────────────────────────│──────────────────────┘
                               ▼
                        Interactive Brokers
```

### New Architecture (Web API)
```
┌───────────────────────────────────────────────────────────┐
│                  AWS Lightsail (Micro)                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │                     polybot                         │  │
│  │  ┌──────────────┐    ┌────────────────────────┐   │  │
│  │  │ IBKRWebClient│───▶│ HTTPs to api.ibkr.com  │───┼──┼──▶ IBKR Cloud
│  │  └──────────────┘    └────────────────────────┘   │  │
│  │         │                                          │  │
│  │         ▼                                          │  │
│  │  ┌──────────────────────────────────────────┐     │  │
│  │  │              Supabase                    │     │  │
│  │  │  user_exchange_credentials (per-user)   │     │  │
│  │  │  - OAuth access_token (encrypted)       │     │  │
│  │  │  - refresh_token (encrypted)            │     │  │
│  │  │  - account_id per user                  │     │  │
│  │  └──────────────────────────────────────────┘     │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

## Files Changed

### New Files
- `src/exchanges/ibkr_web_client.py` - Web API client with OAuth
- `scripts/create_user_exchange_credentials.sql` - DB migration

### Modified Files  
- `src/exchanges/__init__.py` - Export IBKRWebClient
- `src/bot_runner.py` - (TODO) Use IBKRWebClient for multi-tenant

### Unchanged
- `src/exchanges/ibkr_client.py` - Keep for local development with TWS

## OAuth Setup (Per User)

### 1. IBKR Developer Portal
Users need to register an application at https://www.interactivebrokers.com/en/trading/web-api.php

Requirements:
- IBKR Pro account (not Lite)
- Web API subscription enabled
- Consumer Key obtained

### 2. OAuth Flow in Admin UI
1. User clicks "Connect IBKR" in admin settings
2. Redirect to IBKR OAuth authorization page
3. User approves access
4. Callback stores tokens in Supabase
5. Tokens auto-refresh

### 3. Token Storage
Tokens stored per user in `user_exchange_credentials`:
- `access_token` - Bearer token for API calls (encrypted)
- `refresh_token` - For refreshing expired tokens (encrypted)
- `token_expiry` - When token expires
- `account_id` - User's IBKR account (e.g., U1234567)

## Implementation Status

### ✅ Completed
- [x] IBKRWebClient class with multi-tenant support
- [x] Per-user session management (IBKRUserSession)
- [x] Token storage/retrieval from Supabase
- [x] Basic encryption (base64, TODO: upgrade to KMS)
- [x] Account operations (balances, positions)
- [x] Order operations (place, cancel, get orders)
- [x] Market data operations
- [x] Contract search
- [x] OAuth helper class (IBKROAuthHelper)
- [x] DB migration script

### 🔲 TODO
- [ ] Admin UI OAuth flow (Connect IBKR button)
- [ ] Update bot_runner.py to use IBKRWebClient
- [ ] Update strategies to work with new client
- [ ] WebSocket streaming for real-time data
- [ ] Production token encryption (AWS KMS)
- [ ] Token refresh implementation
- [ ] Rate limiting handling
- [ ] Error recovery

## API Endpoints Used

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Init session | `/iserver/auth/status` | POST |
| Keep alive | `/tickle` | GET |
| Accounts | `/iserver/accounts` | GET |
| Balances | `/portfolio/{accountId}/ledger` | GET |
| Positions | `/portfolio/{accountId}/positions/0` | GET |
| Orders | `/iserver/account/orders` | GET |
| Place order | `/iserver/account/{accountId}/orders` | POST |
| Cancel order | `/iserver/account/{accountId}/order/{orderId}` | DELETE |
| Market data | `/md/snapshot` | GET |
| Contract search | `/iserver/secdef/search` | POST |
| Contract info | `/iserver/contract/{conid}/info` | GET |

## Testing

### Local Development
For local testing, you can still use IB Gateway:
```python
# Use gateway mode for local dev
client = IBKRWebClient(use_gateway=True)  # Uses localhost:5000
```

### Production
```python
# Production uses OAuth
client = IBKRWebClient(user_id="user-uuid-here")
await client.initialize()  # Loads tokens from DB
```

## Migration Steps

### Database
```bash
# Run migration
psql $DATABASE_URL -f scripts/create_user_exchange_credentials.sql
```

### Bot Runner Update
Update `src/bot_runner.py`:
```python
# Old:
from src.exchanges.ibkr_client import IBKRClient
self.ibkr_client = IBKRClient(host='localhost', port=4002)

# New:
from src.exchanges.ibkr_web_client import IBKRWebClient
# Per-user client created when processing user's trades
```

### Strategy Update
Strategies need to accept user_id and create per-user clients:
```python
class IBKRStrategy:
    async def execute_for_user(self, user_id: str):
        client = IBKRWebClient(user_id=user_id)
        await client.initialize()
        # ... execute trades ...
```

## Rollback

If needed, the old `IBKRClient` (ib_insync) is still available:
```python
from src.exchanges.ibkr_client import IBKRClient
```

Just ensure IB Gateway container is running alongside polybot.

## Security Notes

1. **Token Encryption**: Currently using base64 (NOT SECURE for production)
   - TODO: Migrate to AWS KMS or Supabase Vault

2. **RLS Enabled**: Users can only access their own credentials

3. **OAuth Scopes**: Request minimum necessary permissions

4. **Token Rotation**: Implement refresh token rotation for security
