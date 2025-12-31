# Hyperliquid Integration Guide

## Overview

Hyperliquid is a high-performance **Decentralized Exchange (DEX)** running on its own custom Layer 1 blockchain. It combines the speed and UX of centralized exchanges with the self-custody benefits of DeFi.

### Why Hyperliquid for PolyBot?

| Feature | Benefit |
|---------|---------|
| **Zero Gas Fees** | Grid trading & market making become highly profitable |
| **Sub-second Latency** | ~200ms block times enable HFT strategies |
| **Order Book (CLOB)** | Limit orders = better execution than AMM swaps |
| **API Wallets** | Secure bot trading (can trade but not withdraw) |
| **No KYC Required** | Trade with just an Ethereum wallet |

---

## Setup Instructions

### 1. Create a Wallet

1. Install [MetaMask](https://metamask.io/) or use any Ethereum wallet
2. Go to [app.hyperliquid.xyz](https://app.hyperliquid.xyz)
3. Connect your wallet
4. Deposit USDC (bridged from Arbitrum)

### 2. Generate API Keys

Hyperliquid uses **wallet signatures** for authentication, not traditional API keys:

**Option A: Use Main Wallet (Not Recommended for Bots)**

- Your main wallet's private key signs all orders
- Risk: If key is compromised, funds can be withdrawn

**Option B: Create API Wallet (Recommended)**

1. Go to Hyperliquid → Settings → API
2. Create a new "API Wallet"
3. Fund it with a small amount for trading
4. **Critical**: API wallets can ONLY trade, never withdraw

### 3. Configure PolyBot

Add these secrets in Settings → Secrets:

```
HYPERLIQUID_WALLET_ADDRESS=0x1234...  # Your wallet address
HYPERLIQUID_PRIVATE_KEY=0x5678...     # Private key (NEVER share!)

# OR for API Wallet (recommended):
HYPERLIQUID_API_WALLET_ADDRESS=0xabcd...
HYPERLIQUID_API_WALLET_KEY=0xefgh...
```

### 4. Enable in Settings

1. Go to Settings → Platforms
2. Enable "Hyperliquid" exchange
3. Save settings

---

## Supported Strategies

### 1. Funding Rate Arbitrage 🔥

**Expected APY: 15-50%**

Hyperliquid perpetual futures have funding rates similar to Binance/Bybit. The bot can:

- Monitor funding rates across exchanges
- Open delta-neutral positions
- Collect funding every 8 hours

```python
# Example: BTC funding arbitrage
# If Hyperliquid funding = +0.05% (8h)
# Long BTC spot on CEX, Short BTC perp on Hyperliquid
# Collect 0.05% every 8 hours = ~54% APY
```

### 2. Grid Trading 🔥🔥

**Expected Returns: 20-60% APY**

Zero gas fees make grid trading exceptionally profitable:

- Place buy/sell limit orders at intervals
- Capture price oscillations
- No transaction costs eating into profits

### 3. Market Making

**Expected Returns: 10-30% APY**

Provide liquidity on both sides of the order book:

- Earn the bid-ask spread
- Works best in stable, liquid markets
- Requires careful risk management

### 4. Cross-Exchange Arbitrage

**Expected Returns: Variable**

When prices diverge between Hyperliquid and CEXs:

- Buy low on one exchange
- Sell high on another
- Profit from inefficiencies

---

## API Reference

### Authentication

Hyperliquid uses **EIP-712 signatures** for authentication:

```python
from eth_account import Account
from eth_account.messages import encode_structured_data

# Sign a trade request
def sign_order(private_key: str, order_data: dict) -> str:
    account = Account.from_key(private_key)
    typed_data = {
        "types": {...},
        "primaryType": "Order",
        "domain": {...},
        "message": order_data
    }
    signed = account.sign_message(encode_structured_data(typed_data))
    return signed.signature.hex()
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `https://api.hyperliquid.xyz/info` | POST | Market data, account info |
| `https://api.hyperliquid.xyz/exchange` | POST | Place orders, cancel, modify |

### Example: Get Account State

```python
import requests

response = requests.post(
    "https://api.hyperliquid.xyz/info",
    json={
        "type": "clearinghouseState",
        "user": "0x1234..."
    }
)
state = response.json()
# Returns: positions, margin, PnL, etc.
```

### Example: Place Limit Order

```python
order = {
    "asset": 0,  # BTC-PERP
    "isBuy": True,
    "sz": "0.01",  # Size in base currency
    "limitPx": "50000",  # Price
    "orderType": {"limit": {"tif": "Gtc"}},
    "reduceOnly": False,
}

response = requests.post(
    "https://api.hyperliquid.xyz/exchange",
    json={
        "action": {
            "type": "order",
            "orders": [order],
            "grouping": "na"
        },
        "nonce": int(time.time() * 1000),
        "signature": sign_order(private_key, ...),
    }
)
```

---

## Testnet

Hyperliquid has a fully functional testnet for development:

1. Go to [testnet.hyperliquid.xyz](https://testnet.hyperliquid.xyz)
2. Connect wallet (use a separate test wallet!)
3. Request testnet funds from Discord
4. Test strategies without real money

**In PolyBot**: Set `sandbox: true` in exchange config to use testnet.

---

## Risk Management

### Position Limits

- Start with small positions (1-5% of portfolio)
- Use stop-losses for all positions
- Monitor liquidation prices closely

### API Wallet Security

- Create a dedicated API wallet
- Only fund it with trading capital
- If compromised, main funds are safe

### Funding Rate Risks

- Rates can flip negative suddenly
- Monitor positions every 8 hours
- Set alerts for rate changes

---

## Monitoring

### Dashboard Integration

Hyperliquid data is available on:

- **Dashboard**: Portfolio value, positions, P&L
- **Whales Page**: Top Hyperliquid traders
- **Analytics**: Performance metrics, ROI

### Alerts

Configure alerts for:

- Large whale movements
- Funding rate changes
- Position liquidation warnings

---

## Troubleshooting

### "Invalid signature" Error

- Check private key format (should start with 0x)
- Ensure wallet address matches private key
- Verify nonce is current timestamp in milliseconds

### "Insufficient margin" Error

- Check account has enough USDC
- Reduce position size
- Close other positions to free margin

### Connection Issues

- Hyperliquid API has rate limits
- Implement exponential backoff
- Use WebSocket for real-time data

---

## Resources

- [Hyperliquid Documentation](https://hyperliquid.gitbook.io/hyperliquid-docs)
- [Python SDK](https://github.com/hyperliquid-dex/hyperliquid-python-sdk)
- [Discord Community](https://discord.gg/hyperliquid)
- [Testnet](https://testnet.hyperliquid.xyz)

---

## PolyBot Integration Status

| Feature | Status |
|---------|--------|
| CCXT Client | ✅ Supported |
| Balance Fetching | ✅ Working |
| Order Placement | ✅ Working |
| Funding Rates | ✅ Working |
| Whale Tracking | ✅ Working |
| Grid Trading | ✅ Working |
| Settings UI | ✅ Working |
| Testnet Support | ✅ Working |
