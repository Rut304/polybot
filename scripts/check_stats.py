#!/usr/bin/env python3
import os
from supabase import create_client

url = "https://ytaltvltxkkfczlvjgad.supabase.co"
with open(".env", "r") as f:
    for line in f:
        if line.startswith("SUPABASE_KEY="):
            key = line.split("=", 1)[1].strip()
            break

client = create_client(url, key)

# Check the strategy performance view
result = client.table("polybot_strategy_performance").select("*").execute()
print("Strategy Performance View:")
for r in result.data:
    print(f"  {r}")

view_pnl = sum(r.get("total_pnl", 0) for r in result.data)
view_trades = sum(r.get("total_trades", 0) for r in result.data)
print(f"\nView total PnL: ${view_pnl:,.2f}")
print(f"View total trades: {view_trades}")

# Check simulation stats table
result2 = client.table("polybot_simulation_stats").select("simulated_balance, total_pnl, total_trades").order("snapshot_at", desc=True).limit(1).execute()
if result2.data:
    s = result2.data[0]
    print(f"\nSimulation Stats Table:")
    print(f"  simulated_balance: {s.get('simulated_balance')}")
    print(f"  total_pnl: {s.get('total_pnl')}")
    print(f"  total_trades: {s.get('total_trades')}")
