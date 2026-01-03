#!/usr/bin/env python3
"""
Clean up Supabase polybot_secrets table - remove plain text values.
Secrets are now stored securely in AWS Secrets Manager.
Only metadata (key_name, description, category, is_configured) remains.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv('/Users/rut/polybot/.env')

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def main():
    print("=" * 60)
    print("CLEANUP: Remove plain text secrets from Supabase")
    print("=" * 60)
    
    # Get secrets with values
    result = supabase.table('polybot_secrets').select('key_name, key_value').execute()
    with_values = [s for s in result.data if s.get('key_value')]
    
    print(f"\n⚠️  Found {len(with_values)} secrets with plain text values")
    
    if not with_values:
        print("✅ No cleanup needed - Supabase is already clean!")
        return
    
    # Confirm before proceeding
    print("\nSecrets to clean:")
    for s in with_values:
        print(f"   • {s['key_name']}")
    
    print("\n" + "=" * 60)
    confirm = input("🔒 Type 'CONFIRM' to remove plain text values: ")
    
    if confirm != 'CONFIRM':
        print("❌ Aborted. No changes made.")
        return
    
    # Null out all key_value fields
    print("\n🧹 Cleaning up...")
    cleaned = 0
    for secret in with_values:
        key_name = secret['key_name']
        try:
            supabase.table('polybot_secrets').update({
                'key_value': None
            }).eq('key_name', key_name).execute()
            print(f"   ✅ Cleaned {key_name}")
            cleaned += 1
        except Exception as e:
            print(f"   ❌ Failed {key_name}: {e}")
    
    print(f"\n✅ Cleaned {cleaned}/{len(with_values)} secrets")
    
    # Verify
    result = supabase.table('polybot_secrets').select('key_name, key_value').execute()
    remaining = [s for s in result.data if s.get('key_value')]
    
    if remaining:
        print(f"\n⚠️  {len(remaining)} secrets still have values")
    else:
        print("\n🔒 SUCCESS! Supabase no longer stores plain text secrets.")
        print("   All secrets are now securely stored in AWS Secrets Manager.")


if __name__ == '__main__':
    main()
