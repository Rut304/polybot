#!/usr/bin/env python3
"""
Migrate secrets from Supabase to AWS Secrets Manager
Then clean up Supabase to only store metadata (no actual secret values)
"""
import os
import json
import boto3
from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv('/Users/rut/polybot/.env')

# Supabase client
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# AWS client
secrets_manager = boto3.client('secretsmanager', region_name='us-east-1')

def get_aws_secret(secret_name):
    """Get a secret from AWS Secrets Manager"""
    try:
        response = secrets_manager.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except Exception as e:
        return None

def update_aws_secret(secret_name, secret_dict):
    """Update or create a secret in AWS Secrets Manager"""
    try:
        secrets_manager.update_secret(
            SecretId=secret_name,
            SecretString=json.dumps(secret_dict)
        )
        return True
    except secrets_manager.exceptions.ResourceNotFoundException:
        # Create if doesn't exist
        secrets_manager.create_secret(
            Name=secret_name,
            SecretString=json.dumps(secret_dict)
        )
        return True
    except Exception as e:
        print(f"❌ Error updating {secret_name}: {e}")
        return False

def main():
    print("=" * 60)
    print("SECRETS MIGRATION: Supabase → AWS Secrets Manager")
    print("=" * 60)
    
    # Step 1: Get current AWS trading-keys bundle
    print("\n📥 Fetching current AWS polybot/trading-keys...")
    aws_keys = get_aws_secret('polybot/trading-keys') or {}
    print(f"   Found {len(aws_keys)} keys in AWS")
    
    # Step 2: Get all Supabase secrets with values
    print("\n📥 Fetching Supabase secrets...")
    result = supabase.table('polybot_secrets').select('*').execute()
    supabase_secrets = result.data
    
    with_values = [s for s in supabase_secrets if s.get('key_value')]
    print(f"   Found {len(supabase_secrets)} total, {len(with_values)} with values")
    
    # Step 3: Find secrets in Supabase NOT in AWS
    missing_in_aws = []
    for secret in with_values:
        key_name = secret['key_name']
        if key_name not in aws_keys:
            missing_in_aws.append(secret)
    
    print(f"\n🔍 Secrets in Supabase but NOT in AWS: {len(missing_in_aws)}")
    for s in missing_in_aws:
        print(f"   • {s['key_name']} ({s.get('category', 'unknown')})")
    
    # Step 4: Add missing secrets to AWS bundle
    if missing_in_aws:
        print(f"\n🚀 Adding {len(missing_in_aws)} secrets to AWS...")
        for secret in missing_in_aws:
            key_name = secret['key_name']
            key_value = secret['key_value']
            aws_keys[key_name] = key_value
            print(f"   ✅ Added {key_name}")
        
        # Update AWS
        print("\n📤 Updating AWS polybot/trading-keys bundle...")
        if update_aws_secret('polybot/trading-keys', aws_keys):
            print("   ✅ AWS updated successfully!")
        else:
            print("   ❌ Failed to update AWS")
            return
    else:
        print("\n✅ All Supabase secrets already in AWS!")
    
    # Step 5: Summary
    print("\n" + "=" * 60)
    print("FINAL STATE")
    print("=" * 60)
    aws_keys_final = get_aws_secret('polybot/trading-keys') or {}
    print(f"AWS polybot/trading-keys: {len(aws_keys_final)} secrets")
    
    # Show what's in AWS now
    print("\n📋 All keys now in AWS:")
    for key in sorted(aws_keys_final.keys()):
        print(f"   ✅ {key}")
    
    print("\n" + "=" * 60)
    print("NEXT STEP: Clean up Supabase (remove plain text values)")
    print("Run: python3 scripts/cleanup_supabase_secrets.py")
    print("=" * 60)

if __name__ == '__main__':
    main()
