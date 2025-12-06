#!/usr/bin/env python3
"""
Run SQL migrations for PolyBot.
Specifically fixes the exchange columns issue.

Usage:
    python -m scripts.run_migration
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
        print("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env")
        print("   Set these environment variables and try again.")
        return False
    
    print("🔧 Running exchange columns migration...")
    print(f"   Database: {url.split('//')[1].split('.')[0]}...")
    
    client = create_client(url, key)
    
    # Check current config state
    print("\n1. Checking current polybot_config...")
    try:
        result = client.table("polybot_config").select("*").eq("id", 1).execute()
        if result.data:
            config = result.data[0]
            print(f"   ✓ Found config row with id=1")
            
            # Check if exchange columns exist
            exchange_cols = ['enable_binance', 'enable_bybit', 'enable_okx', 
                           'enable_kraken', 'enable_coinbase', 'enable_kucoin',
                           'enable_alpaca', 'enable_ibkr']
            
            existing = [col for col in exchange_cols if col in config]
            missing = [col for col in exchange_cols if col not in config]
            
            if missing:
                print(f"   ⚠️  Missing columns: {missing}")
                print("   These columns need to be added via SQL Editor in Supabase Dashboard.")
            else:
                print(f"   ✓ All exchange columns exist")
                
            # Show current values
            print("\n2. Current exchange settings:")
            for col in exchange_cols:
                value = config.get(col, "NOT SET")
                status = "🔴" if value is True else "⚪"
                print(f"   {status} {col}: {value}")
                
        else:
            print("   ⚠️  No config row found with id=1!")
            
    except Exception as e:
        print(f"   ❌ Error checking config: {e}")
        return False
    
    # Try to update the columns to ensure they're set to false
    print("\n3. Setting all exchange toggles to false (if null)...")
    try:
        # Get current values first
        result = client.table("polybot_config").select("*").eq("id", 1).execute()
        if result.data:
            config = result.data[0]
            update_data = {}
            
            for col in ['enable_binance', 'enable_bybit', 'enable_okx', 
                       'enable_kraken', 'enable_coinbase', 'enable_kucoin',
                       'enable_alpaca', 'enable_ibkr']:
                # Only update if the column exists and is None
                if col in config and config[col] is None:
                    update_data[col] = False
                    
            if update_data:
                client.table("polybot_config").update(update_data).eq("id", 1).execute()
                print(f"   ✓ Updated {len(update_data)} columns to false")
            else:
                print("   ✓ No null values to update")
                
    except Exception as e:
        print(f"   ⚠️  Could not update columns: {e}")
        print("      This might mean the columns don't exist yet.")
        print("      Run the SQL migration in Supabase Dashboard:")
        print("      scripts/fix_exchange_columns.sql")
    
    # Verify final state
    print("\n4. Final exchange settings:")
    try:
        result = client.table("polybot_config").select("*").eq("id", 1).execute()
        if result.data:
            config = result.data[0]
            for col in ['enable_binance', 'enable_bybit', 'enable_okx', 
                       'enable_kraken', 'enable_coinbase', 'enable_kucoin',
                       'enable_alpaca', 'enable_ibkr']:
                value = config.get(col, "NOT SET")
                status = "🔴" if value is True else "⚪"
                print(f"   {status} {col}: {value}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        
    print("\n" + "=" * 50)
    print("Migration check complete!")
    print("\nIf columns are missing, run this SQL in Supabase Dashboard:")
    print("  scripts/fix_exchange_columns.sql")
    print("\nThen redeploy the admin UI to Vercel.")
    print("=" * 50)
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
