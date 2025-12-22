
# Handoff to Next Agent (Project PolyBot/MyPolyBot)

> **🚨 CRITICAL BLOCKERS (P0 - FIX FIRST)**
> 1. **Settings Not Saving:** User confirms settings persist failure on Vercel app. *Suspected Cause:* Vercel deployment is stale and lacks the DB Schema fixes I applied. **Action:** Redeploy Admin App.
> 2. **Bot Restart Fails:** Error: *"The security token included in the request is invalid."* *Suspected Cause:* API Key mismatch in `config.py` vs AWS/Server environment, or expired Supabase JWT. **Action:** Audit `start_bot.py` auth headers and `.env` synchronization.

## 1. Project Overview & Role Structure
**CEO:** The User (Rut)
**The Project:** Building a premier SaaS platform for automated prediction market trading (Polymarket, Kalshi) and crypto arbitrage.
**Immediate Goal:** Stabilize the platform, reliable simulation, and productize for multi-user SaaS.

### The "Unified Team" Persona
The next agent must embody the following roles concurrently:
-   **CTO/Architect:** Responsible for high-level system design, ensuring "no breaking changes" from lack of context. Identify risks before coding.
-   **Lead Developer:** Writing robust, production-grade Python (Bot) and Typescript (UI).
-   **Product Manager:** Understanding the "Why" (SaaS features, Pricing, User Experience).
-   **QA Engineer:** Verifying *every* fix with logs and end-to-end tests (Simulated).

> **CRITICAL RULE:** Do not make changes blindly. Understand the interplay between the Next.js Admin UI, the Supabase Database, and the Python Bot Engine.

---

## 2. Current Status (The "Stable" Baseline)

### Backend (The Bot)
-   **Status:** **STABLE**.
-   **Repo:** `polybot` (Python 3.11+).
-   **Process:** Managed via `start_bot.py` or systemd.
-   **Fixes Applied:**
    -   Initialization crashes for `HighConvictionStrategy` & `SelectiveWhaleCopyStrategy` -> **FIXED**.
    -   Settings Persistence (DB Columns) -> **FIXED** (Schema updated via MCP).
    -   Missing Revenue RPC -> **FIXED** (Created `get_missed_money_stats` RPC).
-   **Verification:** `verify_rpc.py` confirms RPC works. Bot runs without crashing.

### Frontend (The Admin UI)
-   **Stack:** Next.js + Tailwind + Supabase Auth.
-   **Repo:** `polybot/admin` (deployed to Vercel).
-   **Status:** **Functionally Correct Locally**, but **Vercel Deployment May Be Stale**.
    -   The user reports "Settings Not Saving" on the Vercel app.
    -   **Diagnosis:** The DB schema IS fixed. If the Vercel app is still failing, it likely requires a **Redeploy** to pick up any environment anomalies OR the deployed code is outdated.
    -   **Action:** Next agent must assist user in redeploying the `admin` folder to Vercel.

### Database (Supabase)
-   **Project:** `ytaltvltxkkfczlvjgad` (polyparlay).
-   **Schema:** Updated with robust multi-tenant config columns (`ibkr_starting_balance`, etc.) and RPCs.

---

## 3. Product Analysis & Strategy (Feedback on `PRODUCT_ANALYSIS_SAAS.md`)

**The Analysis Document:** The existing `PRODUCT_ANALYSIS_SAAS.md` suggests merging the bot into a Streamlit app (`PolyParlay`).
**Correction/Feedback:**
1.  **Framework Conflict:** The user is currently using a **Next.js Admin Dashboard** (hosted on Vercel) which is far superior to Streamlit for SaaS scalability. **Do not regress to Streamlit for the main SaaS UI.** Continue investing in the Next.js app (`admin/`).
2.  **SaaS Architecture:**
    -   *Current:* Single-Tenant logic (checking `user_id` sometimes, but bot engine runs as singleton).
    -   *Next Phase:* **True Multi-Tenancy**. The Python bot needs to loop through *all* active configs in `polybot_config`, not just one. (Or spawn worker per user - containerization).
3.  **Simulation Accuracy:** The "Simulated" numbers must be mathematically rigorous. The current `bot_runner.py` has good simulation hooks, but they need to be audited for "Optimism Bias" (e.g., assuming instant fills at mid-market).

---

## 4. The Roadmap (Phases 8-9-10)

### Phase 8: Hardening & Simulation Trust
*   **Goal:** CEO (User) needs 100% trust in the "Simulation" numbers before "Live Money".
*   **Tasks:**
    1.  **Redeploy UI:** Ensure Vercel app matches local code/DB.
    2.  **Simulation Audit:** Review `PaperTradingStrategy` logic. Ensure it accounts for slippage, fees (Polymarket 0%, Kalshi 7%), and liquidity depth.
    3.  **End-to-End Verification:** Run a 24h simulation, exporting logs to CSV, and manually auditing 5-10 trades against historical price data.

### Phase 9: SaaS Infrastructure (The "Product")
*   **Goal:** Turn the tool into a platform others can use.
*   **Tasks:**
    1.  **Auth & Onboarding:** Polish Supabase Auth flow.
    2.  **Stripe Integration:** Hook up the "Upgrade" buttons in UI to actual Stripe Checkout (already partially in code).
    3.  **Bot Multi-Tenancy:** Refactor `bot_runner.py` to handle multiple `user_id` contexts or deploy via Kubernetes/Docker Swarm (one container per user).

### Phase 10: Scale & Marketing
*   **Goal:** Launch.
*   **Tasks:**
    1.  **Landing Page:** Refine `MyPolyBot.io` / `PolyEdge.ai` messaging.
    2.  **Documentation:** User guides for configuring API keys safely.
    3.  **Security Audit:** Ensure user API keys (AWS Secrets/Vault) are absolutely secure.

---

## 5. Next Steps for Incoming Agent
1.  **Acknowledge CEO:** Start by confirming you have read this Handoff and the `PRODUCT_ANALYSIS_SAAS.md`.
2.  **Fix Vercel Gap:** Ask user for permission to help redeploy the Next.js app (or guide them `cd admin && vercel deploy`). This is the likely "Settings" fix.
3.  **Simulation Restart:** Once UI is confirmed working, wipe the "Zombie" simulated trades and restart the bot in a clean state to begin the "Phase 8" Simulation Trust run.

*Signed,*
*Agent Antigravity (Phase 7 Stabilizer)*
