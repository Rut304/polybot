# Prediction Market Arbitrage Bot - Comprehensive Analysis
*Generated: December 1, 2025 01:21 UTC*

## Executive Summary

After analyzing 7 open-source prediction market trading bots, we have three strong candidates for a 6-hour build. The most promising approach is to **fork jtdoherty/arb-bot** as it already implements exactly what you need: real-time Polymarket + Kalshi arbitrage with WebSocket order book monitoring.

### Quick Recommendation
**Best Starting Point**: `jtdoherty/arb-bot` (6 stars, MIT license)
- ✅ Already monitors Polymarket + Kalshi in real-time
- ✅ WebSocket order book tracking
- ✅ Cross-platform arbitrage detection
- ✅ Modular architecture (easy to extend)
- ✅ Async Python (fast execution)
- ⚠️ Read-only (needs trade execution added)

---

## Detailed Bot Analysis

### 1. jtdoherty/arb-bot ⭐⭐⭐⭐⭐ (RECOMMENDED)
**GitHub**: https://github.com/jtdoherty/arb-bot  
**Stars**: 6 | **Language**: Python | **License**: MIT

#### Architecture
```
arb-bot/
├── main.py                    # Entry point, mode selector
├── kalshi/
│   └── kalshi_client.py       # Kalshi WebSocket client
├── polymarket/
│   └── polymarket_client.py   # Polymarket REST/WebSocket
├── data/
│   └── order_book_manager.py  # Order book comparison logic
└── arbitrage/
    └── arbitrage_bot.py       # Opportunity detection engine
```

#### Key Features
- **Real-time WebSocket order books** for both platforms
- **Async architecture** using `asyncio` for speed
- **Cross-platform arbitrage formulas**:
  - Formula 1: Buy Kalshi YES ask, Sell Polymarket YES bids
  - Formula 2: Buy Polymarket YES asks, Sell Kalshi YES bid
- **Max size calculation** (finds minimum available liquidity)
- **Profit calculation** with total profit estimates
- **Modular design** - easy to add new platforms

#### Stack
```python
# requirements.txt
py-clob-client      # Polymarket CLOB API
web3                # Ethereum wallet integration
requests            # HTTP requests
websocket-client    # WebSocket connections
cryptography        # Signing trades
python-dotenv       # Environment config
websockets          # Async WebSocket
```

#### Execution Logic
```python
# Opportunity detection (simplified)
def find_arbitrage_opportunities(self):
    # Get best prices from order books
    kalshi_ask_price, kalshi_ask_size = kalshi_asks[0]
    poly_bid_price, poly_bid_size = poly_bids[0]
    
    # Calculate profit
    profit = poly_bid_price - kalshi_ask_price
    max_size = min(kalshi_ask_size, poly_bid_size)
    
    if profit > 0:
        return {
            "profit": profit,
            "max_size": max_size,
            "total_profit": profit * max_size
        }
```

#### What's Missing (Needs 6-Hour Build)
1. ❌ **Trade execution** - Only detects opportunities, doesn't execute
2. ❌ **Wallet integration** - No Privy/wallet connection
3. ❌ **Risk management** - No position limits or circuit breakers
4. ❌ **Notification system** - No alerts (Discord, Telegram, email)
5. ❌ **Persistence** - No database tracking of executed trades
6. ❌ **Admin dashboard** - No web UI for monitoring

#### Pros
- ✅ Most relevant to your requirements (Polymarket + Kalshi)
- ✅ Already handles order book complexity
- ✅ Clean, maintainable code
- ✅ Async for speed
- ✅ Easy to extend to more platforms

#### Cons
- ⚠️ Only 6 stars (less battle-tested)
- ⚠️ No trade execution (read-only mode)
- ⚠️ Hardcoded to specific markets (needs generalization)

---

### 2. P-x-J/polymarket-arbitrage-bot ⭐⭐⭐⭐
**GitHub**: https://github.com/P-x-J/polymarket-arbitrage-bot  
**Stars**: 28 | **Language**: Python | **License**: MIT

#### Architecture
```
polymarket-arbitrage-bot/
├── bot/
│   └── main.py                # Main loop
├── gamma_apis/                # Polymarket Gamma API wrapper
├── utils/
│   ├── arbitrage_detector.py  # Opportunity detection
│   ├── probability_calculator.py
│   └── markets_data_parser.py # JSON parsing
└── arbitrage_calculator.py    # Core logic
```

