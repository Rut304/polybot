#!/usr/bin/env python3
"""
Add Encrypted Secret to PolyBot Vault

Usage:
  python scripts/add_secret.py --user-id UUID --key API_KEY_NAME
"""

import sys
import os
import argparse
import getpass
import logging
from uuid import UUID

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database.client import Database
from src.utils.vault import Vault

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("add_secret")


def main():
    parser = argparse.ArgumentParser(description="Add encrypted secret to PolyBot Vault")
    parser.add_argument("--user-id", required=True, help="Target User UUID")
    parser.add_argument("--key", required=True, help="Name of the key (e.g. OPENAI_API_KEY)")
    parser.add_argument("--value", help="Value of the secret (if omitted, will prompt securely)")
    
    args = parser.parse_args()
    
    # Validate UUID
    try:
        user_uuid = str(UUID(args.user_id))
    except ValueError:
        logger.error("❌ Invalid UUID format for user-id")
        sys.exit(1)

    # Get secret value
    value = args.value
    if not value:
        value = getpass.getpass(f"Enter value for {args.key}: ")
        if not value:
            logger.error("❌ Value cannot be empty")
            sys.exit(1)

    # Initialize Vault
    try:
        vault = Vault()
    except Exception as e:
        logger.error(f"❌ Failed to initialize vault: {e}")
        logger.error("Ensure POLYBOT_MASTER_KEY is set in environment.")
        sys.exit(1)
        
    if not vault._fernet:
        logger.error("❌ Vault not initialized (missing POLYBOT_MASTER_KEY)")
        sys.exit(1)

    # Encrypt
    try:
        encrypted_value = vault.encrypt(value)
        logger.info("🔒 Value encrypted successfully")
    except Exception as e:
        logger.error(f"❌ Encryption failed: {e}")
        sys.exit(1)

    # Save to Database
    try:
        db = Database(user_id=user_uuid)
        if not db._client:
            logger.error("❌ Database connection failed")
            sys.exit(1)
            
        # Upsert into polybot_key_vault
        data = {
            "user_id": user_uuid,
            "key_name": args.key,
            "encrypted_value": encrypted_value,
            "updated_at": "now()"
        }
        
        result = db._client.table("polybot_key_vault").upsert(
            data, on_conflict="user_id, key_name"
        ).execute()
        
        logger.info(f"✅ Secret '{args.key}' saved to vault for user {user_uuid}")
        
    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
