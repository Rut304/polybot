# Trading Bot Quick Start Guide

*Ready to build in 6 hours*

## 🎯 What We're Building

An **autonomous arbitrage trading bot** that:

- Monitors Polymarket + Kalshi in real-time
- Detects cross-platform price discrepancies
- Executes profitable trades automatically
- Tracks all activity in Supabase
- Shows admin dashboard in PolyParlay

---

## 📋 Prerequisites (Setup Before Building)

### 1. Accounts Needed

- [x] **GitHub account** (you have this)
- [x] **AWS account** (you have ECS running)
- [x] **Supabase account** (you have PolyParlay DB)
- [ ] **Polymarket account** with wallet
- [ ] **Kalshi account** with API access
- [ ] **Discord webhook** (for alerts - optional)

### 2. API Keys to Obtain

#### Polymarket

```bash
# Needed:
1. Wallet private key (for signing trades)
2. API endpoint: https://clob.polymarket.com
3. No API key needed (uses wallet signature)

# How to get:
- Use existing Privy wallet from PolyParlay
- Or create new wallet: https://polymarket.com
```

#### Kalshi

```bash
# Needed:
1. API Key ID
2. Private Key file (.pem)

# How to get:
1. Sign up: https://kalshi.com
2. Complete KYC verification
3. Navigate to Settings → API Access
4. Generate API credentials
5. Download private key file
6. Save API Key ID

# Cost: Free account, $100 minimum deposit to trade
```

#### Discord Webhook (Optional)

```bash
# For notifications
1. Create Discord server (or use existing)
2. Server Settings → Integrations → Webhooks
3. Create webhook, copy URL
4. Set as DISCORD_WEBHOOK env variable
```

---

## 🚀 Hour-by-Hour Build Plan

### ⏰ Hour 1: Fork & Setup (60 min)

**Step 1: Fork Repository**

```bash
# Go to: https://github.com/jtdoherty/arb-bot
# Click "Fork" button (top-right)
# This creates your copy at: https://github.com/YOUR_USERNAME/arb-bot
```

**Step 2: Clone Locally**

```bash
cd ~/projects
git clone https://github.com/YOUR_USERNAME/arb-bot.git polyparlay-arb-bot
cd polyparlay-arb-bot
```

**Step 3: Create Virtual Environment**

```bash
python3 -m venv venv
source venv/bin/activate  # On Mac/Linux
# venv\Scripts\activate   # On Windows

pip install -r requirements.txt
```

**Step 4: Configure Environment**

```bash
cp .env.example .env
nano .env  # Or use VS Code

# Add your credentials:
KALSHI_API_KEY=your_key_id_here
KALSHI_PRIVATE_KEY=path/to/kalshi_private.pem
POLYMARKET_PRIVATE_KEY=your_wallet_private_key_here
DISCORD_WEBHOOK=your_webhook_url_here
```

**Step 5: Test Read-Only Mode**

```bash
python main.py

# Expected output:
# WebSocket connection opened
# Order books updating...
# No arbitrage opportunities found (or shows opportunities)
```

**✅ Checkpoint**: Bot runs locally, sees market data

---

### ⏰ Hour 2: Database Integration (60 min)

**Step 1: Add Dependencies**

```bash
pip install supabase-py
pip freeze > requirements.txt
```

**Step 2: Create Database Tables**

