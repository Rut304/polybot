# PolyBot SaaS Product Analysis & Integration Plan (REVISED)

**Date**: 2025-12-16
**Status**: Revised Strategy (Next.js + Python)

---

## 1. Executive Summary
**Objective**: Transform the single-user **PolyBot** into a multi-user **SaaS Platform** (`MyPolyBot.io` or `PolyEdge.ai`).
**Strategy**: **Hybrid**.
1.  **Frontend**: Use the existing **Next.js Admin** (`polybot/admin`) as the customer-facing dashboard. It is far more advanced than the Streamlit prototype.
2.  **Backend**: The Python Bot (`polybot/src`) runs as the execution engine.
**Timeline**: **3 Weeks** (Slightly longer than Streamlit, but much higher quality).
**Cost**: **~$70/mo** (Lean) to **$400/mo** (Scale).

---

## 2. Market Opportunity
*   **The Niche**: "Prediction Market + Crypto Arbitrage" SaaS.
*   **Differentiation**: Professional-grade UI (Next.js) vs Competitors' clunky interfaces.
*   **Revenue Model**: Freemium / Pro ($29/mo) / Whale ($99/mo).

---

## 3. Architecture: The "Professional" Model

### A. The Dashboard (Next.js - `polybot/admin`)
*   **Status**: High quality. Contains specific components (PnL Charts, Trade Feeds) that would take weeks to rebuild in Streamlit.
*   **Action**:
    1.  **Rename** to `polybot-web`.
    2.  **Add Privy**: Install `@privy-io/react-auth` for non-custodial login.
    3.  **Add Stripe**: Integrate `@stripe/react-stripe-js` (already present) for subscriptions.

### B. The Engine (Python - `polybot/src`)
*   **Role**: Background Worker.
*   **Mechanism**:
    1.  Polls Supabase `polybot_config` table.
    2.  Executes trades for active users.
    3.  Writes logs to `polybot_trades` which Next.js reads in real-time.

---

## 4. Database Schema (Supabase)
(Same as previous plan - Supabase is the central hub).

```sql
-- KEY TABLE: User Bot Configurations
CREATE TABLE polybot_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id), -- Maps to Privy User ID
    strategy_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    config_json JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. Security & Wallets (Non-Custodial)
*   **Frontend**: User connects Privy Wallet.
*   **Delegation**: User signs a "Session Key" or provides API keys (encrypted) which the Python Worker uses.
*   **We never hold funds.**

---

## 6. Infrastructure
*   **Frontend**: Vercel (Free/Pro tier) - Best for Next.js.
*   **Backend**: AWS Lightsail / DigitalOcean ($40/mo) for the Python Worker.
*   **Database**: Supabase Pro ($25/mo).

---

## 7. Revised Timeline (The "Quality" Plan)

| Phase | Days | Task | Output |
| :--- | :--- | :--- | :--- |
| **1. Auth Upgrade** | Day 1-3 | Add Privy to Next.js App | Users can login with Wallet/Email |
| **2. Config UI** | Day 4-6 | Create "My Bot" Page in Next.js | Users can toggle logic & save to DB |
| **3. Bot Connection** | Day 7-9 | Make Python Bot read DB Configs | Bot executes based on Next.js settings |
| **4. Stripe** | Day 10-12 | Gate "Active" status behind Paywall | Subscription flow working |
| **5. Testing** | Day 13-15 | End-to-End Verification | Real money trade test |
| **6. Launch** | Day 16+ | Public Release | `MyPolyBot.io` live |

---

## 8. Agent Coordination (Handoff)
*   **Current State**: Strategy finalized (Next.js Path).
*   **Next Steps**:
    1.  `cd polybot/admin`
    2.  `npm install @privy-io/react-auth`
    3.  Configure Privy Provider in `layout.tsx`.
