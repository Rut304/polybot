# External Integrations Guide

This document covers all external integrations available in PolyParlay/PolyBot.

---

## 🔗 TradingView Webhook Integration

### Overview

PolyParlay supports receiving trading signals from TradingView alerts via webhooks. This allows you to:

- Execute trades based on your TradingView strategies
- Automate entries/exits from Pine Script indicators
- Bridge TradingView's charting with PolyParlay's execution

### Endpoint

```
POST https://polyparlay.io/api/webhooks/tradingview
```

### Request Format

Send JSON payload with the following structure:

```json
{
  "symbol": "AAPL",
  "action": "buy",
  "price": "150.50",
  "strategy": "RSI_Oversold",
  "interval": "1H",
  "quantity": 10,
  "take_profit": 160,
  "stop_loss": 145,
  "comment": "RSI crossed above 30",
  "secret": "your_webhook_secret"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Ticker symbol (e.g., "AAPL", "BTCUSDT") |
| `action` | string | Trade action: "buy", "sell", "long", "short", "close" |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `price` | number/string | Entry price |
| `strategy` | string | Strategy name for grouping |
| `interval` | string | Timeframe: "1m", "5m", "15m", "1H", "4H", "D", "W" |
| `quantity` | number | Position size |
| `take_profit` | number | Take profit price |
| `stop_loss` | number | Stop loss price |
| `comment` | string | Additional notes |
| `secret` | string | Webhook secret for verification |

### TradingView Alert Setup

1. **Create an alert** in TradingView
2. **Set Webhook URL** to `https://polyparlay.io/api/webhooks/tradingview`
3. **Set Alert Message** (JSON format):

```json
{
  "symbol": "{{ticker}}",
  "action": "buy",
  "price": "{{close}}",
  "strategy": "MyStrategy",
  "interval": "{{interval}}",
  "time": "{{timenow}}"
}
```

### TradingView Variables

You can use these TradingView placeholders:

| Variable | Description |
|----------|-------------|
| `{{ticker}}` | Symbol name |
| `{{exchange}}` | Exchange name |
| `{{close}}` | Current close price |
| `{{open}}` | Current open price |
| `{{high}}` | Current high |
| `{{low}}` | Current low |
| `{{volume}}` | Current volume |
| `{{interval}}` | Chart timeframe |
| `{{timenow}}` | UTC timestamp |

### Response Format

**Success:**

```json
{
  "success": true,
  "message": "Signal received and logged",
  "data": {
    "signal_id": "uuid-here",
    "symbol": "AAPL",
    "action": "buy",
    "asset_type": "stock",
    "processing_time_ms": 45,
    "forwarded": true
  }
}
```

**Error:**

```json
{
  "success": false,
  "error": "Missing required fields: symbol, action"
}
```

### Asset Type Detection

The webhook automatically detects asset type:

- **Crypto**: Symbols like BTCUSDT, on exchanges like Binance
- **Stock**: Standard tickers like AAPL, TSLA
- **Prediction**: Polymarket/Kalshi market IDs

### Security

For added security, set a webhook secret:

1. Set `TRADINGVIEW_WEBHOOK_SECRET` in your environment
2. Include `"secret": "your_secret"` in alert messages
3. Requests without valid secret will be rejected

---

## 📊 Live Feed API

### Overview

Public endpoint for displaying recent trades on the landing page.

### Endpoint

```
GET https://polyparlay.io/api/live-feed
```

### Response

```json
{
  "trades": [
    {
      "id": "uuid",
      "market": "Will BTC reach $150k?",
      "action": "BUY YES",
      "outcome": "won",
      "platform": "polymarket",
      "profit": 127.50,
      "timestamp": "2025-01-01T12:00:00Z"
    }
  ],
  "source": "live",
  "stats": {
    "totalTrades": 834,
    "winningTrades": 651,
    "winRate": 78.1,
    "totalProfit": 12450.75
  }
}
```

---

## 🏛️ Congressional Trading API

### Overview

Fetches congressional trading data from multiple sources.

### Endpoint

```
GET https://polyparlay.io/api/congress
```

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `chamber` | string | Filter by "house" or "senate" |
| `limit` | number | Max results (default: 50) |
| `symbol` | string | Filter by stock symbol |

### Data Sources

1. **House Stock Watcher** - Free S3 bucket with House trades
2. **Senate Stock Watcher** - Free S3 bucket with Senate trades
3. **Capitol Trades API** - Backup source
4. **Quiver Quant** - Premium data source

### Response

```json
{
  "trades": [
    {
      "politician": "Nancy Pelosi",
      "chamber": "house",
      "symbol": "NVDA",
      "trade_type": "purchase",
      "amount": "$1,000,001 - $5,000,000",
      "transaction_date": "2025-01-15",
      "disclosure_date": "2025-01-20"
    }
  ],
  "source": "house_stock_watcher",
  "count": 50
}
```

---

## 🐳 Whale Tracking API

### Overview

Track large prediction market traders.

### Endpoint

```
GET https://polyparlay.io/api/whales
```

### Response

```json
{
  "whales": [
    {
      "address": "0x...",
      "nickname": "Top Trader #1",
      "total_pnl": 125000,
      "win_rate": 72.5,
      "total_trades": 234,
      "last_trade_at": "2025-01-01T10:30:00Z"
    }
  ]
}
```

---

## 🔐 API Authentication

Most endpoints require authentication via Supabase:

1. **Login** at polyparlay.io
2. **Get session token** from browser
3. **Include in requests**: `Authorization: Bearer <token>`

Public endpoints (no auth required):

- `/api/live-feed`
- `/api/webhooks/tradingview` (with optional secret)
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`

---

## 📝 Database Tables

### polybot_tradingview_signals

Stores all incoming TradingView webhook signals.

```sql
CREATE TABLE polybot_tradingview_signals (
    id UUID PRIMARY KEY,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    price DECIMAL(20, 8),
    exchange TEXT,
    strategy TEXT,
    interval TEXT,
    quantity DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    comment TEXT,
    raw_payload JSONB,
    processed BOOLEAN DEFAULT false,
    received_at TIMESTAMPTZ DEFAULT now()
);
```

### polybot_watchlist

User's watched markets.

```sql
CREATE TABLE polybot_watchlist (
    id UUID PRIMARY KEY,
    user_id UUID,
    market_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    market_title TEXT NOT NULL,
    alert_above DECIMAL(10, 6),
    alert_below DECIMAL(10, 6),
    added_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🛠️ Environment Variables

| Variable | Description |
|----------|-------------|
| `TRADINGVIEW_WEBHOOK_SECRET` | Secret for verifying TradingView webhooks |
| `BOT_WEBHOOK_URL` | URL to forward signals to bot |
| `QUIVER_QUANT_API_KEY` | API key for Quiver Quant data |
| `CAPITOL_TRADES_API_KEY` | API key for Capitol Trades |

---

## 📈 Monitoring

View integration stats at:

- `/admin/diagnostics` - Webhook logs
- `/dashboard` - Trade metrics
- Database views: `v_tradingview_signal_stats`, `v_tradingview_signal_performance`
