#!/usr/bin/env python3
"""Deep analysis of trades for duplicates."""
import os
from supabase import create_client
from collections import Counter, defaultdict
from datetime import datetime

url = "https://ytaltvltxkkfczlvjgad.supabase.co"
with open(".env", "r") as f:
    for line in f:
        if line.startswith("SUPABASE_KEY="):
            key = line.split("=", 1)[1].strip()
            break

client = create_client(url, key)

print("=" * 60)
print("DEEP DUPLICATE ANALYSIS")
print("=" * 60)

# Fetch ALL trades with key fields
all_trades = []
page = 0
while True:
    result = client.table("polybot_simulated_trades").select(
        "id, position_id, kalshi_ticker, polymarket_token_id, created_at, "
        "actual_profit_usd, expected_profit_usd, outcome, trade_type"
    ).range(page * 1000, (page + 1) * 1000 - 1).order("created_at").execute()
    if not result.data:
        break
    all_trades.extend(result.data)
    page += 1
    if len(result.data) < 1000 or page > 100:
        break

print(f"\nTotal trades fetched: {len(all_trades)}")

# Check 1: Duplicate IDs (should be 0 - primary key)
id_counts = Counter(t["id"] for t in all_trades)
dup_ids = {k: v for k, v in id_counts.items() if v > 1}
print(f"\n1. Duplicate primary key IDs: {len(dup_ids)}")

# Check 2: Duplicate position_ids
pos_counts = Counter(t["position_id"] for t in all_trades if t["position_id"])
dup_positions = {k: v for k, v in pos_counts.items() if v > 1}
print(f"2. Duplicate position_ids: {len(dup_positions)}")
if dup_positions:
    total_dup = sum(v - 1 for v in dup_positions.values())
    print(f"   Extra rows from position dups: {total_dup}")

# Check 3: Same ticker + same second (very suspicious)
ticker_second = Counter(
    (t["kalshi_ticker"], t["created_at"][:19]) 
    for t in all_trades if t["kalshi_ticker"]
)
same_ticker_second = {k: v for k, v in ticker_second.items() if v > 1}
print(f"3. Same ticker+second combinations: {len(same_ticker_second)}")
if same_ticker_second:
    total_suspicious = sum(v - 1 for v in same_ticker_second.values())
    print(f"   Extra suspicious rows: {total_suspicious}")
    # Show worst offenders
    worst = sorted(same_ticker_second.items(), key=lambda x: -x[1])[:5]
    print(f"   Worst offenders:")
    for (ticker, ts), count in worst:
        print(f"      {ticker} @ {ts}: {count}x")

# Check 4: Same ticker + same profit (exact duplicate trade)
ticker_profit = Counter(
    (t["kalshi_ticker"], str(t["actual_profit_usd"]), t["created_at"][:16]) 
    for t in all_trades if t["kalshi_ticker"] and t["actual_profit_usd"]
)
exact_dups = {k: v for k, v in ticker_profit.items() if v > 1}
print(f"4. Exact duplicates (ticker+profit+minute): {len(exact_dups)}")
if exact_dups:
    total_exact = sum(v - 1 for v in exact_dups.values())
    print(f"   Extra exact duplicate rows: {total_exact}")

# Check 5: Trades per minute analysis
trades_per_minute = Counter(t["created_at"][:16] for t in all_trades)
high_frequency = {k: v for k, v in trades_per_minute.items() if v > 50}
print(f"5. Minutes with >50 trades: {len(high_frequency)}")
if high_frequency:
    print(f"   Highest: {max(high_frequency.values())} trades in one minute")

# Check 6: Unique tickers traded
unique_tickers = set(t["kalshi_ticker"] for t in all_trades if t["kalshi_ticker"])
print(f"6. Unique tickers: {len(unique_tickers)}")

# Check 7: Trades per ticker
trades_per_ticker = Counter(t["kalshi_ticker"] for t in all_trades if t["kalshi_ticker"])
top_tickers = trades_per_ticker.most_common(10)
print(f"7. Top 10 traded tickers:")
for ticker, count in top_tickers:
    print(f"   {ticker}: {count} trades")

# Calculate P&L different ways
print("\n" + "=" * 60)
print("P&L CALCULATIONS")
print("=" * 60)

valid_trades = [t for t in all_trades if t["outcome"] != "failed_execution"]
all_pnl = sum(t["actual_profit_usd"] or 0 for t in valid_trades)
print(f"\nAll valid trades P&L: ${all_pnl:,.2f} ({len(valid_trades)} trades)")

# De-duplicate by position_id
seen_positions = set()
unique_by_position = []
for t in all_trades:
    pos_id = t["position_id"]
    if pos_id:
        if pos_id in seen_positions:
            continue
        seen_positions.add(pos_id)
    if t["outcome"] != "failed_execution":
        unique_by_position.append(t)

pos_dedup_pnl = sum(t["actual_profit_usd"] or 0 for t in unique_by_position)
print(f"Position-deduped P&L: ${pos_dedup_pnl:,.2f} ({len(unique_by_position)} trades)")

# De-duplicate by ticker+minute+profit
seen_combos = set()
unique_by_combo = []
for t in all_trades:
    if t["kalshi_ticker"] and t["actual_profit_usd"]:
        combo = (t["kalshi_ticker"], str(t["actual_profit_usd"]), t["created_at"][:16])
        if combo in seen_combos:
            continue
        seen_combos.add(combo)
    if t["outcome"] != "failed_execution":
        unique_by_combo.append(t)

combo_dedup_pnl = sum(t["actual_profit_usd"] or 0 for t in unique_by_combo)
print(f"Combo-deduped P&L: ${combo_dedup_pnl:,.2f} ({len(unique_by_combo)} trades)")

# Starting balance
result = client.table("polybot_config").select(
    "polymarket_starting_balance, kalshi_starting_balance, "
    "binance_starting_balance, coinbase_starting_balance, alpaca_starting_balance"
).limit(1).execute()

if result.data:
    c = result.data[0]
    starting = sum(c.get(k) or 20000 for k in [
        "polymarket_starting_balance", "kalshi_starting_balance",
        "binance_starting_balance", "coinbase_starting_balance", 
        "alpaca_starting_balance"
    ])
    print(f"\nStarting balance: ${starting:,}")
    print(f"\nCURRENT BALANCE CALCULATIONS:")
    print(f"  All trades:        ${starting + all_pnl:,.2f}")
    print(f"  Position-deduped:  ${starting + pos_dedup_pnl:,.2f}")
    print(f"  Combo-deduped:     ${starting + combo_dedup_pnl:,.2f}")

print("\n" + "=" * 60)
print("RECOMMENDATION")
print("=" * 60)
if len(exact_dups) > 0 or len(dup_positions) > 0:
    print("⚠️  DUPLICATES DETECTED - Numbers are inflated!")
    print(f"   True P&L is likely: ${combo_dedup_pnl:,.2f}")
else:
    print("✅ No significant duplicates found")
    print(f"   P&L appears accurate: ${all_pnl:,.2f}")
