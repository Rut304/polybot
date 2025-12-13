#!/usr/bin/env python3
"""
Populate polybot_secrets table from environment variables.

This script ensures API credentials persist in Supabase rather than
relying on ephemeral container environment variables.

Run this once after deployment or when adding new credentials.
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client


def get_supabase_client():
    """Get Supabase client from environment, using service role key to bypass RLS."""
    # Try .env file first
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ.setdefault(key, value.strip('"').strip("'"))
    
    url = os.environ.get('SUPABASE_URL')
    # MUST use service role key to bypass RLS policies on polybot_secrets
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_KEY')
    
    if not url or not key:
        print("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        sys.exit(1)
    
    if 'service_role' not in key:
        print("⚠️ Warning: Using anon key, may fail due to RLS policies")
        print("   Set SUPABASE_SERVICE_ROLE_KEY for full access")
    
    return create_client(url, key)


def ensure_secrets_table(client):
    """Create secrets table if it doesn't exist."""
    try:
        client.table('polybot_secrets').select('key_name').limit(1).execute()
        print("✓ polybot_secrets table exists")
    except Exception as e:
        print(f"⚠️ polybot_secrets table may not exist: {e}")
        print("Please run the schema migration first.")
        sys.exit(1)


def upsert_secret(client, key_name: str, key_value: str, description: str = "", category: str = ""):
    """Insert or update a secret."""
    if not key_value:
        print(f"  ⏭️  {key_name}: No value, skipping")
        return False
    
    try:
        data = {
            "key_name": key_name,
            "key_value": key_value,
            "is_configured": True,
            "description": description,
            "category": category,
        }
        
        # Upsert (insert or update on conflict)
        client.table('polybot_secrets').upsert(
            data,
            on_conflict='key_name'
        ).execute()
        
        # Mask the value for display
        masked = key_value[:8] + "..." if len(key_value) > 8 else "***"
        print(f"  ✅ {key_name}: {masked}")
        return True
        
    except Exception as e:
        print(f"  ❌ {key_name}: Failed - {e}")
        return False


def main():
    print("=" * 60)
    print("POPULATING POLYBOT SECRETS TABLE")
    print("=" * 60)
    
    client = get_supabase_client()
    ensure_secrets_table(client)
    
    # Load environment variables from .env
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    env_vars[key] = value.strip('"').strip("'")
    
    # Define all secrets to populate
    secrets = [
        # Prediction Markets
        ("POLYMARKET_API_KEY", "Polymarket API Key", "prediction_markets"),
        ("POLYMARKET_SECRET", "Polymarket API Secret", "prediction_markets"),
        ("POLYMARKET_PRIVATE_KEY", "Polymarket Wallet Private Key", "prediction_markets"),
        ("KALSHI_API_KEY", "Kalshi API Key", "prediction_markets"),
        ("KALSHI_PRIVATE_KEY", "Kalshi Private Key (PEM content)", "prediction_markets"),
        
        # Crypto Exchanges
        ("BINANCE_API_KEY", "Binance API Key", "crypto_exchanges"),
        ("BINANCE_API_SECRET", "Binance API Secret", "crypto_exchanges"),
        ("COINBASE_API_KEY", "Coinbase API Key", "crypto_exchanges"),
        ("COINBASE_API_SECRET", "Coinbase API Secret", "crypto_exchanges"),
        ("BYBIT_API_KEY", "Bybit API Key", "crypto_exchanges"),
        ("BYBIT_API_SECRET", "Bybit API Secret", "crypto_exchanges"),
        ("KRAKEN_API_KEY", "Kraken API Key", "crypto_exchanges"),
        ("KRAKEN_API_SECRET", "Kraken API Secret", "crypto_exchanges"),
        ("OKX_API_KEY", "OKX API Key", "crypto_exchanges"),
        ("OKX_API_SECRET", "OKX API Secret", "crypto_exchanges"),
        ("KUCOIN_API_KEY", "KuCoin API Key", "crypto_exchanges"),
        ("KUCOIN_API_SECRET", "KuCoin API Secret", "crypto_exchanges"),
        
        # Stock Brokers
        ("ALPACA_API_KEY", "Alpaca API Key", "stock_brokers"),
        ("ALPACA_API_SECRET", "Alpaca API Secret", "stock_brokers"),
        ("ALPACA_PAPER_API_KEY", "Alpaca Paper Trading API Key", "stock_brokers"),
        ("ALPACA_PAPER_API_SECRET", "Alpaca Paper Trading API Secret", "stock_brokers"),
        ("IBKR_USERNAME", "Interactive Brokers Username", "stock_brokers"),
        ("IBKR_PASSWORD", "Interactive Brokers Password", "stock_brokers"),
        
        # News/Data APIs
        ("NEWS_API_KEY", "NewsAPI.org API Key", "news_data"),
        ("FINNHUB_API_KEY", "Finnhub API Key", "news_data"),
        ("TWITTER_BEARER_TOKEN", "Twitter API Bearer Token", "news_data"),
        ("ALPHA_VANTAGE_API_KEY", "Alpha Vantage API Key", "news_data"),
        
        # Notifications
        ("DISCORD_WEBHOOK", "Discord Webhook URL", "notifications"),
        ("TELEGRAM_BOT_TOKEN", "Telegram Bot Token", "notifications"),
        ("TELEGRAM_CHAT_ID", "Telegram Chat ID", "notifications"),
    ]
    
    print("\nPopulating secrets from environment variables...")
    print("-" * 60)
    
    success_count = 0
    for key_name, description, category in secrets:
        value = env_vars.get(key_name) or os.environ.get(key_name)
        if upsert_secret(client, key_name, value, description, category):
            success_count += 1
    
    print("-" * 60)
    print(f"\n✅ Populated {success_count} secrets")
    
    # Read Kalshi private key from file if exists
    kalshi_key_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'keys', 'kalshi_private.pem'
    )
    if os.path.exists(kalshi_key_path):
        print("\nFound Kalshi private key file, uploading...")
        with open(kalshi_key_path, 'r') as f:
            key_content = f.read()
        if upsert_secret(
            client, 
            "KALSHI_PRIVATE_KEY", 
            key_content,
            "Kalshi Private Key (PEM content)",
            "prediction_markets"
        ):
            success_count += 1
    
    print("\n✅ Done! Secrets are now persistent in Supabase.")
    return success_count


if __name__ == "__main__":
    main()
