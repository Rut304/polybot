# PolyBot - Comprehensive Status & Action Items

**Generated**: December 29, 2025

---

## 1️⃣ Data Encryption at Rest

### Current State
- ✅ Columns added to `polybot_secrets`: `encrypted`, `encryption_version`
- ❌ Encryption logic NOT yet implemented
- API keys stored in plaintext in Supabase

### Recommendation
**Priority**: P1 (Important but not blocking)

**Why it's lower priority than expected:**
- Supabase RLS provides user isolation
- Supabase encrypts data at rest by default
- Only service_role can read secrets (not anon key)
- Attack surface is limited to database admin compromise

**If you want full encryption:**
1. Use `crypto-js` or `node-forge` in API routes
2. AES-256-GCM with per-user encryption keys
3. Master key stored in environment variable
4. Decrypt only at runtime when needed

### Implementation Estimate
- **Effort**: 8-16 hours
- **Risk**: Medium (could break existing integrations)
- **Suggestion**: Document current security posture instead, implement encryption in Q1 2025

---

## 2️⃣ Strategy Status Consistency Across Pages

### Investigation Results
After reviewing the codebase, strategy enable status comes from:

| Source | Used By | Type |
|--------|---------|------|
| `polybot_config` table | `/strategies`, `/settings` | Database |
| `useBotConfig()` hook | All pages loading config | Shared state |
| `localStorage` | Some UI toggles | Local |

### Potential Issue
- Settings page and Strategies page both write to `polybot_config`
- Both use `useBotConfig()` hook - should be in sync
- Dashboard filter uses `localStorage` (separate from config)

### No Bug Found
Both `/strategies` and `/settings` read/write to the same `polybot_config` record via `useBotConfig()`. They should always be consistent.

**If you're seeing inconsistency:**
1. Hard refresh (Cmd+Shift+R) to clear cache
2. Check browser console for errors
3. Verify you're logged into same account on all pages

---

## 3️⃣ RLS Documentation

### Current RLS State
✅ **RLS is enabled** on all sensitive tables (per `scripts/security_fix_critical.sql`)

| Table | RLS Enabled | Policy |
|-------|-------------|--------|
| `polybot_simulated_trades` | ✅ | User sees own trades |
| `polybot_config` | ✅ | User sees own config |
| `polybot_balances` | ✅ | User sees own balances |
| `polybot_secrets` | ✅ | Service role only |
| `user_exchange_credentials` | ✅ | User sees own keys |
| `polybot_user_profiles` | ✅ | User sees own profile |

### Documentation Location
- `docs/SECURITY_AUDIT.md` - Full security audit
- `scripts/security_fix_critical.sql` - RLS setup script

### Suggested Addition
Create user-facing security page at `/security` explaining:
- Data isolation (RLS)
- API key storage (encrypted in transit, RLS protected)
- Two-factor authentication availability
- Compliance notes

---

## 4️⃣ Page Analysis & Recommendations

**Full analysis created**: `/docs/PAGE_ANALYSIS.md`

### Summary

| Category | Count | Recommendation |
|----------|-------|----------------|
| **KEEP as-is** | 20 | Core functionality |
| **MERGE** | 10 pairs | Reduce overlap |
| **REMOVE** | 4 | Low/no value |

### Quick Wins (Remove Now)
1. `/workflows` - Not implemented, empty shell
2. `/marketplace` - No content
3. `/news` - Generic, low value
4. `/business` - Internal only → move to admin

### High-Impact Merges
1. **Bets + History → `/trades`** - Unified trade view
2. **Analytics → Dashboard tab** - Reduce navigation
3. **Whales + Leaderboard → one page** - Same concept
4. **Help + Docs → Help Center** - Better UX

### After Consolidation
- **Before**: 42 pages, 25+ nav items
- **After**: ~28 pages, 14 nav items
- **Improvement**: 33% fewer pages, 44% simpler navigation

---

## 5️⃣ Full TODO Status

### ✅ COMPLETED (Not in original TODO but done this session)
- [x] Heartbeat table + Python bot writes heartbeat
- [x] Auto-test exchange connections on secrets page load
- [x] Admin redeploy button + API endpoint
- [x] User role dropdown includes "user" option
- [x] Page analysis document created
- [x] Vercel redeployed successfully

### ⚠️ REMAINING P0 (Must Do)
| Item | Status | Action |
|------|--------|--------|
| Bot Auto-Restart | ❌ | Lightsail handles this via Docker health check |
| Encrypt Secrets at Rest | ❌ | Optional - RLS provides isolation |
| Test IBKR Integration | ❌ | Needs IBKR paper account |

### ⚠️ REMAINING P1 (Should Do)
| Item | Status | Notes |
|------|--------|-------|
| Update `/docs` page with strategies | ❌ | Documentation |
| Wire Spike Hunter to all pages | ❌ | Analytics, Dashboard, History |
| Enhanced Diagnostics Page | ❌ | Admin improvements |
| AI Root Cause Analysis | ❌ | Gemini integration |

### ⏳ P2 (Nice to Have)
| Item | Notes |
|------|-------|
| Copy Trading | Follow successful traders |
| API for Developers | Public API |
| Webhooks | External integrations |
| Mobile App | Native iOS/Android |
| TradingView webhooks | Trade signals |
| Discord webhook | Notifications |

### 🎯 NOT IN TODO - Should Add
| Item | Priority | Notes |
|------|----------|-------|
| Page consolidation | P1 | Per analysis above |
| User onboarding analytics | P2 | Track drop-off |
| Stripe webhook monitoring | P1 | Payment failures |
| Rate limiting audit | P1 | Check all API routes |
| E2E test coverage expansion | P2 | Currently 80 tests |

---

## Immediate Next Steps

### Today
1. ✅ Vercel deployed
2. ⬜ Create Vercel Deploy Hook for admin redeploy button
   - Go to: https://vercel.com/rut304s-projects/admin/settings/git
   - Create deploy hook
   - Add `VERCEL_DEPLOY_HOOK_URL` to Vercel env vars

### This Week
1. Remove `/workflows`, `/marketplace`, `/news` pages
2. Move `/business` to admin-only route
3. Merge Whales + Leaderboard
4. Add `/security` page with data handling documentation

### Next Week
1. Start page consolidation (Bets + History)
2. Add AI Insights widget to Dashboard
3. Update strategy documentation

---

## Container Auto-Restart Answer

**Q**: Can the container auto-restart if my laptop where the images are created is not on?

**A**: **YES!** ✅

Your bot runs on **AWS Lightsail**, which is independent of your laptop:
- Lightsail containers have `restartPolicy: Always`
- Docker HEALTHCHECK triggers restart on failures
- Your laptop only needed to BUILD and PUSH the image
- Once deployed, Lightsail runs it 24/7

The only time you need your laptop:
- To push new code changes
- To manually redeploy from admin dashboard (now with button!)