#### Key Features
- **Single-market arbitrage**: YES + NO prices < $1.00
- **Multi-market arbitrage**: Categorical markets (e.g., election outcomes)
- **Gamma Markets API** integration (REST only, no WebSocket)
- **Decimal odds conversion** for easier math
- **Email/logging alerts** when opportunities found

#### Stack
```python
# Uses Polymarket Gamma API (REST)
# No WebSocket (polls API periodically)
# No trade execution
```

#### Execution Logic
```python
# Detects when YES + NO prices don't sum to $1
def calculate_probability():
    yes_price = 0.72
    no_price = 0.25
    total = yes_price + no_price  # 0.97
    
    if total < 1.00:
        arbitrage_percent = (1.00 - total) * 100  # 3%
        return True, arbitrage_percent
```

#### Pros
- ✅ Most popular (28 stars = community trust)
- ✅ Handles both single and multi-market arbitrage
- ✅ Well-documented with examples
- ✅ Email notification system

#### Cons
- ⚠️ **Polymarket-only** (no Kalshi or cross-platform)
- ⚠️ REST polling instead of WebSocket (slower)
- ⚠️ No trade execution
- ⚠️ Less suitable for fast arbitrage (polling delay)

---

### 3. 0xalberto/polymarket-arbitrage-bot ⭐⭐⭐
**GitHub**: https://github.com/0xalberto/polymarket-arbitrage-bot  
**Stars**: 19 | **Language**: Python | **License**: MIT

#### Notes
- **Fork of P-x-J's bot** (identical architecture)
- Same pros/cons as above
- Slightly less maintained (19 vs 28 stars)

---

### 4. andrewus122/arbitrage-scanner 🌟
**GitHub**: https://github.com/andrewus122/arbitrage-scanner  
**Stars**: 0 | **Language**: Unknown | **License**: Unknown

#### Key Features
- **Multi-platform**: Kalshi, Polymarket, OPINION
- Broadest platform coverage found
- No code visible (likely private or empty repo)

#### Status
- ⚠️ No stars, no documentation
- ⚠️ Cannot analyze without code access
- 📝 Worth contacting author if interested

---

### 5. Jake-loranger/alpha-arbitrage
**GitHub**: https://github.com/Jake-loranger/alpha-arbitrage  
**Stars**: 5 | **Language**: Unknown

#### Notes
- Focuses on **Alpha Arcade** gaming markets
- Also checks Polymarket for cross-platform arb
- Niche use case (gaming prediction markets)
- ⚠️ Less relevant for political/sports markets

---

## Sharky's Bot - INVESTIGATION NEEDED

**Status**: ❌ Not found in initial search  
**Next Steps**:
1. Search Twitter/X for @sharky or similar handles
2. Check if mentioned in @0xtria's thread
3. Search GitHub by commit author names
4. Check Polymarket Discord/Telegram

**Why We Care**: User specifically mentioned Sharky's bot, likely has proven track record or unique features worth studying.

---

## 6-Hour Build Plan (Using jtdoherty/arb-bot as base)

### Hour 1: Setup & Fork (60 min)
**Tasks**:
- ✅ Fork `jtdoherty/arb-bot` to your GitHub
- ✅ Clone to local dev environment
- ✅ Install dependencies: `pip install -r requirements.txt`
- ✅ Set up `.env` with Kalshi/Polymarket API keys
- ✅ Test existing bot in read-only mode
- ✅ Verify WebSocket connections work

**Deliverable**: Bot running locally, detecting opportunities

---

### Hour 2: Database & Persistence (60 min)
**Tasks**:
- ✅ Add Supabase client to existing PolyParlay connection
- ✅ Create `arbitrage_opportunities` table:
  ```sql
  CREATE TABLE arbitrage_opportunities (
    id SERIAL PRIMARY KEY,
    detected_at TIMESTAMP DEFAULT NOW(),
    platform_buy TEXT,
    platform_sell TEXT,
    market_id TEXT,
    profit_percent NUMERIC,
    max_size NUMERIC,
    total_profit NUMERIC,
    status TEXT,  -- 'detected', 'executed', 'missed'
    executed_at TIMESTAMP
  );
  ```
