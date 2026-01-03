#!/usr/bin/env python3
"""
Check live trading configuration and Kalshi credentials.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

def main():
    print("=" * 60)
    print("🔍 LIVE TRADING CONFIGURATION CHECK")
    print("=" * 60)
    
    # Check Supabase connection
    sb_url = os.getenv('SUPABASE_URL')
    sb_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not sb_url or not sb_key:
        print("❌ Missing Supabase credentials")
        return
    
    sb = create_client(sb_url, sb_key)
    
    # Check config
    print("\n📋 Database Config (polybot_config):")
    result = sb.table('polybot_config').select('*').execute()
    
    important_keys = ['simulation_mode', 'enable_kalshi_single_arb', 'max_position_size', 
                      'kalshi_enabled', 'trading_mode', 'live_trading_enabled']
    
    config_dict = {}
    if result.data:
        for row in result.data:
            key = row.get('key', '')
            val = row.get('value')
            config_dict[key] = val
            
        for key in important_keys:
            if key in config_dict:
                print(f"  {key}: {config_dict[key]}")
            else:
                print(f"  {key}: NOT SET")
    else:
        print("  No config found in table")
    
    # Check Kalshi credentials
    print("\n🔑 Kalshi Credentials:")
    kalshi_api = os.getenv('KALSHI_API_KEY')
    kalshi_key_path = os.getenv('KALSHI_PRIVATE_KEY_PATH')
    
    if kalshi_api:
        print(f"  KALSHI_API_KEY: ✅ Set ({kalshi_api[:8]}...)")
    else:
        print(f"  KALSHI_API_KEY: ❌ Not set")
    
    if kalshi_key_path:
        if os.path.exists(kalshi_key_path):
            print(f"  KALSHI_PRIVATE_KEY_PATH: ✅ {kalshi_key_path} (exists)")
        else:
            print(f"  KALSHI_PRIVATE_KEY_PATH: ❌ {kalshi_key_path} (FILE NOT FOUND)")
    else:
        print(f"  KALSHI_PRIVATE_KEY_PATH: ❌ Not set")
    
    # Test Kalshi API connection
    print("\n🔌 Testing Kalshi API Connection...")
    try:
        from src.exchanges.kalshi_client import KalshiClient
        
        # Read private key
        if kalshi_key_path and os.path.exists(kalshi_key_path):
            with open(kalshi_key_path, 'r') as f:
                private_key = f.read()
            
            client = KalshiClient(
                api_key=kalshi_api,
                private_key=private_key,
                paper=False  # Test LIVE connection
            )
            
            # Get balance
            balance = client.get_balance()
            print(f"  ✅ Kalshi LIVE balance: ${balance:.2f}")
        else:
            print("  ❌ Cannot test - private key not available")
            
    except Exception as e:
        print(f"  ❌ Kalshi connection failed: {e}")
    
    print("\n" + "=" * 60)
    print("📝 TO ENABLE LIVE KALSHI TRADING:")
    print("=" * 60)
    print("""
1. Update database config:
   UPDATE polybot_config SET value = 'false' WHERE key = 'simulation_mode';
   
2. Or run bot with --live flag (if supported)

3. Or set environment variable:
   SIMULATION_MODE=false
   
CAUTION: Live trading uses REAL money!
""")

if __name__ == "__main__":
    main()