```sql
-- Run in Supabase SQL Editor

-- Opportunities table
CREATE TABLE arbitrage_opportunities (
  id BIGSERIAL PRIMARY KEY,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  platform_buy TEXT NOT NULL,
  platform_sell TEXT NOT NULL,
  market_buy TEXT,
  market_sell TEXT,
  profit_percent NUMERIC(10,4),
  max_size NUMERIC(10,2),
  total_profit NUMERIC(10,2),
  status TEXT DEFAULT 'detected',
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Executed trades table
CREATE TABLE arbitrage_trades (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT REFERENCES arbitrage_opportunities(id),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  platform TEXT NOT NULL,
  market_id TEXT,
  side TEXT,  -- 'buy' or 'sell'
  price NUMERIC(10,4),
  size NUMERIC(10,2),
  filled_size NUMERIC(10,2),
  tx_hash TEXT,
  status TEXT,  -- 'pending', 'filled', 'failed'
  profit_loss NUMERIC(10,2)
);

-- Bot status table (for monitoring)
CREATE TABLE bot_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_running BOOLEAN DEFAULT true,
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_opportunities_detected INTEGER DEFAULT 0,
  total_trades_executed INTEGER DEFAULT 0,
  total_profit NUMERIC(10,2) DEFAULT 0,
  max_trade_size NUMERIC(10,2) DEFAULT 500,
  min_profit_threshold NUMERIC(5,2) DEFAULT 1.0,
  CHECK (id = 1)  -- Only one row allowed
);

INSERT INTO bot_status (id) VALUES (1);
```

**Step 3: Add Supabase Client**

```python
# Create new file: db.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class Database:
    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        self.client: Client = create_client(url, key)
    
    def log_opportunity(self, opportunity):
        """Log detected arbitrage opportunity"""
        return self.client.table('arbitrage_opportunities').insert({
            'platform_buy': opportunity['platform_buy'],
            'platform_sell': opportunity['platform_sell'],
            'market_buy': opportunity.get('market_buy'),
            'market_sell': opportunity.get('market_sell'),
            'profit_percent': opportunity['profit_percent'],
            'max_size': opportunity['max_size'],
            'total_profit': opportunity['total_profit'],
            'status': 'detected'
        }).execute()
    
    def log_trade(self, opportunity_id, trade_details):
        """Log executed trade"""
        return self.client.table('arbitrage_trades').insert({
            'opportunity_id': opportunity_id,
            'platform': trade_details['platform'],
            'market_id': trade_details['market_id'],
            'side': trade_details['side'],
            'price': trade_details['price'],
            'size': trade_details['size'],
            'status': 'pending'
        }).execute()
    
    def update_bot_heartbeat(self):
        """Update bot status heartbeat"""
        return self.client.table('bot_status').update({
            'last_heartbeat': 'now()'
        }).eq('id', 1).execute()
    
    def get_bot_config(self):
        """Get bot configuration"""
        result = self.client.table('bot_status').select('*').eq('id', 1).single().execute()
        return result.data
```

**Step 4: Integrate into Bot**

```python
# Modify arbitrage/arbitrage_bot.py
from db import Database

class ArbitrageBot:
    def __init__(self, order_book_manager):
        self.order_book_manager = order_book_manager
        self.db = Database()  # Add this
    
    def find_arbitrage_opportunities(self):
        opportunities = # ... existing code ...
        
        # Log to database
        for opp in opportunities:
            self.db.log_opportunity({
                'platform_buy': 'kalshi' if 'Buy Kalshi' in opp['type'] else 'polymarket',
                'platform_sell': 'polymarket' if 'Buy Kalshi' in opp['type'] else 'kalshi',
                'profit_percent': opp['profit'] * 100,
                'max_size': opp['max_size'],
                'total_profit': opp['total_profit']
            })
        
        return opportunities
```

**Step 5: Add to .env**

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```

**✅ Checkpoint**: All opportunities logged to Supabase

---

### ⏰ Hour 3: Trade Execution (60 min)

**Step 1: Add Trade Execution Logic**

```python
# Create new file: execution.py
import asyncio
from py_clob_client.client import ClobClient
from py_clob_client.constants import POLYGON

