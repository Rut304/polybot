import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Static help articles (used as fallback if DB not available)
const STATIC_ARTICLES = [
  // ========================================
  // GETTING STARTED
  // ========================================
  {
    id: '1',
    slug: 'getting-started',
    title: 'Getting Started with PolyParlay',
    category: 'getting-started',
    excerpt: 'Learn how to set up your PolyParlay account and start trading predictions.',
    content: `# Getting Started with PolyParlay

Welcome to PolyParlay! This guide will walk you through setting up your account and making your first trade.

## Step 1: Create Your Account

1. Go to [polyparlay.io/signup](/signup)
2. Sign up with your email or Google account
3. Verify your email address

## Step 2: Complete Onboarding

After signing in, you'll see the onboarding wizard:

1. **Set Up Wallet** - We create a secure embedded wallet for you (powered by Privy)
2. **Connect Platforms** - Add your Polymarket, Kalshi, or other trading platform API keys
3. **Choose Strategies** - Pick which automated strategies you want to use

## Step 3: Start Paper Trading (Free!)

Everyone starts with **unlimited paper trading** - no real money required!

- **Real market data** - See actual prediction market prices
- **Simulated trades** - Learn without risking real money
- **Full analytics** - Track your hypothetical P&L
- **Risk-free learning** - Perfect for beginners

## Step 4: Explore the Dashboard

Your main dashboard shows:

- **Portfolio Balance** - Current simulated or real balance
- **Active Positions** - Markets you're currently in
- **Recent Trades** - Your trade history
- **Strategy Performance** - How each strategy is doing

## Step 5: Enable Strategies

Go to **Automation → Strategies** to:

1. View all 25+ available strategies
2. Toggle strategies ON/OFF
3. Customize parameters for each strategy
4. Set position sizes and risk limits

## Ready for Live Trading?

When you're confident with paper trading:

1. Upgrade to **Pro** or **Elite** plan
2. Connect your real trading platform API keys
3. Enable **Live Trading Mode** in Settings
4. Start with small position sizes

## Need Help?

- Browse our [FAQ](/help?article=faq)
- Use the chat widget (bottom right)
- Email us at support@polyparlay.io`,
    view_count: 0,
  },
  {
    id: '2',
    slug: 'paper-trading',
    title: 'Paper Trading Guide',
    category: 'getting-started',
    excerpt: 'Learn how paper trading works and practice risk-free.',
    content: `# Paper Trading Guide

Paper trading lets you practice with simulated money using real market data.

## What is Paper Trading?

Paper trading is a simulation mode where:
- You see **real market prices** in real-time
- Your trades are **simulated**, not actually executed
- You track **virtual P&L** as if you were trading real money
- There's **zero financial risk**

## Why Start with Paper Trading?

1. **Learn the platform** - Understand how PolyParlay works
2. **Test strategies** - See which strategies fit your style
3. **Build confidence** - Get comfortable before risking real money
4. **No minimum deposit** - Start immediately for free

## How to Use Paper Trading

### Starting Balance
You start with a **$10,000 virtual balance**. To reset:
- Go to Settings → Simulation
- Click "Reset Simulation Data"

### Viewing Paper Trades
- Dashboard shows your simulated portfolio
- **Trading → My Trades** shows all paper trades
- **Analytics** tracks simulated performance

### Paper Trading Indicators
Look for these indicators:
- 📝 **PAPER** badge on trades
- 🔵 Blue balance color (vs green for real)
- "Simulation Mode" in header

## Switching to Live Trading

When ready for real money:

1. **Upgrade plan** - Pro ($29/mo) or Elite ($99/mo)
2. **Add API keys** - Connect your real trading accounts
3. **Enable live mode** - Settings → Trading Mode → Enable Live
4. **Start small** - Begin with small position sizes

## Tips for Paper Trading

- ✅ Trade as if it's real money
- ✅ Follow proper position sizing
- ✅ Track your win/loss ratio
- ✅ Test for at least 2 weeks
- ❌ Don't over-leverage
- ❌ Don't ignore stop losses`,
    view_count: 0,
  },
  {
    id: '3',
    slug: 'dashboard-overview',
    title: 'Dashboard Overview',
    category: 'getting-started',
    excerpt: 'Understanding your PolyParlay dashboard.',
    content: `# Dashboard Overview

Your dashboard is the command center for all trading activities.

## Main Dashboard Sections

### 1. Portfolio Summary (Top)
- **Total Balance** - Combined value across all platforms
- **Today's P&L** - Profit/loss for current day
- **Open Positions** - Number of active trades
- **Win Rate** - Percentage of profitable trades

### 2. Live Trading Ticker
The scrolling ticker at top shows recent trades happening on the platform.

### 3. Quick Stats Cards
- **Trades Today** - Number of trades executed
- **Best Strategy** - Your top performing strategy
- **Active Strategies** - Strategies currently running

### 4. Position Overview
View your current holdings:
- Market/Asset name
- Entry price
- Current price
- P&L percentage
- Platform (Polymarket, Kalshi, etc.)

### 5. Recent Activity
Timeline of:
- Trade executions
- Strategy signals
- Important notifications

## Navigation Menu

### Dashboard Section
- **Overview** - Main dashboard (you are here)
- **Analytics** - Detailed performance metrics
- **Notifications** - Alerts and updates

### Trading Section
- **Markets** - Browse available prediction markets
- **My Trades** - Your positions and history
- **Watchlist** - Markets you're tracking
- **Parlay Builder** - Combine multiple predictions
- **Backtesting** - Test strategies on historical data

### Research Section
- **News Feed** - Market-moving news
- **AI Insights** - AI-generated analysis (Pro+)
- **Whale Tracker** - Follow big traders (Elite)
- **Congress Tracker** - Congressional trades (Elite)

### Portfolio Section
- **Balances** - Balance breakdown by platform
- **Trade History** - Complete trade log
- **P&L Dashboard** - Profit/loss analytics
- **Tax Center** - Tax reports (Elite)

### Automation Section
- **Strategies** - Enable/configure trading strategies
- **Workflows** - Strategy documentation
- **Strategy Builder** - Create custom strategies (Elite)

### Settings Section
- **Settings** - Account preferences
- **API Keys** - Platform connections
- **Team** - Team management
- **Pricing** - Subscription plans
- **Help Center** - Documentation (you are here)`,
    view_count: 0,
  },
  // ========================================
  // INTEGRATIONS
  // ========================================
  {
    id: '4',
    slug: 'connecting-polymarket',
    title: 'Connecting Polymarket',
    category: 'integrations',
    excerpt: 'Step-by-step guide to connect your Polymarket account.',
    content: `# Connecting Polymarket

Polymarket is the largest prediction market platform. Here's how to connect it.

## Prerequisites

1. A Polymarket account at [polymarket.com](https://polymarket.com)
2. USDC tokens on Polygon network
3. A crypto wallet (MetaMask, WalletConnect, etc.)

## Getting Your API Credentials

### Option 1: Use Embedded Wallet (Recommended)
1. In PolyParlay, go to **Settings → API Keys → Polymarket**
2. Click "Create Embedded Wallet"
3. We'll generate a secure wallet for you
4. Transfer USDC to this wallet address

### Option 2: Use Your Own Wallet
1. Export your wallet's private key from MetaMask:
   - Click account icon → Settings → Security
   - Export Private Key
2. In PolyParlay, go to **Settings → API Keys → Polymarket**
3. Enter your:
   - **Wallet Address** - Your Polygon address
   - **Private Key** - Keep this secret!

## Testing the Connection

1. After saving, click "Test Connection"
2. You should see your USDC balance
3. Try a small paper trade to confirm

## Funding Your Polymarket Wallet

1. Buy USDC on Coinbase/Kraken
2. Send USDC to Polygon network
3. Your wallet address will receive it
4. PolyParlay will detect the balance

## Important Notes

- **Fees**: Polymarket has 0% trading fees!
- **Settlement**: Markets settle in USDC
- **Network**: Uses Polygon (MATIC for gas)
- **Minimum**: No minimum trade size

## Troubleshooting

**"Invalid private key" error**
- Make sure you're using the correct format
- Private keys start with "0x..."

**Balance showing 0**
- Ensure USDC is on Polygon (not Ethereum)
- Wait a few minutes for sync

**Trades not executing**
- Check you have enough MATIC for gas
- Verify the market is still active`,
    view_count: 0,
  },
  {
    id: '5',
    slug: 'connecting-kalshi',
    title: 'Connecting Kalshi',
    category: 'integrations',
    excerpt: 'Step-by-step guide to connect your Kalshi account.',
    content: `# Connecting Kalshi

Kalshi is a regulated US prediction market. Here's how to connect it.

## Prerequisites

1. US residency (Kalshi is US-only for live trading)
2. A Kalshi account at [kalshi.com](https://kalshi.com)
3. Completed KYC verification
4. Funded account ($1 minimum)

## Getting Your API Credentials

1. Log in to [kalshi.com](https://kalshi.com)
2. Go to **Settings → API Keys**
3. Click "Generate API Key"
4. Save both:
   - **API Key** (public)
   - **Private Key** (keep secret!)

## Adding to PolyParlay

1. Go to **Settings → API Keys → Kalshi**
2. Enter your API Key
3. Enter your Private Key
4. Click "Save"
5. Click "Test Connection" to verify

## Understanding Kalshi Fees

Unlike Polymarket, Kalshi has fees:

| Action | Fee |
|--------|-----|
| Buying | 0% |
| Winning trade | 7% of profit |
| Losing trade | 0% |

**Example**: You buy YES at $0.40, it wins:
- Payout: $1.00
- Profit before fee: $0.60
- Fee (7%): $0.042
- Net profit: $0.558

## Important Notes

- **Regulation**: Kalshi is CFTC-regulated
- **Limits**: May have position limits on some markets
- **Settlement**: Same-day for most markets
- **Hours**: 24/7 for most markets

## Popular Kalshi Markets

- Weather (temperature, rain, snow)
- Fed interest rate decisions
- Economic indicators (GDP, CPI, NFP)
- Bitcoin price brackets
- Sports/Entertainment

## Troubleshooting

**"Unauthorized" error**
- Regenerate your API keys on Kalshi
- Make sure no extra spaces in keys

**"Insufficient balance"**
- Deposit more funds on kalshi.com
- Check available (not locked) balance

**"Market not found"**
- Some markets close before resolution
- Check market is still active on kalshi.com`,
    view_count: 0,
  },
  {
    id: '6',
    slug: 'connecting-alpaca',
    title: 'Connecting Alpaca (Stocks)',
    category: 'integrations',
    excerpt: 'Connect Alpaca for commission-free stock trading.',
    content: `# Connecting Alpaca (Stocks)

Alpaca provides commission-free stock trading. Here's how to connect.

## Prerequisites

1. Alpaca account at [alpaca.markets](https://alpaca.markets)
2. Either Paper Trading or Live account

## Getting Your API Credentials

1. Log in to [alpaca.markets](https://alpaca.markets)
2. Go to **Paper Trading** (or Live if approved)
3. Click **API Keys** in the sidebar
4. Click "Generate New Key"
5. Copy both:
   - **API Key ID**
   - **Secret Key** (only shown once!)

## Adding to PolyParlay

1. Go to **Settings → API Keys → Alpaca**
2. Choose environment:
   - **Paper** - For testing (recommended first)
   - **Live** - For real trading
3. Enter your API Key ID
4. Enter your Secret Key
5. Click "Save"
6. Click "Test Connection"

## Paper vs Live Trading

### Paper Trading (Free)
- Virtual $100,000 balance
- Real market data
- Practice without risk
- No PDT restrictions

### Live Trading (Requires Approval)
- Real money
- Commission-free trades
- Market & limit orders
- $25,000+ for unlimited day trades (PDT rule)

## Supported Features

✅ Market orders
✅ Limit orders
✅ Stop orders
✅ Fractional shares
✅ Extended hours trading
✅ Real-time quotes
✅ Historical data

## Stock Strategies on PolyParlay

With Alpaca connected, you can use:

- **Congressional Tracker** - Mirror Congress trades
- **RSI Strategy** - Mean reversion
- **Stock Momentum** - Trend following
- **Sector Rotation** - ETF rotation
- **Dividend Growth** - Income investing
- **Earnings Momentum** - Post-earnings drift

## Troubleshooting

**"Invalid credentials"**
- Make sure you're using the right environment
- Paper and Live have different API keys

**"Account not active"**
- Paper: Should work immediately
- Live: Wait for approval email

**"Pattern day trader" error**
- Only applies to live accounts
- Need $25K+ to day trade
- Or wait for settled funds`,
    view_count: 0,
  },
  {
    id: '7',
    slug: 'connecting-crypto',
    title: 'Connecting Crypto Exchanges',
    category: 'integrations',
    excerpt: 'Connect Binance, Coinbase, Kraken, Hyperliquid, and other crypto exchanges.',
    content: `# Connecting Crypto Exchanges

PolyParlay supports major crypto exchanges for automated trading.

## Supported Exchanges

| Exchange | Trading | Funding Rate Arb | Grid Trading |
|----------|---------|------------------|--------------|
| Hyperliquid | ✅ | ✅ | ✅ |
| Binance | ✅ | ✅ | ✅ |
| Coinbase | ✅ | ❌ | ✅ |
| Kraken | ✅ | ❌ | ✅ |
| KuCoin | ✅ | ✅ | ✅ |
| Bybit | ✅ | ✅ | ✅ |
| OKX | ✅ | ✅ | ✅ |

## General Setup Steps

1. Create account on your exchange
2. Complete KYC (usually required for API access)
3. Enable 2FA for security
4. Generate API keys with trading permissions
5. Add keys to PolyParlay

## ⚡ Hyperliquid Setup (Recommended!)

Hyperliquid is a **decentralized exchange** with:
- **Zero gas fees** for trading
- **Sub-second latency** (~200ms)
- **No KYC required** - just connect wallet
- **API wallets** for secure bot trading

### Setup Steps:

1. Go to [app.hyperliquid.xyz](https://app.hyperliquid.xyz)
2. Connect your Ethereum wallet (MetaMask, etc.)
3. Deposit USDC via Arbitrum bridge
4. Create an **API Wallet** (Settings → API):
   - This wallet can trade but NOT withdraw
   - Perfect for bot security
5. Add to PolyParlay:
   - Settings → Secrets → HYPERLIQUID_WALLET_ADDRESS
   - Settings → Secrets → HYPERLIQUID_PRIVATE_KEY (or API wallet key)

### Why Hyperliquid?

- Grid trading is **extremely profitable** (no fees eating your margins!)
- Funding rate arbitrage works just like CEXs
- Whale tracking shows top DEX traders
- Testnet available for practice

## Binance Setup

1. Go to [binance.com](https://binance.com) → API Management
2. Create new API key
3. Enable permissions:
   - ✅ Enable Reading
   - ✅ Enable Spot Trading
   - ✅ Enable Futures Trading (for arb)
   - ❌ Enable Withdrawals (NOT needed)
4. Add IP restriction if possible
5. Add to PolyParlay: Settings → API Keys → Binance

## Coinbase Setup

1. Go to [coinbase.com](https://coinbase.com) → Settings → API
2. Create new API key
3. Select permissions:
   - ✅ View accounts
   - ✅ Trade
   - ❌ Transfer (NOT needed)
4. Add to PolyParlay: Settings → API Keys → Coinbase

## Security Best Practices

🔒 **DO**:
- Enable IP whitelisting
- Use unique API keys for PolyParlay
- Enable 2FA on exchange
- Rotate keys periodically
- Use **API Wallets** on Hyperliquid

🚫 **DON'T**:
- Enable withdrawal permissions
- Share your secret keys
- Use the same keys elsewhere
- Store keys in plain text

## Crypto Strategies Available

With crypto exchanges connected:

- **Funding Rate Arb** - Delta-neutral funding collection (15-50% APY)
- **Grid Trading** - Profit from sideways markets (20-60% APY)
- **Pairs Trading** - Statistical arbitrage (10-25% APY)
- **15-Min Scalping** - High-frequency BTC trading

## Troubleshooting

**"API key invalid"**
- Keys expire on some exchanges
- Regenerate if in doubt

**"Insufficient permissions"**
- Check trading is enabled on the API key
- Futures requires separate permission

**"IP not allowed"**
- Add PolyParlay's IP to whitelist
- Or disable IP restriction temporarily`,
    view_count: 0,
  },
  {
    id: 'platforms-reference',
    slug: 'platforms-reference',
    title: 'Complete Platform Integration Reference',
    category: 'integrations',
    excerpt: 'Comprehensive guide to all 12 supported trading platforms with detailed setup instructions, features, fees, and troubleshooting.',
    content: `# Complete Platform Integration Reference

PolyParlay supports **12 trading platforms** for automated trading. For the comprehensive guide, see [Full Platform Documentation](/docs/platforms-reference.md).

## Quick Platform Overview

| Platform | Type | Fees | US Legal | Best For |
|----------|------|------|----------|----------|
| **Polymarket** | Prediction Market | 0% | Yes | Political/Sports |
| **Kalshi** | Prediction Market | 7% profit | ✅ | Weather/Economics |
| **Hyperliquid** ⭐ | Crypto DEX | 0% maker | ✅ | Grid Trading, Perps |
| **Binance** | Crypto CEX | 0.1% | ⚠️ US | High Liquidity |
| **Coinbase** | Crypto CEX | 0.5% | ✅ | US Compliance |
| **Kraken** | Crypto CEX | 0.16% | ✅ | Security |
| **KuCoin** | Crypto CEX | 0.1% | ⚠️ | Altcoins |
| **Bybit** | Crypto CEX | 0.1% | ❌ US | Derivatives |
| **OKX** | Crypto CEX | 0.08% | ⚠️ | All-in-One |
| **Alpaca** | Stock Broker | $0 | ✅ | Algo Trading |
| **IBKR** | Multi-Asset | ~$1 | ✅ | Professional |
| **Webull** | Stock Broker | $0 | ✅ | Casual Trading |

## ⭐ Recommended Platforms to Start

### For Crypto Trading: **Hyperliquid**
- Zero maker fees (grid trading is extremely profitable!)
- No KYC required
- API wallets for security (can trade, can't withdraw)
- Built on Arbitrum

### For Stock Trading: **Alpaca**
- Commission-free
- Excellent API
- Paper trading with $100K virtual balance
- No minimum deposit

### For Prediction Markets: **Polymarket**
- Zero fees
- Deepest liquidity
- 24/7 trading

## Security Best Practices

1. **Never enable withdrawal permissions** - PolyParlay doesn't need them
2. **Use IP whitelisting** where available
3. **Use API Wallets on Hyperliquid** - they can't withdraw
4. **Rotate keys periodically** - every 90 days recommended
5. **Enable 2FA** on all exchange accounts

## Platform Not Configured?

If a platform isn't configured, the bot **gracefully skips it** - no errors, just a log message. You only need to configure platforms you want to use.

## More Details

See the full documentation for each platform:
- [Polymarket Setup](/help?article=connecting-polymarket)
- [Kalshi Setup](/help?article=connecting-kalshi)
- [Alpaca Setup](/help?article=connecting-alpaca)
- [Crypto Exchanges](/help?article=connecting-crypto)

Or view the [Complete Platform Documentation](/docs/platforms-reference.md) for detailed setup guides with screenshots.`,
    view_count: 0,
  },
  {
    id: '8',
    slug: 'tradingview-webhook',
    title: 'TradingView Webhook Integration',
    category: 'integrations',
    excerpt: 'Connect TradingView alerts to trigger trades on PolyParlay.',
    content: `# TradingView Webhook Integration

Execute trades automatically when TradingView alerts fire.

## What This Does

- TradingView sends alert → PolyParlay executes trade
- Works with any TradingView strategy/indicator
- Supports stocks, crypto, prediction markets

## Setup Steps

### 1. Get Your Webhook URL

Your webhook URL is:
\`\`\`
https://polyparlay.io/api/webhooks/tradingview
\`\`\`

### 2. Create Alert in TradingView

1. Open TradingView chart
2. Add your indicator/strategy
3. Right-click → "Add Alert"
4. Configure:
   - **Condition**: Your signal (e.g., RSI crosses below 30)
   - **Webhook URL**: Paste the URL above

### 3. Set Alert Message (JSON)

Use this format in the "Message" field:

\`\`\`json
{
  "symbol": "{{ticker}}",
  "action": "buy",
  "price": {{close}},
  "exchange": "alpaca",
  "strategy": "my-rsi-strategy"
}
\`\`\`

### Message Fields

| Field | Required | Description |
|-------|----------|-------------|
| symbol | ✅ | Ticker (AAPL, BTC-USD, etc.) |
| action | ✅ | "buy", "sell", or "close" |
| price | ❌ | Entry price (for logging) |
| exchange | ❌ | Target exchange (alpaca, binance) |
| strategy | ❌ | Strategy name for tracking |
| quantity | ❌ | Number of shares/contracts |
| take_profit | ❌ | TP price |
| stop_loss | ❌ | SL price |

### Example: RSI Buy Signal

\`\`\`json
{
  "symbol": "AAPL",
  "action": "buy",
  "price": {{close}},
  "exchange": "alpaca",
  "strategy": "rsi-oversold",
  "quantity": 10,
  "stop_loss": {{close * 0.95}},
  "take_profit": {{close * 1.10}}
}
\`\`\`

### Example: Crypto Sell Signal

\`\`\`json
{
  "symbol": "BTC-USD",
  "action": "sell",
  "exchange": "coinbase",
  "strategy": "macd-crossover"
}
\`\`\`

## Viewing Signals

Go to **Admin → TradingView Signals** to see:
- All received signals
- Execution status
- Error messages if any

## Troubleshooting

**Signals not arriving**
- Check webhook URL is exact
- TradingView Premium required for webhooks
- Test with simple alert first

**Signals not executing**
- Verify exchange API keys are set
- Check you have sufficient balance
- Ensure symbol format matches exchange

**Testing Your Webhook**

Use this curl command to test:

\`\`\`bash
curl -X POST https://polyparlay.io/api/webhooks/tradingview \\
  -H "Content-Type: application/json" \\
  -d '{"symbol":"TEST","action":"buy"}'
\`\`\`

Should return: \`{"success":true}\``,
    view_count: 0,
  },
  // ========================================
  // STRATEGIES
  // ========================================
  {
    id: '9',
    slug: 'strategies-overview',
    title: 'Trading Strategies Overview',
    category: 'strategies',
    excerpt: 'Overview of all 25+ automated trading strategies.',
    content: `# Trading Strategies Overview

PolyParlay offers 25+ automated trading strategies across multiple asset classes.

## Strategy Categories

### 🎯 Prediction Market Strategies
Trade on Polymarket and Kalshi prediction markets.

| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| Single-Platform Arb | 95% | 50-200% APY |
| Cross-Platform Arb | 90% | 30-100% APY |
| Market Making | 85% | 10-20% APY |
| News Arbitrage | 75% | 5-30%/event |
| BTC Bracket Arb | 85% | High |
| Political Event | 80% | Event-based |

### 💰 Crypto Strategies
Automated crypto trading on major exchanges.

| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| Funding Rate Arb | 85% | 15-50% APY |
| Grid Trading | 75% | 20-60% APY |
| Pairs Trading | 65% | 10-25% APY |
| 15-Min Scalping | 90% | 30-80% APY |

### 📈 Stock Strategies
US stock market strategies via Alpaca.

| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| Congressional Tracker | 75% | 15-30% APY |
| RSI Strategy | 70% | 15-30% APY |
| Stock Momentum | 70% | 20-40% APY |
| Sector Rotation | 70% | 15-25% APY |
| Dividend Growth | 65% | 10-20% APY |
| Earnings Momentum | 70% | 20-40% APY |

### 📝 Options Strategies (IBKR Required)

| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| Covered Calls | 75% | 15-25% APY |
| Cash Secured Puts | 75% | 15-25% APY |
| Iron Condor | 70% | 20-30% APY |
| Wheel Strategy | 80% | 20-35% APY |

## Enabling Strategies

1. Go to **Automation → Strategies**
2. Find the strategy you want
3. Click the toggle to enable
4. Configure parameters (optional)
5. Click "Save"

## Risk Levels Explained

- **Low Risk** 🟢 - Market neutral, minimal directional exposure
- **Medium Risk** 🟡 - Some directional exposure, managed sizing
- **High Risk** 🔴 - Significant directional exposure, higher volatility

## Position Sizing

Each strategy has configurable position sizing:
- **Max Position %** - Maximum % of portfolio per trade
- **Max Position USD** - Hard dollar cap per trade
- **Kelly Fraction** - Automatic sizing based on win rate

## Best Practices

1. ✅ Start with 1-2 strategies
2. ✅ Use paper trading first
3. ✅ Set conservative position sizes
4. ✅ Monitor performance weekly
5. ❌ Don't enable everything at once
6. ❌ Don't use leverage until experienced`,
    view_count: 0,
  },
  {
    id: '10',
    slug: 'arbitrage-strategies',
    title: 'Arbitrage Strategies Explained',
    category: 'strategies',
    excerpt: 'Learn how our zero-risk arbitrage strategies work.',
    content: `# Arbitrage Strategies Explained

Arbitrage means profiting from price differences without directional risk.

## Single-Platform Arbitrage (95% Confidence)

### How It Works

On Polymarket/Kalshi, every market has YES and NO outcomes.
- YES + NO should equal $1.00
- Sometimes they add up to less (mispricing!)

**Example:**
- Trump wins 2024: YES = $0.48
- Trump wins 2024: NO = $0.48
- Total: $0.96 (you pay $0.96, get $1.00)
- **Profit: $0.04 (4.2%) guaranteed**

### Why Mispricings Occur

1. Large trades moving prices
2. News causing panic buying/selling
3. Market maker inventory imbalances
4. Low liquidity markets

### Configuration

\`\`\`
poly_single_min_profit_pct = 0.5%   (minimum edge to trade)
poly_single_max_position_usd = 500  (max per opportunity)
kalshi_single_min_profit_pct = 8%   (needs >7% for fees)
\`\`\`

## Cross-Platform Arbitrage (90% Confidence)

### How It Works

Same event priced differently on Polymarket vs Kalshi.

**Example:**
- Fed rate cut - Polymarket YES: $0.30
- Fed rate cut - Kalshi NO: $0.60
- You buy YES on Poly ($0.30) + YES on Kalshi implied ($0.40)
- Total: $0.70 → get $1.00 = **$0.30 profit**

### Challenges

- Different market descriptions (fuzzy matching needed)
- Settlement timing differences
- Kalshi's 7% fee on profits
- Limited liquidity on some markets

### Configuration

\`\`\`
cross_platform_min_profit_pct = 10%  (need to cover fees)
cross_platform_max_position_usd = 1000
\`\`\`

## Funding Rate Arbitrage (85% Confidence)

### How It Works

Crypto perpetual futures pay/receive funding every 8 hours.
- Long pays short when funding positive
- Short pays long when funding negative

**Delta-Neutral Setup:**
1. Long 1 BTC on spot ($50,000)
2. Short 1 BTC on perp ($50,000)
3. Collect funding (0.01-0.05% every 8h)
4. **APY: 15-50% with zero price risk**

### Configuration

\`\`\`
fra_min_funding_rate = 0.01%  (minimum rate to trade)
fra_position_size_pct = 10%   (% of portfolio)
fra_symbols = ["BTC/USDT", "ETH/USDT"]
\`\`\`

## Tips for Arbitrage

1. ✅ Act fast - opportunities close quickly
2. ✅ Use limit orders when possible
3. ✅ Account for all fees
4. ✅ Start small to test execution
5. ❌ Don't chase tiny edges (<0.5%)
6. ❌ Don't ignore slippage on large sizes`,
    view_count: 0,
  },
  {
    id: '11',
    slug: 'congressional-tracker',
    title: 'Congressional Tracker Strategy',
    category: 'strategies',
    excerpt: 'Copy trades from US Congress members.',
    content: `# Congressional Tracker Strategy

Mirror stock trades made by US Congress members.

## Why Follow Congress?

Research shows Congress members significantly outperform the market:
- **Senators**: +12.3% vs S&P 500 annually (2004-2010 study)
- **Information advantage**: They often trade before major policy changes
- **Public data**: STOCK Act requires 45-day disclosure

## How It Works

1. We monitor House/Senate Stock Watcher APIs
2. Detect new trades as they're disclosed
3. Filter for significant trades ($15K+)
4. Execute mirror trades on your behalf
5. Track performance vs benchmark

## Data Sources

- **House Stock Watcher** - house-stock-watcher-data.s3-us-west-2.amazonaws.com
- **Senate Stock Watcher** - senate-stock-watcher-data.s3-us-west-2.amazonaws.com
- **Capitol Trades** - Alternative data provider

## Configuration

\`\`\`
enable_congressional_tracker = true
congressional_min_trade_value = $15,000  (filter small trades)
congressional_follow_delay_hours = 24    (wait before copying)
congressional_exclude_members = []       (blacklist bad performers)
\`\`\`

## Notable Congress Traders

Based on historical performance:

| Member | Avg Return | Win Rate |
|--------|------------|----------|
| Nancy Pelosi | +65% | 73% |
| Dan Crenshaw | +52% | 68% |
| Pat Fallon | +45% | 70% |

*Past performance doesn't guarantee future results*

## Viewing Congress Trades

Go to **Research → Congress Tracker** to see:
- Recent disclosures
- Trade details (buy/sell, amount, date)
- Member trading history
- Your mirror positions

## Limitations

- **45-day delay** - Required by STOCK Act
- **Not real-time** - We get data after disclosure
- **No options** - Complex options harder to mirror
- **Partial info** - Range values, not exact amounts

## Risk Considerations

- Congress doesn't always outperform
- Individual trades can lose money
- Past performance ≠ future results
- Diversify across multiple members`,
    view_count: 0,
  },
  // ========================================
  // BILLING
  // ========================================
  {
    id: '12',
    slug: 'billing',
    title: 'Billing & Subscriptions',
    category: 'billing',
    excerpt: 'Manage your subscription and billing information.',
    content: `# Billing & Subscriptions

## Subscription Plans

### Free Tier - $0/month
- ✅ Unlimited paper trading
- ✅ 3 basic strategies
- ✅ Dashboard & analytics
- ✅ Discord community
- ❌ Live trading

### Pro - $29/month
- ✅ Everything in Free
- ✅ 1,000 live trades/month
- ✅ All 25+ strategies
- ✅ AI market insights
- ✅ Whale signals
- ✅ Email support

### Elite - $99/month
- ✅ Everything in Pro
- ✅ Unlimited live trades
- ✅ Whale tracker
- ✅ Congress tracker
- ✅ Tax reports
- ✅ Strategy builder
- ✅ Priority support
- ✅ API access

## Managing Your Subscription

### Upgrading
1. Go to **Settings → Pricing**
2. Click "Upgrade" on desired plan
3. Enter payment info (Stripe)
4. Access unlocked immediately

### Downgrading
1. Go to **Settings → Subscription**
2. Click "Change Plan"
3. Select lower tier
4. Access continues until billing period ends

### Canceling
1. Go to **Settings → Subscription**
2. Click "Cancel Subscription"
3. Access continues until billing period ends
4. Data retained for 30 days

## Payment Methods

- Credit cards (Visa, Mastercard, Amex)
- Debit cards
- Some international cards

## Billing FAQ

**When am I charged?**
Monthly on the anniversary of your signup date.

**What if my payment fails?**
We'll retry 3 times over 5 days. Then downgrade to Free.

**Do you offer refunds?**
Yes, prorated refunds within 7 days of charge.

**Do you offer annual billing?**
Coming soon! (2 months free)

**Can I get a receipt?**
Settings → Billing → Download Invoice`,
    view_count: 0,
  },
  // ========================================
  // FAQ
  // ========================================
  {
    id: '13',
    slug: 'faq',
    title: 'Frequently Asked Questions',
    category: 'faq',
    excerpt: 'Common questions and answers.',
    content: `# Frequently Asked Questions

## General

**What is PolyParlay?**
PolyParlay is an automated trading platform for prediction markets (Polymarket, Kalshi) and traditional markets (stocks, crypto). We help you trade smarter with 25+ algorithmic strategies.

**Is PolyParlay legal?**
Yes! We're a software platform that helps you trade on legal exchanges. Polymarket operates internationally, Kalshi is CFTC-regulated in the US.

**How much does it cost?**
- **Free**: Unlimited paper trading
- **Pro ($29/mo)**: 1,000 live trades
- **Elite ($99/mo)**: Unlimited trading + all features

**Do I need to know how to code?**
No! Everything is configured through our visual interface. No coding required.

## Trading

**How does paper trading work?**
Paper trading uses real market prices but simulated money. Your trades are tracked but not actually executed. Great for learning risk-free.

**What's the minimum to start live trading?**
It depends on the platform:
- Polymarket: ~$5 (need USDC + MATIC for gas)
- Kalshi: $1 minimum
- Alpaca: No minimum
- Crypto: Varies by exchange

**Are the returns guaranteed?**
No. Past performance doesn't guarantee future results. Only arbitrage strategies have theoretically guaranteed returns, but execution risk exists.

**Can I lose money?**
Yes, on directional strategies. Arbitrage strategies are lower risk but not risk-free. Always start with paper trading.

## Platforms

**Do I need accounts on Polymarket/Kalshi?**
Yes, you need your own accounts. We connect via API keys - we never hold your funds.

**Can I use PolyParlay internationally?**
- Polymarket: Yes (except US residents)
- Kalshi: US only
- Stocks: Depends on your broker
- Crypto: Most countries

**What happens if Polymarket/Kalshi goes down?**
We detect platform issues and pause trading. Your funds remain on the exchange.

## Technical

**Is my data secure?**
Yes. We use Supabase with row-level security. API keys are encrypted. We never store your exchange passwords.

**Why isn't my trade executing?**
Common reasons:
1. API keys expired or invalid
2. Insufficient balance
3. Market closed or delisted
4. Bot paused or strategy disabled

**How do I reset my simulation?**
Settings → Simulation → Reset Simulation Data

## Support

**How do I get help?**
- This Help Center
- Chat widget (bottom right)
- Email: support@polyparlay.io
- Discord community

**What are your support hours?**
Email: 24-48 hour response
Chat: Business hours (PST)
Discord: Community 24/7`,
    view_count: 0,
  },
  // ========================================
  // STRATEGY TIERS (NEW)
  // ========================================
  {
    id: '14',
    slug: 'strategy-tiers',
    title: 'Strategies by Plan Tier',
    category: 'strategies',
    excerpt: 'Complete list of strategies available in Free, Pro, and Elite plans.',
    content: `# Strategies by Plan Tier

See exactly which strategies are included in each subscription tier.

---

## 🆓 Free Tier - $0/month

**Paper Trading Only** - No live trading, but full simulation with real data.

### Included Strategies (3)

| Strategy | Type | Description |
|----------|------|-------------|
| **RSI Strategy** | Stocks | Buy oversold, sell overbought based on RSI |
| **Grid Trading** | Crypto | Place buy/sell orders at intervals |
| **Paper Arbitrage** | Prediction | Practice arbitrage detection (paper only) |

### Free Tier Limits
- ❌ No live trading
- ✅ Unlimited paper trades
- ✅ Real-time market data
- ✅ Full analytics dashboard
- ✅ Up to 3 strategies active

---

## 💼 Pro Tier - $29/month

**Live Trading Unlocked** - Execute real trades across all platforms.

### All Free Strategies PLUS:

#### Prediction Market Strategies (6)
| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| **Single-Platform Arbitrage** | 95% | 50-200% APY |
| **Cross-Platform Arbitrage** | 90% | 30-100% APY |
| **Market Making** | 85% | 10-20% APY |
| **News Arbitrage** | 75% | 5-30%/event |
| **BTC Bracket Arbitrage** | 85% | Variable |
| **Political Event Trading** | 80% | Event-based |

#### Crypto Strategies (4)
| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| **Funding Rate Arbitrage** | 85% | 15-50% APY |
| **15-Min Scalping** | 90% | 30-80% APY |
| **Pairs Trading** | 65% | 10-25% APY |
| **Grid Trading Pro** | 75% | 20-60% APY |

#### Stock Strategies (5)
| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| **RSI Strategy Pro** | 70% | 15-30% APY |
| **Stock Momentum** | 70% | 20-40% APY |
| **Sector Rotation** | 70% | 15-25% APY |
| **Dividend Growth** | 65% | 10-20% APY |
| **Earnings Momentum** | 70% | 20-40% APY |

### Pro Tier Limits
- ✅ 1,000 live trades/month
- ✅ All 18 strategies above
- ✅ AI Market Insights
- ✅ Whale Signal Alerts
- ✅ Email support

---

## 👑 Elite Tier - $99/month

**Unlimited Everything** - Full platform access with premium features.

### All Pro Strategies PLUS:

#### Elite-Only Strategies (7)
| Strategy | Confidence | Expected Return |
|----------|------------|-----------------|
| **Congressional Tracker** | 75% | 15-30% APY |
| **Whale Copy Trading** | 70% | Variable |
| **Liquidation Sniper** | 80% | 20-50%/event |
| **Multi-Leg Arbitrage** | 85% | 40-100% APY |
| **Options: Covered Calls** | 75% | 15-25% APY |
| **Options: Iron Condor** | 70% | 20-30% APY |
| **Options: Wheel Strategy** | 80% | 20-35% APY |

#### Elite-Only Features
| Feature | Description |
|---------|-------------|
| **Strategy Builder** | Create your own custom strategies |
| **Tax Center** | Automatic tax reports (8949 forms) |
| **API Access** | Programmatic access to your data |
| **Priority Support** | <4 hour response time |
| **Dedicated Slack** | Direct channel with our team |

### Elite Tier Limits
- ✅ **Unlimited** live trades
- ✅ All 25+ strategies
- ✅ Priority support
- ✅ Custom strategies
- ✅ Full API access

---

## Plan Comparison Summary

| Feature | Free | Pro | Elite |
|---------|------|-----|-------|
| **Price** | $0 | $29/mo | $99/mo |
| **Paper Trading** | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| **Live Trades** | ❌ | 1,000/mo | Unlimited |
| **Strategies** | 3 | 18 | 25+ |
| **AI Insights** | ❌ | ✅ | ✅ |
| **Whale Tracker** | ❌ | Alerts only | Full access |
| **Congress Tracker** | ❌ | ❌ | ✅ |
| **Tax Reports** | ❌ | ❌ | ✅ |
| **Strategy Builder** | ❌ | ❌ | ✅ |
| **Support** | Community | Email | Priority |

---

## Upgrading Your Plan

1. Go to **Settings → Pricing**
2. Select your desired plan
3. Enter payment information
4. New features unlock **immediately**

## Questions?

- **Can I try Pro before paying?** Yes! Paper trading shows you how all strategies work before going live.
- **Do I lose my data if I downgrade?** No, your history is preserved. Strategies just pause.
- **Annual discount?** Coming soon - save 2 months!`,
    view_count: 0,
  },
  // ========================================
  // FEATURES BY PLAN
  // ========================================
  {
    id: '15',
    slug: 'features-by-plan',
    title: 'Features by Plan',
    category: 'billing',
    excerpt: 'Complete breakdown of features included in each subscription plan.',
    content: `# Features by Plan

Detailed comparison of what's included in each PolyParlay subscription.

---

## Dashboard & Analytics

| Feature | Free | Pro | Elite |
|---------|:----:|:---:|:-----:|
| Main Dashboard | ✅ | ✅ | ✅ |
| P&L Tracking | ✅ | ✅ | ✅ |
| Trade History | ✅ | ✅ | ✅ |
| Strategy Performance | ✅ | ✅ | ✅ |
| Advanced Analytics | ❌ | ✅ | ✅ |
| Export to CSV | ❌ | ✅ | ✅ |

---

## Trading

| Feature | Free | Pro | Elite |
|---------|:----:|:---:|:-----:|
| Paper Trading | Unlimited | Unlimited | Unlimited |
| Live Trading | ❌ | 1,000/mo | Unlimited |
| Polymarket | Paper only | ✅ | ✅ |
| Kalshi | Paper only | ✅ | ✅ |
| Alpaca Stocks | Paper only | ✅ | ✅ |
| Crypto Exchanges | Paper only | ✅ | ✅ |
| IBKR Options | ❌ | ❌ | ✅ |

---

## Strategies

| Feature | Free | Pro | Elite |
|---------|:----:|:---:|:-----:|
| Basic Strategies | 3 | All | All |
| Arbitrage Strategies | Paper only | ✅ | ✅ |
| Crypto Strategies | Paper only | ✅ | ✅ |
| Stock Strategies | Paper only | ✅ | ✅ |
| Options Strategies | ❌ | ❌ | ✅ |
| Congressional Tracker | ❌ | ❌ | ✅ |
| Strategy Builder | ❌ | ❌ | ✅ |

---

## Research & Insights

| Feature | Free | Pro | Elite |
|---------|:----:|:---:|:-----:|
| News Feed | ✅ | ✅ | ✅ |
| Market Browser | ✅ | ✅ | ✅ |
| AI Market Insights | ❌ | ✅ | ✅ |
| Whale Signals | ❌ | Alerts | Full |
| Congress Tracker | ❌ | ❌ | ✅ |
| Sentiment Analysis | ❌ | ✅ | ✅ |

---

## Automation

| Feature | Free | Pro | Elite |
|---------|:----:|:---:|:-----:|
| Scheduled Trading | ❌ | ✅ | ✅ |
| TradingView Webhooks | ❌ | ✅ | ✅ |
| Auto-Rebalancing | ❌ | ✅ | ✅ |
| Custom Workflows | ❌ | ❌ | ✅ |
| API Access | ❌ | ❌ | ✅ |

---

## Support & Extras

| Feature | Free | Pro | Elite |
|---------|:----:|:---:|:-----:|
| Help Center | ✅ | ✅ | ✅ |
| Discord Community | ✅ | ✅ | ✅ |
| Email Support | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |
| Dedicated Slack | ❌ | ❌ | ✅ |
| Tax Reports | ❌ | ❌ | ✅ |
| Referral Bonuses | ❌ | ✅ | 2x |

---

## Ready to Upgrade?

[View Pricing →](/pricing)`,
    view_count: 0,
  },
  // ========================================
  // SEO ARTICLES - PREDICTION MARKETS
  // ========================================
  {
    id: '16',
    slug: 'what-is-prediction-market-arbitrage',
    title: 'What is Prediction Market Arbitrage?',
    category: 'strategies',
    excerpt: 'Learn how arbitrage works in prediction markets like Polymarket and Kalshi.',
    content: `# What is Prediction Market Arbitrage?

Prediction market arbitrage is a low-risk trading strategy that exploits price differences in prediction markets to generate guaranteed profits.

## How It Works

In prediction markets, you can buy "YES" and "NO" contracts for any event:
- If you buy YES at $0.45 and the event happens, you get $1.00
- If you buy NO at $0.45 and the event doesn't happen, you get $1.00

**Arbitrage occurs when YES + NO < $1.00**

### Example:
- YES price: $0.48
- NO price: $0.49
- Total: $0.97

If you buy **both** YES and NO for $0.97, you're **guaranteed** to receive $1.00 when the market resolves (since one of them must be true). That's a **3.1% guaranteed profit**.

## Types of Prediction Market Arbitrage

### 1. Single-Platform Arbitrage
Buy both outcomes on the same platform when they're mispriced.
- Works on Polymarket (0% fees)
- Works on Kalshi (need larger spread due to 7% fees)

### 2. Cross-Platform Arbitrage
Different prices on Polymarket vs Kalshi for the same event.
- Buy the cheaper side on one platform
- Sell (or buy opposite) on the other platform
- Historical opportunity: ~$95K+ documented profits

### 3. Bracket Arbitrage
For multi-outcome markets (like "BTC price range"), if all brackets sum to less than 100%, buy all brackets.

## Real Profit Potential

Academic research on Polymarket found:
- **$40 million** extracted by arbitrageurs over 1 year
- Most profitable traders used automated bots
- Market makers earned 15-25% APY

## How PolyParlay Helps

PolyParlay automates arbitrage scanning:
- ✅ Real-time monitoring every 30 seconds
- ✅ Automatic profit calculation including fees
- ✅ Cross-platform opportunity matching
- ✅ Position sizing recommendations
- ✅ Paper trading to learn risk-free

[Get Started with Arbitrage →](/strategies)`,
    view_count: 0,
  },
  {
    id: '17',
    slug: 'polymarket-trading-bot',
    title: 'Polymarket Trading Bot: Automated Strategies',
    category: 'strategies',
    excerpt: 'How to automate your Polymarket trading with bots and strategies.',
    content: `# Polymarket Trading Bot: Automated Strategies

Learn how to automate your Polymarket trading with proven strategies and reduce emotional decision-making.

## Why Use a Polymarket Trading Bot?

Polymarket is a 24/7 prediction market. Manual trading has limitations:
- You can't watch markets while sleeping
- Emotional decisions lead to losses
- Manual arbitrage scanning is too slow
- Position sizing is often inconsistent

A trading bot solves these problems by:
- ✅ Monitoring markets 24/7
- ✅ Executing trades instantly when opportunities arise
- ✅ Following consistent rules without emotion
- ✅ Optimizing position sizes mathematically

## Best Strategies for Polymarket Bots

### 1. Single-Platform Arbitrage
**Risk: Low | Return: 50-200% APY**

Buy both YES and NO when combined < $1.00. Guaranteed profit on resolution.

### 2. Market Making
**Risk: Medium | Return: 15-25% APY**

Provide liquidity by posting buy/sell orders. Earn the spread + Polymarket rewards.

### 3. Whale Copy Trading
**Risk: Medium | Return: Varies**

Track wallets with 80%+ win rates. Copy their trades with a small delay.

### 4. News Arbitrage
**Risk: Medium | Return: 5-30% per event**

React to breaking news before markets fully adjust.

### 5. AI Superforecasting
**Risk: Medium | Return: 30-60% APY**

Use AI to estimate probabilities and trade divergences from market consensus.

## Setting Up a Polymarket Bot with PolyParlay

### Step 1: Create Account
Sign up at [polyparlay.io](/signup) - free paper trading included.

### Step 2: Connect Polymarket
You'll need:
- Polymarket wallet address
- Private key (for automated execution)
- USDC on Polygon network

### Step 3: Choose Strategies
Go to **Automation → Strategies** and enable:
- Single-Platform Arbitrage
- Market Making
- Any other strategies that fit your goals

### Step 4: Configure Settings
For each strategy, set:
- Maximum position size
- Minimum profit threshold
- Scan interval

### Step 5: Start Paper Trading
Test with simulated money first to validate performance.

## FAQ

**Q: Is this legal?**
A: Automated trading on Polymarket is allowed. However, prediction markets may have geographic restrictions.

**Q: How much capital do I need?**
A: Start with as little as $50-100 for paper trading. Real trading depends on strategy.

**Q: What are the risks?**
A: Even "low-risk" arbitrage can fail if markets don't resolve as expected. Always use proper position sizing.

[Start Your Polymarket Bot →](/signup)`,
    view_count: 0,
  },
  {
    id: '18',
    slug: 'kalshi-vs-polymarket',
    title: 'Kalshi vs Polymarket: Which is Better for Trading?',
    category: 'platforms',
    excerpt: 'Compare Kalshi and Polymarket for prediction market trading and arbitrage.',
    content: `# Kalshi vs Polymarket: Complete Comparison

Both Kalshi and Polymarket are leading prediction markets, but they serve different traders. Here's how they compare.

## Quick Comparison

| Feature | Polymarket | Kalshi |
|---------|------------|--------|
| **Fees** | 0% trading fees | ~7% total fees |
| **Regulation** | Unregulated (crypto) | CFTC-regulated |
| **US Access** | Technically restricted | Fully legal in US |
| **Liquidity** | Higher on politics/crypto | Higher on economics |
| **Settlement** | USDC on Polygon | USD (bank transfer) |
| **Markets** | Politics, Sports, Crypto | Everything + 15-min brackets |
| **API** | Yes (free) | Yes (free) |

## When to Use Polymarket

✅ **Best for:**
- International traders
- Crypto-native users
- High-frequency arbitrage (0% fees)
- Political and crypto markets
- Larger position sizes

❌ **Downsides:**
- Legally gray in US
- Crypto wallet required
- No short-term bracket markets

## When to Use Kalshi

✅ **Best for:**
- US-based traders
- Regulated, compliant trading
- 15-minute crypto bracket markets
- Economic indicator markets
- Tax reporting simplicity

❌ **Downsides:**
- ~7% fees eat into profits
- Lower liquidity on some markets
- Smaller position limits

## Arbitrage Opportunities

The fee difference creates arbitrage opportunities:

**Buying on Polymarket (0% fee):**
- Need ~2.5% spread to profit

**Buying on Kalshi (7% fee):**
- Need ~9% spread to profit

**Cross-platform arbitrage:**
- Same event, different prices
- Historical data shows $95K+ opportunities

## PolyParlay Supports Both

PolyParlay connects to both platforms:

1. **Compare prices** across platforms
2. **Find arbitrage** automatically
3. **Execute trades** on either platform
4. **Track performance** in one dashboard

[Connect Your Accounts →](/settings)`,
    view_count: 0,
  },
  {
    id: '19',
    slug: 'kelly-criterion-position-sizing',
    title: 'Kelly Criterion: Optimal Position Sizing for Trading',
    category: 'strategies',
    excerpt: 'Learn how the Kelly Criterion helps you size bets optimally for maximum growth.',
    content: `# Kelly Criterion: Optimal Position Sizing

The Kelly Criterion is a mathematical formula that tells you the optimal amount to bet to maximize long-term portfolio growth.

## The Formula

**Kelly % = W - [(1-W) / R]**

Where:
- **W** = Win probability
- **R** = Win/Loss ratio (average win / average loss)

### Example:
- Win rate: 60% (W = 0.60)
- Average win: $150, Average loss: $100 (R = 1.5)

Kelly % = 0.60 - [(1-0.60) / 1.5] = 0.60 - 0.267 = **33.3%**

This means you should bet 33.3% of your bankroll on this opportunity.

## Why Kelly Works

Kelly betting maximizes the **geometric growth rate** of your portfolio:
- Bet too little → Leave money on the table
- Bet too much → Risk of ruin (bankruptcy)
- Bet Kelly → Optimal balance for long-term growth

## Fractional Kelly (Recommended)

Full Kelly is aggressive. Most traders use **fractional Kelly**:

| Fraction | Risk Level | Use Case |
|----------|------------|----------|
| 25% Kelly | Conservative | Beginners, uncertain edge |
| 50% Kelly | Moderate | Experienced traders |
| 75% Kelly | Aggressive | High confidence |
| 100% Kelly | Maximum | Only for verified edge |

## Kelly for Prediction Markets

In prediction markets:
- **W** = Your estimated probability vs market price
- **R** = (1 - market_price) / market_price for YES bets

### Example:
- Market says YES at 40¢
- You believe true probability is 60%
- Edge = 60% - 40% = 20%

Kelly % = 0.60 - [(1-0.60) / (60/40)] = 0.60 - 0.267 = **33.3%**

## PolyParlay Kelly Feature

PolyParlay includes built-in Kelly position sizing:

1. **Enable Kelly Sizer** in Framework Modules
2. Set your **Kelly Fraction** (default: 25%)
3. Set **Max Position %** cap (default: 10%)
4. All strategies automatically use optimal sizing

The system:
- Calculates edge from historical win rate
- Applies your Kelly fraction for safety
- Caps at maximum position size
- Adjusts dynamically as performance changes

[Enable Kelly Position Sizing →](/strategies)`,
    view_count: 0,
  },
  {
    id: '20',
    slug: 'crypto-trading-bot-comparison',
    title: 'Best Crypto Trading Bots 2025: Complete Comparison',
    category: 'getting-started',
    excerpt: 'Compare PolyParlay with 3Commas, Cryptohopper, and other crypto trading bots.',
    content: `# Best Crypto Trading Bots 2025

A comprehensive comparison of automated crypto trading platforms to help you choose the right bot.

## Quick Comparison

| Bot | Exchanges | Price | Unique Feature |
|-----|-----------|-------|----------------|
| **PolyParlay** | 12+ incl. prediction markets | Free-$99/mo | Only bot for Polymarket + Kalshi |
| **3Commas** | 20+ | $14-$49/mo | Largest user base, DCA bots |
| **Cryptohopper** | 15+ | $19-$99/mo | Strategy marketplace |
| **Pionex** | 1 (Pionex) | Free | Built-in exchange |

## PolyParlay Advantages

### ✅ Multi-Asset Class
The only bot that combines:
- **Prediction Markets** (Polymarket, Kalshi)
- **Crypto** (Binance, Coinbase, Kraken, etc.)
- **Stocks** (Alpaca, Interactive Brokers)
- **Options** (IBKR)

### ✅ Unique Strategies
- Cross-platform prediction market arbitrage
- Whale copy trading (on-chain tracking)
- AI Superforecasting with Gemini
- Congressional stock tracker

### ✅ Free Paper Trading
Unlimited paper trading on all plans - learn risk-free.

## When to Choose Others

### Choose 3Commas if:
- You only trade crypto
- You want the largest community
- You need TradingView Pine Script support

### Choose Cryptohopper if:
- You want to buy/sell strategies from others
- You prefer a pure crypto focus
- You need tournament features

### Choose PolyParlay if:
- You trade prediction markets
- You want multi-asset automation
- You're interested in arbitrage strategies
- You want cutting-edge AI features

## Pricing Comparison

| Plan | PolyParlay | 3Commas | Cryptohopper |
|------|------------|---------|--------------|
| Free | Unlimited paper | 1 DCA bot | 1 bot |
| Mid | $29/mo (Pro) | $29/mo | $49/mo |
| Top | $99/mo (Elite) | $49/mo | $99/mo |

## The Verdict

**For prediction markets**: PolyParlay is the only option
**For pure crypto**: 3Commas has the largest ecosystem
**For strategy marketplace**: Cryptohopper wins
**For multi-asset**: PolyParlay is unique

[Try PolyParlay Free →](/signup)`,
    view_count: 0,
  },
];

