#!/usr/bin/env python3
"""
Fix the Bybit toggle - set it to false in the database.
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
    
    print("🔧 Setting enable_bybit to FALSE in database...")
    
    try:
        # Update the config to set enable_bybit to false
        result = client.table("polybot_config").update({
            "enable_bybit": False
        }).eq("id", 1).execute()
        
        print("   ✓ Updated enable_bybit to False")
        
        # Verify
        verify = client.table("polybot_config").select(
            "enable_bybit"
        ).eq("id", 1).execute()
        
        if verify.data:
            new_value = verify.data[0].get("enable_bybit")
            print(f"   ✓ Verified: enable_bybit = {new_value}")
            return new_value == False
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
