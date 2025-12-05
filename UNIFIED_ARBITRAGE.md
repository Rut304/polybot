# PolyBot Unified Arbitrage System

## Overview

This system implements **three types of arbitrage** based on PhD-level research from "Unravelling the Probabilistic Forest" (Saguillo et al., 2025), which documented **$40M in profits** extracted from Polymarket over one year.

## The Three Arbitrage Strategies

### 1. 📊 Polymarket Single-Platform Arbitrage

**Where the REAL money is** - $39.5M of the $40M documented profits!

- **How it works**: Detects when multi-condition market prices don't sum to $1
- **Example**: 3-way race with A=40¢, B=35¢, C=30¢ = $1.05 total
- **Action**: Buy all NO positions for 95¢ equivalent, guaranteed $1 payout
- **Config**: `ENABLE_POLYMARKET_SINGLE_ARB=true`

### 2. 📊 Kalshi Single-Platform Arbitrage

Same concept applied to Kalshi markets.

- **How it works**: Detects when YES + NO prices ≠ $1
- **Example**: YES=55¢, NO=40¢ → Buy both for 95¢, win $1 guaranteed
- **Config**: `ENABLE_KALSHI_SINGLE_ARB=true`

### 3. 🔄 Cross-Platform Arbitrage (Polymarket ↔ Kalshi)

Rare but real opportunities when same market has different prices.

- **How it works**: Matches similar markets across platforms, finds price differences
- **Example**: "Trump wins" at 52¢ on Polymarket, 48¢ on Kalshi
- **Historical data**: ~$95K in documented opportunities (much rarer than single-platform)
- **Config**: `ENABLE_CROSS_PLATFORM_ARB=true`

## Configuration

Add these to your `.env` file:

```bash
# Arbitrage Strategy Toggles (all enabled by default)
ENABLE_POLYMARKET_SINGLE_ARB=true   # Single-platform on Polymarket
ENABLE_KALSHI_SINGLE_ARB=true       # Single-platform on Kalshi  
ENABLE_CROSS_PLATFORM_ARB=true      # Cross-platform Poly↔Kalshi
```

## Analytics Tracking

The system tracks each strategy **independently** so you can see what's working:

```
╔══════════════════════════════════════════════════════════════════════╗
║                    📊 ARBITRAGE STRATEGY COMPARISON                   ║
╠══════════════════════════════════════════════════════════════════════╣
║ Strategy              │ Opps  │ Trades │ Win% │ Net P&L  │ Avg/Trade ║
╠═══════════════════════╪═══════╪════════╪══════╪══════════╪═══════════╣
║ Polymarket Single     │   150 │     45 │  78% │  +$234.50 │    +$5.21 ║
║ Kalshi Single         │    91 │     30 │  70% │  +$156.00 │    +$5.20 ║
║ Cross-Platform        │    12 │      5 │  60% │   +$45.00 │    +$9.00 ║
╠═══════════════════════╧═══════╧════════╧══════╧══════════╧═══════════╣
║ TOTAL                                          │  +$435.50 │ ROI: +43.5% ║
╚══════════════════════════════════════════════════════════════════════╝
```

## Key Files

| File | Description |
|------|-------------|
| `src/config.py` | Trading config with enable/disable flags |
| `src/arbitrage/single_platform_scanner.py` | Single-platform arbitrage scanner |
| `src/arbitrage/detector.py` | Cross-platform scanner |
| `src/analytics/arbitrage_analytics.py` | Per-strategy analytics tracking |
| `src/bot_runner.py` | Main orchestrator (runs all strategies) |

## Research Insights

From academic research on prediction market arbitrage:

1. **Single-platform >> Cross-platform**: 400x more profitable
2. **Market Rebalancing** is the dominant strategy (sum of prices ≠ $1)
3. **Top 10 arbitrageurs** extracted $8.2M using bot-like behavior
4. **Professionals use embeddings + LLMs** to match markets, not simple keyword matching
5. **Speed matters**: 67% of top arbs have <100ms latency

## Running the Bot

```bash
# Run with all strategies enabled (default)
python -m src.bot_runner

# Or set specific strategies in .env:
ENABLE_POLYMARKET_SINGLE_ARB=true
ENABLE_KALSHI_SINGLE_ARB=true  
ENABLE_CROSS_PLATFORM_ARB=false  # Disable cross-platform

python -m src.bot_runner
```

## Output Example

```
============================================================
PolyBot Starting!
Mode: SIMULATION
------------------------------------------------------------
ARBITRAGE STRATEGIES:
  - Polymarket Single-Platform: ON
  - Kalshi Single-Platform: ON
  - Cross-Platform (Poly↔Kalshi): ON
============================================================
▶️ Starting Single-Platform Scanner | Polymarket=ON | Kalshi=ON
▶️ Starting Cross-Platform Scanner...
🎯 [SINGLE-ARB] KALSHI | 2.00% profit | Total=0.9800 | Will Elon Musk visit Mars...
🎯 [SINGLE-ARB] KALSHI | 3.00% profit | Total=0.9700 | Who will the next Pope be?...
✅ WON: kalshi_single_1234 | Size: $50.00 | Net P&L: +$0.85 | Balance: $1000.85
```

## Next Steps

1. **Monitor analytics** to see which strategy performs best
2. **Adjust thresholds** based on what you see (MIN_PROFIT_PERCENT)
3. **Disable underperforming strategies** if needed
4. **Scale up compute** when you're confident in the system