- ✅ Log all detected opportunities to database
- ✅ Add trade execution tracking table

**Deliverable**: All opportunities persisted, historical tracking

---

### Hour 3: Trade Execution Engine (60 min)
**Tasks**:
- ✅ Integrate `py-clob-client` for Polymarket trades
- ✅ Add Kalshi trade API calls
- ✅ Implement execution logic:
  ```python
  async def execute_arbitrage(opportunity):
      # 1. Place buy order on Platform A
      buy_order = await platform_a.place_order(...)
      
      # 2. Wait for fill confirmation
      await wait_for_fill(buy_order)
      
      # 3. Place sell order on Platform B
      sell_order = await platform_b.place_order(...)
      
      # 4. Log to database
      await db.update_opportunity(status='executed')
  ```
- ⚠️ **CRITICAL**: Add balance checks before executing
- ⚠️ **CRITICAL**: Add slippage protection (reject if price moves >0.5%)

**Deliverable**: Bot can execute trades automatically

---

### Hour 4: Risk Management & Safety (60 min)
**Tasks**:
- ✅ Add position limits (max $500 per trade initially)
- ✅ Add daily loss limits (stop if down >$100/day)
- ✅ Add minimum profit threshold (skip if profit <1%)
- ✅ Add circuit breaker (pause if 3 failed trades in a row)
- ✅ Add gas fee estimation (Polymarket uses Polygon)
- ✅ Verify sufficient balance before each trade
- ✅ Add dry-run mode for testing

**Deliverable**: Bot won't blow up your account

---

### Hour 5: Wallet Integration & Deployment (60 min)
**Tasks**:
- ✅ Add Privy wallet connection (reuse from PolyParlay)
- ✅ Store encrypted private keys in environment
- ✅ Add ECS Dockerfile:
  ```dockerfile
  FROM python:3.11-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install -r requirements.txt
  COPY . .
  CMD ["python", "main.py"]
  ```
- ✅ Deploy to ECS on `video-render-cluster`
- ✅ Configure CloudWatch logging
- ✅ Set up environment variables in ECS task definition

**Deliverable**: Bot running on AWS 24/7

---

### Hour 6: Monitoring & Alerts (60 min)
**Tasks**:
- ✅ Add Discord webhook notifications:
  ```python
  def send_discord_alert(opportunity):
      webhook_url = os.getenv("DISCORD_WEBHOOK")
      requests.post(webhook_url, json={
          "content": f"🚨 ARBITRAGE: {opportunity['profit_percent']}% profit, ${opportunity['total_profit']:.2f} available"
      })
  ```
- ✅ Add admin page to PolyParlay:
  - Show recent opportunities
  - Show executed trades (P&L)
  - Pause/resume button
  - Adjust risk parameters
- ✅ Add health check endpoint for ECS
- ✅ Final testing with small amounts ($10-50)

**Deliverable**: Full monitoring, ready for production

---

## Integration with PolyParlay

### Shared Infrastructure
```python
# Reuse existing components:
- ✅ Supabase connection (shared database)
- ✅ AWS ECS cluster (same hardware)
- ✅ Privy wallet integration
- ✅ ECR for Docker images
- ✅ CloudWatch logs

# New components:
- 📝 Separate ECS service: polyparlay-arb-bot
- 📝 New table: arbitrage_opportunities
- 📝 New admin page: pages/Admin_Bot.py
```

### Admin Dashboard Mock
```python
# pages/Admin_Bot.py
import streamlit as st
from supabase import create_client

st.title("🤖 Arbitrage Bot Control Panel")

# Status
col1, col2, col3 = st.columns(3)
col1.metric("Status", "🟢 Running")
col2.metric("Today's Profit", "$127.43")
col3.metric("Win Rate", "94%")

# Recent opportunities
st.subheader("Recent Opportunities")
opportunities = supabase.table('arbitrage_opportunities').select('*').order('detected_at', desc=True).limit(20).execute()
st.dataframe(opportunities.data)

# Controls
if st.button("⏸️ Pause Bot"):
    # Send pause signal to bot
    st.success("Bot paused")

# Risk settings
st.subheader("Risk Settings")
max_trade_size = st.slider("Max Trade Size ($)", 100, 2000, 500)
min_profit = st.slider("Min Profit Threshold (%)", 0.5, 5.0, 1.0)
```

