#!/usr/bin/env python3
"""
View PolyBot paper trading stats.

Usage:
    python -m scripts.view_stats
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
from dotenv import load_dotenv
import json

load_dotenv()


def main():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("❌ SUPABASE_URL and SUPABASE_KEY required in .env")
        return
    
    client = create_client(url, key)
    
    print("\n" + "=" * 60)
    print("📊 POLYBOT PAPER TRADING STATS")
    print("=" * 60)
    
    # Get latest stats snapshot
    stats_result = client.table("polybot_simulation_stats").select(
        "*"
    ).order("snapshot_at", desc=True).limit(1).execute()
    
    if stats_result.data:
        latest = stats_result.data[0]
        stats = json.loads(latest["stats_json"]) if latest["stats_json"] else {}
        
        print(f"\n📅 Last Updated: {latest['snapshot_at']}")
        print(f"💰 Simulated Balance: ${latest['simulated_balance']:.2f}")
        print(f"📈 Total P&L: ${latest['total_pnl']:+.2f}")
        print(f"🎯 Win Rate: {latest['win_rate']:.1f}%")
        print(f"📊 Total Trades: {latest['total_trades']}")
        
        if stats:
            print(f"\n📉 Largest Opportunity: {stats.get('largest_opportunity_seen_pct', 'N/A')}%")
            print(f"🏆 Best Trade: ${stats.get('best_trade_profit', '0')}")
    else:
        print("\n⚠️  No stats snapshots yet. Run the bot first!")
    
    # Get recent simulated trades
    print("\n" + "-" * 60)
    print("📝 RECENT SIMULATED TRADES")
    print("-" * 60)
    
    trades_result = client.table("polybot_simulated_trades").select(
        "*"
    ).order("created_at", desc=True).limit(10).execute()
    
    if trades_result.data:
        for trade in trades_result.data:
            profit = trade.get("expected_profit_usd", 0) or 0
            pct = trade.get("expected_profit_pct", 0) or 0
            print(f"\n  {trade['position_id']}")
            print(f"  └─ Size: ${trade['position_size_usd']:.2f} | "
                  f"Profit: ${profit:.2f} ({pct:.2f}%)")
            print(f"  └─ {trade['trade_type']}")
            print(f"  └─ Outcome: {trade['outcome']}")
    else:
        print("\n  No simulated trades yet. Run the bot first!")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
