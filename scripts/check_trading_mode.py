#!/usr/bin/env python3
"""
Run SQL migration for trading_mode columns.
Adds columns to track paper vs real trading.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
from dotenv import load_dotenv

load_dotenv()


def main():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        return False
    
    client = create_client(url, key)
    
    print("🔧 Running trading_mode migration...")
    
    # Step 1: Check current table structure
    print("\n1. Checking polybot_simulated_trades table...")
    try:
        result = client.table("polybot_simulated_trades").select("*").limit(1).execute()
        if result.data:
            existing_cols = list(result.data[0].keys())
            needed_cols = ['trading_mode', 'strategy_type', 'platform', 'session_id']
            
            missing = [col for col in needed_cols if col not in existing_cols]
            if missing:
                print(f"   ⚠️  Missing columns: {missing}")
                print("   You need to run scripts/add_trading_mode_columns.sql in Supabase SQL Editor")
            else:
                print(f"   ✓ All required columns exist")
                
            # Show a sample trade
            sample = result.data[0]
            print(f"\n   Sample trade ID: {sample.get('id')}")
            print(f"   trading_mode: {sample.get('trading_mode', 'NOT SET')}")
            print(f"   strategy_type: {sample.get('strategy_type', 'NOT SET')}")
            print(f"   platform: {sample.get('platform', 'NOT SET')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Step 2: Update records that don't have trading_mode set
    print("\n2. Updating records with missing trading_mode...")
    try:
        # Get count of records without trading_mode
        result = client.table("polybot_simulated_trades").select(
            "id", count="exact"
        ).is_("trading_mode", "null").execute()
        
        if hasattr(result, 'count') and result.count:
            print(f"   Found {result.count} records without trading_mode")
            
            # Update in batches
            # Note: Supabase doesn't support bulk update well via API
            # For large updates, use SQL directly
            print("   Run scripts/add_trading_mode_columns.sql in SQL Editor for bulk updates")
        else:
            print("   ✓ All records have trading_mode set")
            
    except Exception as e:
        print(f"   ⚠️  Could not check: {e}")
        print("   The column might not exist yet. Run the SQL migration.")
    
    # Step 3: Show current stats by trading_mode
    print("\n3. Current stats by trading mode:")
    try:
        result = client.table("polybot_simulated_trades").select(
            "trading_mode, outcome"
        ).execute()
        
        if result.data:
            modes = {}
            for trade in result.data:
                mode = trade.get('trading_mode') or 'unset'
                if mode not in modes:
                    modes[mode] = {'total': 0, 'won': 0, 'lost': 0}
                modes[mode]['total'] += 1
                if trade.get('outcome') == 'won':
                    modes[mode]['won'] += 1
                elif trade.get('outcome') == 'lost':
                    modes[mode]['lost'] += 1
            
            for mode, stats in modes.items():
                print(f"   {mode}: {stats['total']} trades ({stats['won']}W/{stats['lost']}L)")
                
    except Exception as e:
        print(f"   ⚠️  Could not get stats: {e}")
    
    print("\n" + "=" * 50)
    print("Migration check complete!")
    print("\nTo add missing columns, run in Supabase SQL Editor:")
    print("  scripts/add_trading_mode_columns.sql")
    print("=" * 50)
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