// GET - Get help articles or single article
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const supabase = getSupabaseAdmin();
    
    // If DB not available, use static articles
    if (!supabase) {
      let articles = STATIC_ARTICLES;
      
      if (slug) {
        const article = articles.find(a => a.slug === slug);
        return article 
          ? NextResponse.json(article)
          : NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }
      
      if (category) {
        articles = articles.filter(a => a.category === category);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        articles = articles.filter(a => 
          a.title.toLowerCase().includes(searchLower) ||
          a.content.toLowerCase().includes(searchLower)
        );
      }
      
      return NextResponse.json({ articles });
    }

    // Try to use DB
    if (slug) {
      const { data: article, error } = await supabase
        .from('polybot_help_articles')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error || !article) {
        // Fallback to static
        const staticArticle = STATIC_ARTICLES.find(a => a.slug === slug);
        return staticArticle 
          ? NextResponse.json(staticArticle)
          : NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      // Increment view count
      await supabase
        .from('polybot_help_articles')
        .update({ view_count: (article.view_count || 0) + 1 })
        .eq('id', article.id);

      return NextResponse.json(article);
    }

    // Get all articles
    let query = supabase
      .from('polybot_help_articles')
      .select('id, slug, title, category, excerpt, view_count, created_at')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: articles, error } = await query;

    if (error || !articles || articles.length === 0) {
      // Fallback to static
      let staticList = STATIC_ARTICLES.map(a => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        view_count: a.view_count,
      }));
      
      if (category) {
        staticList = staticList.filter(a => a.category === category);
      }
      
      return NextResponse.json({ articles: staticList });
    }

    return NextResponse.json({ articles });
  } catch (error: any) {
    console.error('Help API error:', error);
    // Return static articles on error
    return NextResponse.json({ articles: STATIC_ARTICLES.map(a => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      category: a.category,
      excerpt: a.excerpt,
    }))});
  }
}

// POST - Submit feedback for an article
export async function POST(req: NextRequest) {
  try {
    const { article_id, is_helpful, feedback } = await req.json();
    const userId = req.headers.get('x-user-id');

    if (!article_id || is_helpful === undefined) {
      return NextResponse.json({ error: 'Missing article_id or is_helpful' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Just acknowledge without storing
      return NextResponse.json({ success: true, message: 'Feedback received' });
    }

    // Store feedback
    const { error: feedbackError } = await supabase
      .from('polybot_help_feedback')
      .insert({
        article_id,
        user_id: userId || null,
        is_helpful,
        feedback,
      });

    if (feedbackError) {
      console.error('Error storing feedback:', feedbackError);
    }

    // Update article counts - try to increment but don't fail if RPC doesn't exist
    const column = is_helpful ? 'helpful_count' : 'not_helpful_count';
    try {
      await supabase.rpc('increment_help_count', {
        p_article_id: article_id,
        p_column: column,
      });
    } catch {
      // Ignore if RPC doesn't exist
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Help feedback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