class TradeExecutor:
    def __init__(self, private_key):
        self.polymarket = ClobClient(
            host="https://clob.polymarket.com",
            key=private_key,
            chain_id=POLYGON
        )
    
    async def execute_polymarket_trade(self, market_id, side, price, size):
        """Execute trade on Polymarket"""
        try:
            # Create order
            order = {
                'tokenID': market_id,
                'price': price,
                'size': size,
                'side': side  # 'BUY' or 'SELL'
            }
            
            # Sign and submit
            signed_order = self.polymarket.create_order(order)
            result = self.polymarket.post_order(signed_order)
            
            return {
                'success': True,
                'order_id': result['orderID'],
                'status': result['status']
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def execute_kalshi_trade(self, market_ticker, side, price, size):
        """Execute trade on Kalshi"""
        # TODO: Implement Kalshi trading API
        # For now, return mock response
        return {
            'success': True,
            'order_id': 'mock_kalshi_order',
            'status': 'pending'
        }
```

**Step 2: Add Safety Checks**

```python
# Add to execution.py
class RiskManager:
    def __init__(self, max_trade_size=500, min_profit=0.01, max_daily_loss=100):
        self.max_trade_size = max_trade_size
        self.min_profit = min_profit
        self.max_daily_loss = max_daily_loss
        self.daily_pnl = 0
        self.failed_trades_count = 0
    
    def is_safe_to_trade(self, opportunity):
        """Check if trade passes safety checks"""
        # Check profit threshold
        if opportunity['profit_percent'] < self.min_profit:
            return False, "Profit below minimum threshold"
        
        # Check trade size
        if opportunity['max_size'] > self.max_trade_size:
            opportunity['max_size'] = self.max_trade_size
        
        # Check daily loss limit
        if self.daily_pnl < -self.max_daily_loss:
            return False, "Daily loss limit reached"
        
        # Check circuit breaker
        if self.failed_trades_count >= 3:
            return False, "Too many failed trades (circuit breaker)"
        
        return True, "OK"
    
    def record_trade_result(self, profit_loss, success):
        """Record trade outcome"""
        self.daily_pnl += profit_loss
        if not success:
            self.failed_trades_count += 1
        else:
            self.failed_trades_count = 0  # Reset on success
```

**Step 3: Integrate Execution into Bot**

```python
# Modify arbitrage/arbitrage_bot.py
from execution import TradeExecutor, RiskManager

class ArbitrageBot:
    def __init__(self, order_book_manager, dry_run=True):
        self.order_book_manager = order_book_manager
        self.db = Database()
        self.executor = TradeExecutor(os.getenv("POLYMARKET_PRIVATE_KEY"))
        self.risk_manager = RiskManager()
        self.dry_run = dry_run  # Safety mode
    
    async def execute_opportunity(self, opportunity):
        """Execute arbitrage trade"""
        # Safety check
        safe, reason = self.risk_manager.is_safe_to_trade(opportunity)
        if not safe:
            print(f"⚠️ Skipping trade: {reason}")
            return
        
        if self.dry_run:
            print(f"🔵 DRY RUN: Would execute trade with ${opportunity['total_profit']:.2f} profit")
            return
        
        print(f"🟢 EXECUTING: {opportunity['type']}")
        
        # Execute buy side
        buy_result = await self.executor.execute_polymarket_trade(...)
        
        if buy_result['success']:
            # Execute sell side
            sell_result = await self.executor.execute_kalshi_trade(...)
            
            # Log to database
            self.db.log_trade(opportunity['id'], buy_result)
            self.db.log_trade(opportunity['id'], sell_result)
        
        return buy_result
```

**✅ Checkpoint**: Bot can execute trades (in dry-run mode)

---

### ⏰ Hour 4: Risk Management (60 min)

**Add these safety features:**

1. **Balance Checks**

```python
def check_balances(self):
    """Ensure sufficient balance before trading"""
    poly_balance = self.polymarket.get_balance()
    kalshi_balance = # get kalshi balance
    
    if poly_balance < self.max_trade_size:
        raise Exception(f"Insufficient Polymarket balance: ${poly_balance}")
```

2. **Slippage Protection**

```python
def verify_price(self, opportunity):
    """Check price hasn't moved since detection"""
    current_price = self.fetch_current_price(opportunity['market_id'])
    if abs(current_price - opportunity['price']) > 0.005:  # 0.5% tolerance
        return False
    return True
```

3. **Gas Fee Estimation**

```python
def estimate_gas_fees(self, trade):
    """Factor in Polygon gas costs"""
    # Polymarket on Polygon: ~$0.01-0.05 per trade
    estimated_gas = 0.03
    net_profit = trade['profit'] - estimated_gas
    if net_profit < self.min_profit:
        return False, "Profit too low after gas fees"
    return True, net_profit
```

4. **Daily Limits**

```python
# Add to bot_status table query
config = self.db.get_bot_config()
if config['total_profit'] < -config['max_daily_loss']:
    print("⛔ Daily loss limit reached. Pausing bot.")
    self.pause()
```

**✅ Checkpoint**: Bot has multiple safety layers

---

### ⏰ Hour 5: AWS Deployment (60 min)

**Step 1: Create Dockerfile**

```dockerfile
# Dockerfile
FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy bot code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "from db import Database; db = Database(); db.update_bot_heartbeat()"

# Run bot
CMD ["python", "main.py"]
```

**Step 2: Build and Push to ECR**

```bash
# Build image
docker build -t polyparlay-arb-bot .

# Test locally
docker run --env-file .env polyparlay-arb-bot

# Tag for ECR
docker tag polyparlay-arb-bot:latest 992382424906.dkr.ecr.us-east-1.amazonaws.com/polyparlay-arb-bot:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 992382424906.dkr.ecr.us-east-1.amazonaws.com
docker push 992382424906.dkr.ecr.us-east-1.amazonaws.com/polyparlay-arb-bot:latest
```

**Step 3: Create ECS Task Definition**

```json
{
  "family": "polyparlay-arb-bot",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [{
    "name": "arb-bot",
    "image": "992382424906.dkr.ecr.us-east-1.amazonaws.com/polyparlay-arb-bot:latest",
    "essential": true,
    "environment": [
      {"name": "DRY_RUN", "value": "true"}
    ],
    "secrets": [
      {"name": "KALSHI_API_KEY", "valueFrom": "arn:aws:secretsmanager:..."},
      {"name": "POLYMARKET_PRIVATE_KEY", "valueFrom": "arn:aws:secretsmanager:..."},
      {"name": "SUPABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
      {"name": "SUPABASE_KEY", "valueFrom": "arn:aws:secretsmanager:..."}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/polyparlay-arb-bot",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "bot"
      }
    }
  }]
}
```

**Step 4: Deploy Service**

```bash
aws ecs create-service \
  --cluster video-render-cluster \
  --service-name polyparlay-arb-bot \
  --task-definition polyparlay-arb-bot \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

**✅ Checkpoint**: Bot running 24/7 on AWS

---

### ⏰ Hour 6: Monitoring & Alerts (60 min)

**Step 1: Add Discord Notifications**

```python
# notifications.py
import requests
import os

def send_discord_alert(opportunity):
    """Send alert to Discord channel"""
    webhook_url = os.getenv("DISCORD_WEBHOOK")
    if not webhook_url:
        return
    
    color = 0x00FF00 if opportunity['profit_percent'] > 2 else 0xFFFF00
    
    embed = {
        "title": "🚨 Arbitrage Opportunity Detected",
        "color": color,
        "fields": [
            {"name": "Profit", "value": f"{opportunity['profit_percent']:.2f}%", "inline": True},
            {"name": "Amount", "value": f"${opportunity['total_profit']:.2f}", "inline": True},
            {"name": "Size", "value": f"${opportunity['max_size']:.2f}", "inline": True},
            {"name": "Buy", "value": opportunity['platform_buy'], "inline": True},
            {"name": "Sell", "value": opportunity['platform_sell'], "inline": True},
        ],
        "timestamp": datetime.utcnow().isoformat()
    }
    
    requests.post(webhook_url, json={"embeds": [embed]})
```

**Step 2: Create Admin Dashboard**

```python
# In PolyParlay: pages/Admin_Bot.py
import streamlit as st
from supabase import create_client

st.title("🤖 Arbitrage Bot Dashboard")

# Get bot status
bot_status = supabase.table('bot_status').select('*').eq('id', 1).single().execute()
status = bot_status.data

# Metrics
col1, col2, col3, col4 = st.columns(4)
col1.metric("Status", "🟢 Running" if status['is_running'] else "🔴 Stopped")
col2.metric("Total Profit", f"${status['total_profit']:.2f}")
col3.metric("Opportunities", status['total_opportunities_detected'])
col4.metric("Trades", status['total_trades_executed'])

# Recent opportunities
st.subheader("Recent Opportunities")
opps = supabase.table('arbitrage_opportunities').select('*').order('detected_at', desc=True).limit(50).execute()
st.dataframe(opps.data)

# Controls
col1, col2 = st.columns(2)
if col1.button("⏸️ Pause Bot"):
    supabase.table('bot_status').update({'is_running': False}).eq('id', 1).execute()
    st.success("Bot paused")

if col2.button("▶️ Resume Bot"):
    supabase.table('bot_status').update({'is_running': True}).eq('id', 1).execute()
    st.success("Bot resumed")

# Settings
st.subheader("Risk Settings")
max_trade = st.slider("Max Trade Size ($)", 100, 2000, int(status['max_trade_size']))
min_profit = st.slider("Min Profit (%)", 0.5, 5.0, float(status['min_profit_threshold']))

if st.button("Save Settings"):
    supabase.table('bot_status').update({
        'max_trade_size': max_trade,
        'min_profit_threshold': min_profit
    }).eq('id', 1).execute()
    st.success("Settings saved")
```

**✅ Checkpoint**: Full monitoring and control panel

---

## 🎯 Testing Checklist

Before going live:

- [ ] Dry-run mode works (logs opportunities, doesn't trade)
- [ ] Database logging works
- [ ] Discord notifications arrive
- [ ] Balance checks prevent over-trading
- [ ] Slippage protection rejects bad prices
- [ ] Circuit breaker stops after failures
- [ ] Admin dashboard shows real-time data
- [ ] Tested with $10-50 real trades
- [ ] Monitored for 24 hours successfully

---

## 🚨 Go-Live Checklist

When ready for production:

1. **Set dry_run=False** in main.py
2. **Start with small capital** ($100-500)
3. **Set conservative limits**:
   - Max trade size: $100
   - Min profit: 1.5%
   - Daily loss limit: $50
4. **Monitor first 24 hours closely**
5. **Review all executed trades**
6. **Adjust parameters based on results**
7. **Scale up gradually** (weekly)

---

## 📊 Expected Results

### Week 1

- **Goal**: Learn and test
- **Capital**: $100-500
- **Target**: Break even
- **Focus**: Fix bugs, tune params

### Week 2-4

- **Goal**: Consistent profit
- **Capital**: $500-2000
- **Target**: 1-5% weekly
- **Focus**: Optimize execution

### Month 2+

- **Goal**: Scale up
- **Capital**: $5000+
- **Target**: 5-15% monthly
- **Focus**: Add platforms

---

## 🆘 Troubleshooting

### "No opportunities found"

- Check market volatility (low vol = fewer opportunities)
- Lower min_profit threshold
- Add more market pairs

### "Trade execution failed"

- Check API credentials
- Verify sufficient balance
- Check network connectivity
- Review CloudWatch logs

### "Database errors"

- Verify Supabase connection
- Check table permissions
- Confirm RLS policies allow inserts

### "WebSocket disconnects"

- Normal (it reconnects automatically)
- Check network stability
- Verify API rate limits not exceeded

---

## 📚 Resources

- **jtdoherty/arb-bot**: <https://github.com/jtdoherty/arb-bot>
- **Polymarket API Docs**: <https://docs.polymarket.com>
- **Kalshi API Docs**: <https://trading-api.readme.io/reference>
- **py-clob-client**: <https://github.com/Polymarket/py-clob-client>

---

**Ready to build?** Let's start Hour 1! 🚀