---

## Cost Estimate (AWS)

### Additional Monthly Costs
```
ECS Task (Fargate):
- 0.25 vCPU, 0.5 GB RAM
- 24/7 uptime: ~$11/month

CloudWatch Logs:
- ~1 GB ingestion/month: ~$0.50

ECR Storage:
- Docker image (~200MB): ~$0.02

Total: ~$11.52/month
```

**Note**: Trading fees (Polymarket, Kalshi) will be higher than infrastructure costs. Expect 1-2% per trade.

---

## Alternative Strategies (If 6 Hours Isn't Enough)

### Plan B: Scanner Only (3 hours)
- ✅ Fork P-x-J's bot (simpler, Polymarket-only)
- ✅ Add Discord alerts
- ✅ **Manual execution** (you place trades yourself)
- ✅ Deploy to ECS
- ⚠️ Slower to execute (manual delay)
- ✅ Lower risk (you review each trade)

### Plan C: Use Existing Service (30 minutes)
- ✅ Subscribe to existing arbitrage alerts (if any exist)
- ✅ Build just the admin dashboard in PolyParlay
- ⚠️ Monthly subscription costs
- ⚠️ Less control over strategy

---

## Security Considerations

### Critical Risks
1. **Private Key Storage**: Use AWS Secrets Manager, NOT `.env` in repo
2. **API Rate Limits**: Implement exponential backoff
3. **Flash Crashes**: Add sanity checks on prices (reject if >50% from recent average)
4. **Race Conditions**: Opportunities disappear fast, need fast execution
5. **Wallet Drain**: Add daily withdrawal limits

### Recommended Safety Measures
```python
# Example safety check
def is_safe_to_trade(opportunity):
    # 1. Check balance
    if get_balance() < opportunity['max_size']:
        return False
    
    # 2. Check profit is real
    if opportunity['profit_percent'] < MIN_PROFIT:
        return False
    
    # 3. Check price hasn't moved
    current_price = fetch_current_price()
    if abs(current_price - opportunity['price']) > SLIPPAGE_TOLERANCE:
        return False
    
    # 4. Check daily limit not exceeded
    if get_daily_trades() > MAX_DAILY_TRADES:
        return False
    
    return True
```

---

## Comparison Matrix

| Feature | jtdoherty/arb-bot | P-x-J/bot | andrewus122 | Build from Scratch |
|---------|-------------------|-----------|-------------|-------------------|
| **Platforms** | Polymarket + Kalshi | Polymarket only | 3+ platforms | Any |
| **Speed** | Fast (WebSocket) | Slow (REST poll) | Unknown | Fast (custom) |
| **Code Quality** | Good | Good | Unknown | Depends |
| **Battle-Tested** | 6 stars | 28 stars | 0 stars | No |
| **Trade Execution** | ❌ Need to add | ❌ Need to add | Unknown | ✅ Build it |
| **6-Hour Feasible** | ✅ Yes | ⚠️ Maybe | Unknown | ❌ No |
| **Maintenance** | Low | Low | Unknown | High |

---

## Final Recommendation

**START WITH**: `jtdoherty/arb-bot`

**Why**:
1. ✅ Solves exact problem (Polymarket + Kalshi cross-platform)
2. ✅ Real-time WebSocket = fast execution
3. ✅ Clean architecture = easy to modify
4. ✅ 80% of work done, just add execution layer
5. ✅ 6-hour timeline is realistic
6. ✅ MIT license = commercial use allowed

**Next Steps for Morning**:
1. ☕ Review this analysis
2. 🔍 Decide on starting repo (jtdoherty recommended)
3. 🚀 Begin 6-hour build plan
4. 💰 Start with $100-500 test capital
5. 📊 Monitor first day, scale up if profitable

**Questions to Answer Before Building**:
- What's your max loss tolerance per day? ($100? $500?)
- What platforms matter most? (Polymarket + Kalshi? Or add more?)
- Manual approval for first trades, or fully autonomous?
- Where to get Kalshi API keys? (Need account setup)

---

**Status**: ✅ Analysis Complete  
**Next**: Find Sharky's bot, then start building

---

*Generated by GitHub Copilot for PolyParlay Trading Bot Project*
