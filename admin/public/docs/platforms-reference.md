# Complete Platform Integration Reference

PolyParlay integrates with **12 trading platforms** across prediction markets, crypto exchanges, and stock brokers. This guide covers every platform in detail.

---

## 🎯 Prediction Markets

### Polymarket

**Type**: Decentralized Prediction Market | **Fees**: 0%

Polymarket is the world's largest prediction market, built on Polygon (Ethereum L2).

**Key Features**:

- ✅ Zero trading fees
- ✅ Deep liquidity on political/sports markets
- ✅ 24/7 trading
- ✅ No KYC required
- ✅ USDC-based (Polygon)

**Setup Steps**:

1. Go to [polymarket.com](https://polymarket.com)
2. Connect your Polygon wallet (MetaMask, etc.)
3. Deposit USDC to Polygon
4. In PolyParlay: **Settings → Secrets**
5. Add: `POLYMARKET_PRIVATE_KEY` (your wallet's private key)

**Supported Strategies**:

- Single-Platform Arbitrage (95% confidence)
- Cross-Platform Arbitrage (90% confidence)
- Market Making (85% confidence)
- News Arbitrage (75% confidence)

**Simulation Mode**: Full support - real prices, simulated trades

**Troubleshooting**:

- *"Insufficient balance"*: Ensure USDC is on Polygon, not Ethereum mainnet
- *"Transaction failed"*: Check MATIC balance for gas fees
- *"Market not found"*: Market may have resolved or been delisted

---

### Kalshi

**Type**: CFTC-Regulated Exchange | **Fees**: 7% of profit

Kalshi is the first legal US prediction market, regulated by the CFTC.

**Key Features**:

- ✅ Fully regulated & legal in US
- ✅ Weather, economics, Fed rates, crypto price brackets
- ✅ USD deposits via bank transfer
- ⚠️ US residents only
- ⚠️ 7% fee on winning trades

**Setup Steps**:

1. Create account at [kalshi.com](https://kalshi.com)
2. Complete KYC verification
3. Deposit funds via ACH/wire
4. Go to **Settings → API Keys**
5. Generate new API key (save both public & private!)
6. In PolyParlay: **Settings → Secrets**
7. Add: `KALSHI_API_KEY` and `KALSHI_PRIVATE_KEY`

**Supported Strategies**:

- Single-Platform Arbitrage (needs >8% edge for profit after fees)
- Cross-Platform Arbitrage vs Polymarket
- BTC Bracket Arbitrage

**Simulation Mode**: Full support - real prices, simulated trades

**Troubleshooting**:

- *"Unauthorized"*: Regenerate API keys on Kalshi
- *"Account not approved"*: Complete KYC on kalshi.com
- *"Position limit"*: Some markets have max position sizes

---

## 🔶 Crypto Exchanges

### Hyperliquid ⭐ RECOMMENDED

**Type**: Decentralized Perpetuals | **Fees**: 0% maker, 0.025% taker

Hyperliquid is a DEX with CEX-like performance. **Our top recommendation** for crypto trading.

**Key Features**:

- ✅ Sub-second latency (~200ms)
- ✅ Zero maker fees
- ✅ No KYC required
- ✅ API Wallets (trade without withdraw risk)
- ✅ Built on Arbitrum
- ✅ Up to 50x leverage

**Setup Steps**:

1. Go to [app.hyperliquid.xyz](https://app.hyperliquid.xyz)
2. Connect Ethereum wallet
3. Bridge USDC from Arbitrum
4. **Create API Wallet** (Settings → API):
   - API wallets can trade but cannot withdraw
   - Perfect for bot security!
5. In PolyParlay: **Settings → Secrets**
6. Add: `HYPERLIQUID_WALLET_ADDRESS` and `HYPERLIQUID_PRIVATE_KEY`

**Supported Strategies**:

- Funding Rate Arbitrage (15-50% APY)
- Grid Trading (20-60% APY)
- 15-Min BTC Scalping
- Pairs Trading

**Why Hyperliquid is Special**:

- Zero maker fees = grid trading is **extremely profitable**
- API wallets = you never expose withdrawal keys
- Testnet available at testnet.hyperliquid.xyz

---

### Binance

**Type**: Centralized Exchange | **Fees**: 0.1% (0.075% with BNB)

World's largest crypto exchange by volume.

**Key Features**:

- ✅ Highest liquidity
- ✅ Spot + Futures
- ✅ Many trading pairs
- ⚠️ US users need Binance.US
- ⚠️ Geo-restrictions apply

**Setup Steps**:

1. Go to [binance.com](https://binance.com) → API Management
2. Create new API key
3. Set permissions:
   - ✅ Enable Reading
   - ✅ Enable Spot Trading
   - ✅ Enable Futures (optional)
   - ❌ Withdrawals (NOT needed)
4. Add IP restriction (optional but recommended)
5. In PolyParlay: **Settings → Secrets**
6. Add: `BINANCE_API_KEY` and `BINANCE_SECRET`

**Supported Strategies**:

- Funding Rate Arbitrage
- Grid Trading
- Pairs Trading

---

### Coinbase

**Type**: Centralized Exchange | **Fees**: 0.5-0.6%

Most trusted US crypto exchange, publicly traded (COIN).

**Key Features**:

- ✅ US-regulated & insured
- ✅ Easy fiat on/off ramp
- ✅ Custody solution
- ⚠️ Higher fees than competitors

**Setup Steps**:

1. Go to [coinbase.com](https://coinbase.com) → Settings → API
2. Create new API key
3. Set permissions:
   - ✅ View accounts
   - ✅ Trade
   - ❌ Transfer (NOT needed)
4. In PolyParlay: **Settings → Secrets**
5. Add: `COINBASE_API_KEY` and `COINBASE_SECRET`

---

### Kraken

**Type**: Centralized Exchange | **Fees**: 0.16-0.26%

Oldest US-compliant crypto exchange, known for security.

**Key Features**:

- ✅ Excellent security record
- ✅ US compliant
- ✅ Fiat support (USD, EUR, GBP)
- ✅ Futures available

**Setup Steps**:

1. Go to [kraken.com](https://kraken.com) → Settings → API
2. Create new API key
3. Set permissions:
   - ✅ Query funds
   - ✅ Create orders
   - ❌ Withdraw (NOT needed)
4. In PolyParlay: **Settings → Secrets**
5. Add: `KRAKEN_API_KEY` and `KRAKEN_SECRET`

---

### KuCoin

**Type**: Centralized Exchange | **Fees**: 0.1%

Global exchange with many altcoins.

**Key Features**:

- ✅ Huge altcoin selection
- ✅ Futures available
- ✅ Grid trading built-in
- ⚠️ Not officially US-licensed

**Setup Steps**:

1. Go to [kucoin.com](https://kucoin.com) → API Management
2. Create new API key
3. **Important**: Set a passphrase (required!)
4. In PolyParlay: **Settings → Secrets**
5. Add: `KUCOIN_API_KEY`, `KUCOIN_SECRET`, `KUCOIN_PASSPHRASE`

---

### Bybit

**Type**: Centralized Exchange | **Fees**: 0.1%

Top derivatives exchange, known for perpetuals.

**Key Features**:

- ✅ Deep liquidity on perpetuals
- ✅ Up to 100x leverage
- ✅ Copy trading
- ⚠️ Not available in US

**Setup Steps**:

1. Go to [bybit.com](https://bybit.com) → API Management
2. Create new API key
3. In PolyParlay: **Settings → Secrets**
4. Add: `BYBIT_API_KEY` and `BYBIT_SECRET`

---

### OKX

**Type**: Centralized Exchange | **Fees**: 0.08-0.1%

Major global exchange with advanced features.

**Key Features**:

- ✅ Spot, Futures, Options
- ✅ Advanced order types
- ✅ Earn products
- ⚠️ **Requires passphrase**

**Setup Steps**:

1. Go to [okx.com](https://okx.com) → API
2. Create new API key
3. **Set a passphrase** (required for OKX!)
4. In PolyParlay: **Settings → Secrets**
5. Add: `OKX_API_KEY`, `OKX_SECRET`, `OKX_PASSPHRASE`

---

## 📈 Stock Brokers

### Alpaca

**Type**: Commission-Free Broker | **Fees**: $0

Modern API-first broker, perfect for algorithmic trading.

**Key Features**:

- ✅ Commission-free trading
- ✅ Excellent API
- ✅ Paper trading mode
- ✅ Fractional shares
- ✅ Extended hours
- ✅ US stocks & ETFs

**Setup Steps**:

1. Sign up at [alpaca.markets](https://alpaca.markets)
2. Go to Paper Trading (or Live after approval)
3. Click **API Keys** → Generate New Key
4. Save both Key ID and Secret Key
5. In PolyParlay: **Settings → Secrets**
6. Add: `ALPACA_API_KEY` and `ALPACA_SECRET`
7. Set `ALPACA_PAPER=true` for paper trading

**Supported Strategies**:

- Congressional Tracker
- RSI Mean Reversion
- Stock Momentum
- Sector Rotation
- Dividend Growth
- Earnings Momentum

**Paper vs Live**:

- Paper: $100K virtual balance, instant access
- Live: Requires approval, PDT rules apply ($25K for unlimited day trades)

---

### Interactive Brokers (IBKR)

**Type**: Professional Broker | **Fees**: $0-1 per trade

The most comprehensive broker for professional traders.

**Key Features**:

- ✅ Stocks, Options, Futures, Forex
- ✅ Global markets
- ✅ Low margin rates
- ✅ Advanced order types
- ⚠️ Complex setup

**Setup Steps**:

1. Sign up at [interactivebrokers.com](https://interactivebrokers.com)
2. Enable **Client Portal API** in Account Settings
3. Download IB Gateway or TWS
4. Configure API settings:
   - Enable Socket Clients
   - Set API port (default: 7497 paper, 7496 live)
5. In PolyParlay: **Settings → Secrets**
6. Add: `IBKR_HOST`, `IBKR_PORT`, `IBKR_CLIENT_ID`

**Supported Strategies**:

- IBKR Futures Momentum
- Options strategies (Covered Calls, Cash Secured Puts, Iron Condors)
- Wheel Strategy

**Note**: IBKR requires IB Gateway running on your machine or server.

---

### Webull

**Type**: Commission-Free Broker | **Fees**: $0

Popular trading app with extended hours.

**Key Features**:

- ✅ Commission-free
- ✅ Extended hours trading
- ✅ Paper trading
- ✅ Options trading
- ⚠️ Limited API access

**Setup Steps**:

1. Sign up at [webull.com](https://webull.com)
2. Enable 2FA
3. Get device ID from Webull app
4. In PolyParlay: **Settings → Secrets**
5. Add: `WEBULL_EMAIL`, `WEBULL_PASSWORD`, `WEBULL_DEVICE_ID`, `WEBULL_TRADING_PIN`

**Note**: Webull API is unofficial. Use with caution.

---

## 📊 Platform Comparison Summary

| Platform | Type | Fees | US Legal | Paper Mode | Best For |
|----------|------|------|----------|------------|----------|
| Polymarket | Prediction | 0% | Yes* | ✅ | Political/sports betting |
| Kalshi | Prediction | 7% profit | ✅ | ✅ | Weather/economics |
| Hyperliquid | Crypto DEX | 0% maker | ✅ | ✅ | Grid trading, perps |
| Binance | Crypto CEX | 0.1% | ⚠️ | ✅ | High liquidity |
| Coinbase | Crypto CEX | 0.5% | ✅ | ❌ | US compliance |
| Kraken | Crypto CEX | 0.16% | ✅ | ❌ | Security-focused |
| KuCoin | Crypto CEX | 0.1% | ⚠️ | ✅ | Altcoins |
| Bybit | Crypto CEX | 0.1% | ❌ | ✅ | Derivatives |
| OKX | Crypto CEX | 0.08% | ⚠️ | ✅ | All-in-one |
| Alpaca | Stocks | $0 | ✅ | ✅ | Algo trading |
| IBKR | Multi-asset | ~$1 | ✅ | ✅ | Professional |
| Webull | Stocks | $0 | ✅ | ✅ | Casual trading |

*Polymarket uses crypto, technically accessible globally

---

## 🔐 Security Best Practices

1. **Never enable withdrawal permissions** - PolyParlay doesn't need them
2. **Use IP whitelisting** where available
3. **Use API Wallets on Hyperliquid** - they can't withdraw
4. **Rotate keys periodically** - every 90 days recommended
5. **Use unique keys** - don't reuse across services
6. **Enable 2FA** on all exchange accounts

---

## ❓ Frequently Asked Questions

**Q: Which platform should I start with?**
A: Start with **Alpaca** (paper mode) for stocks or **Hyperliquid** for crypto. Both are free to test.

**Q: Do I need to connect all platforms?**
A: No! Connect only the platforms you want to use. Each is independent.

**Q: What happens if a platform isn't configured?**
A: The bot gracefully skips unconfigured platforms. You'll see "Platform not configured" in logs but no errors.

**Q: Can I use simulation mode without real API keys?**
A: Yes! Simulation mode uses real market data but simulated trades. You can test strategies risk-free.

**Q: How do I switch from paper to live trading?**
A: 1) Upgrade to Pro/Elite plan, 2) Add live API keys, 3) Enable "Live Trading Mode" in Settings.

---

## 🔗 Quick Links

- [Polymarket Setup](/help?article=connecting-polymarket)
- [Kalshi Setup](/help?article=connecting-kalshi)
- [Alpaca Setup](/help?article=connecting-alpaca)
- [Crypto Exchanges](/help?article=connecting-crypto)
- [Strategy Overview](/help?article=strategies-overview)
- [Paper Trading Guide](/help?article=paper-trading)
