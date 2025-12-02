# PolyBot - Prediction Market Arbitrage Bot

**Autonomous trading bot for prediction market arbitrage**

## Overview

PolyBot automatically detects and executes arbitrage opportunities across prediction markets including:

- Polymarket
- Kalshi  
- Other supported platforms

## Features

- 🚀 Real-time WebSocket market monitoring
- 💰 Automated arbitrage detection
- ⚡ Fast execution engine
- 🛡️ Built-in risk management
- 📊 **Paper Trading Simulation** - Track hypothetical P&L without risking money
- 🔔 Discord/Telegram alerts

## Quick Start

See [BOT_QUICK_START.md](./BOT_QUICK_START.md) for detailed setup instructions.

```bash
# Install dependencies
pip install -r requirements.txt

# Set up .env file (copy from .env.example)
cp .env.example .env
# Edit .env with your API keys

# Run in simulation mode (default)
python -m src.main
```

## Paper Trading (Simulation Mode)

PolyBot includes a **paper trading simulator** that tracks hypothetical performance:

- Records every arbitrage opportunity detected
- Simulates trades at detected prices
- Tracks hypothetical P&L over time
- Persists to Supabase for historical analysis

### View Simulation Stats

```bash
python -m scripts.view_stats
```

### How It Works

1. **DRY_RUN=true** (default): No real trades, just simulation
2. Bot detects arbitrage opportunities
3. Paper trader records simulated trades
4. Stats printed every 60 seconds and on shutdown
5. All data saved to `polybot_simulated_trades` table

### Stats Tracked

| Metric | Description |
|--------|-------------|
| Simulated Balance | Starting $1000, tracks changes |
| Total P&L | Cumulative profit/loss |
| Win Rate | % of profitable trades |
| Best Trade | Largest single profit |
| Largest Opportunity | Biggest arbitrage % seen |

## Architecture

Built on:

- Python 3.11+
- FastAPI for REST/WebSocket
- Supabase for persistence
- AWS ECS for deployment
- Privy for wallet integration

## Documentation

- [Trading Bot Analysis](./TRADING_BOT_ANALYSIS.md) - Research on existing bots
- [Build Plan](./BOT_QUICK_START.md) - 6-hour implementation guide
- [Morning Briefing](./MORNING_BRIEFING.md) - Executive summary

## Safety

⚠️ **Start with DRY_RUN=true** - Run in simulation mode first to validate the bot's performance before trading real money.

## License

MIT
