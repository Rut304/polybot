#!/usr/bin/env python3
"""
Diagnostic script to investigate why the bot isn't trading.
Run this to get insight into what the bot is actually doing.
"""

import os
import sys
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

def main():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return
    
    client = create_client(url, key)
    
    print("=" * 70)
    print("🔍 POLYBOT DIAGNOSTIC REPORT")
    print("=" * 70)
    print()
    
    # 1. Check bot status
    print("📊 BOT STATUS (polybot_status)")
    print("-" * 50)
    try:
        result = client.table("polybot_status").select("*").limit(1).execute()
        if result.data:
            status = result.data[0]
            print(f"  is_running: {status.get('is_running')}")
            print(f"  dry_run_mode: {status.get('dry_run_mode')}")
            print(f"  last_heartbeat_at: {status.get('last_heartbeat_at')}")
            print(f"  last_started_at: {status.get('last_started_at')}")
            print(f"  version: {status.get('version')}")
            
            # Calculate how long ago heartbeat was
            heartbeat = status.get('last_heartbeat_at')
            if heartbeat:
                hb_time = datetime.fromisoformat(heartbeat.replace('Z', '+00:00'))
                diff = datetime.now(hb_time.tzinfo) - hb_time
                print(f"  ⏱️ Heartbeat age: {diff.total_seconds() / 60:.1f} minutes ago")
        else:
            print("  ❌ No status row found!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    # 2. Check recent heartbeats
    print("💓 RECENT HEARTBEATS (polybot_heartbeat)")
    print("-" * 50)
    try:
        result = client.table("polybot_heartbeat").select(
            "timestamp, scan_count, active_strategies, errors_last_hour, trades_last_hour"
        ).order("timestamp", desc=True).limit(5).execute()
        if result.data:
            for hb in result.data:
                print(f"  {hb.get('timestamp')}:")
                print(f"    scan_count: {hb.get('scan_count')}")
                print(f"    active_strategies: {hb.get('active_strategies')}")
                print(f"    errors_last_hour: {hb.get('errors_last_hour')}")
                print(f"    trades_last_hour: {hb.get('trades_last_hour')}")
        else:
            print("  ❌ No heartbeats found!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    # 3. Check config (what strategies are enabled)
    print("⚙️ BOT CONFIG (polybot_config id=1)")
    print("-" * 50)
    try:
        result = client.table("polybot_config").select(
            "enable_polymarket_single_arb, enable_kalshi_single_arb, enable_cross_platform_arb, "
            "enable_market_making, enable_news_arbitrage, enable_funding_rate_arb, "
            "enable_grid_trading, dry_run, poly_single_min_profit_pct, kalshi_single_min_profit_pct"
        ).eq("id", 1).single().execute()
        if result.data:
            config = result.data
            print(f"  dry_run: {config.get('dry_run')}")
            print(f"  enable_polymarket_single_arb: {config.get('enable_polymarket_single_arb')}")
            print(f"  enable_kalshi_single_arb: {config.get('enable_kalshi_single_arb')}")
            print(f"  enable_cross_platform_arb: {config.get('enable_cross_platform_arb')}")
            print(f"  enable_market_making: {config.get('enable_market_making')}")
            print(f"  enable_news_arbitrage: {config.get('enable_news_arbitrage')}")
            print(f"  enable_funding_rate_arb: {config.get('enable_funding_rate_arb')}")
            print(f"  enable_grid_trading: {config.get('enable_grid_trading')}")
            print(f"  poly_single_min_profit_pct: {config.get('poly_single_min_profit_pct')}")
            print(f"  kalshi_single_min_profit_pct: {config.get('kalshi_single_min_profit_pct')}")
        else:
            print("  ❌ No config found for id=1!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    # 4. Check recent market scans
    print("🔎 RECENT MARKET SCANS (polybot_market_scans)")
    print("-" * 50)
    try:
        result = client.table("polybot_market_scans").select(
            "scanned_at, scanner_type, platform, qualifies_for_trade, rejection_reason"
        ).order("scanned_at", desc=True).limit(10).execute()
        if result.data:
            print(f"  Found {len(result.data)} recent scans")
            for scan in result.data:
                qual = "✅" if scan.get('qualifies_for_trade') else "❌"
                reason = scan.get('rejection_reason', '-')
                print(f"    {scan.get('scanned_at')}: {scan.get('scanner_type')} | {scan.get('platform')} | {qual} | {reason[:40]}")
        else:
            print("  ⚠️ No market scans found! Bot may not be scanning.")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    # 5. Count scans in last hour
    print("📈 SCAN COUNTS (last hour)")
    print("-" * 50)
    try:
        one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        result = client.table("polybot_market_scans").select(
            "*", count="exact"
        ).gte("scanned_at", one_hour_ago).execute()
        total_scans = result.count or 0
        print(f"  Total scans in last hour: {total_scans}")
        
        # Count by scanner type
        result = client.table("polybot_market_scans").select(
            "scanner_type"
        ).gte("scanned_at", one_hour_ago).execute()
        if result.data:
            from collections import Counter
            types = Counter(s['scanner_type'] for s in result.data)
            for scanner, count in types.items():
                print(f"    {scanner}: {count}")
        
        # Count qualifying vs rejected
        result = client.table("polybot_market_scans").select(
            "qualifies_for_trade"
        ).gte("scanned_at", one_hour_ago).execute()
        if result.data:
            qualifying = sum(1 for s in result.data if s.get('qualifies_for_trade'))
            rejected = len(result.data) - qualifying
            print(f"  Qualifying: {qualifying}, Rejected: {rejected}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    # 6. Check opportunities table
    print("💰 RECENT OPPORTUNITIES (polybot_opportunities)")
    print("-" * 50)
    try:
        result = client.table("polybot_opportunities").select(
            "created_at, arb_type, platform, profit_pct, status, executed"
        ).order("created_at", desc=True).limit(10).execute()
        if result.data:
            for opp in result.data:
                exec_status = "✅" if opp.get('executed') else "⏳"
                print(f"  {opp.get('created_at')}: {opp.get('arb_type')} | {opp.get('platform')} | {opp.get('profit_pct'):.2f}% | {exec_status} {opp.get('status')}")
        else:
            print("  ⚠️ No opportunities logged!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    # 7. Check recent trades
    print("📈 RECENT TRADES (polybot_simulated_trades)")
    print("-" * 50)
    try:
        result = client.table("polybot_simulated_trades").select(
            "created_at, platform, strategy, side, quantity, price, pnl"
        ).order("created_at", desc=True).limit(10).execute()
        if result.data:
            for trade in result.data:
                pnl = trade.get('pnl', 0) or 0
                pnl_str = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
                print(f"  {trade.get('created_at')}: {trade.get('platform')} | {trade.get('strategy')} | {trade.get('side')} | ${trade.get('price', 0):.2f} | {pnl_str}")
        else:
            print("  ⚠️ No trades found!")
            
        # Find last trade time
        result = client.table("polybot_simulated_trades").select(
            "created_at"
        ).order("created_at", desc=True).limit(1).execute()
        if result.data:
            last_trade = result.data[0].get('created_at')
            print(f"\n  ⏱️ Last trade: {last_trade}")
            if last_trade:
                lt_time = datetime.fromisoformat(last_trade.replace('Z', '+00:00'))
                diff = datetime.now(lt_time.tzinfo) - lt_time
                hours = diff.total_seconds() / 3600
                print(f"  ⏱️ Time since last trade: {hours:.1f} hours")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    # 8. Check recent logs for errors
    print("📋 RECENT ERROR LOGS (polybot_logs)")
    print("-" * 50)
    try:
        result = client.table("polybot_logs").select(
            "timestamp, level, message"
        ).eq("level", "ERROR").order("timestamp", desc=True).limit(10).execute()
        if result.data:
            for log in result.data:
                msg = log.get('message', '')[:80]
                print(f"  {log.get('timestamp')}: {msg}")
        else:
            print("  ✅ No recent errors!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()
    
    print("=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()
