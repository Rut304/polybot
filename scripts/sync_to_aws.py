import boto3
import json
import os
from pathlib import Path

def load_env(env_path):
    secrets = {}
    if not os.path.exists(env_path):
        return secrets
        
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                # handle comments inline
                value = value.split('#')[0].strip()
                # remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                secrets[key.strip()] = value
    return secrets

def main():
    print("Loading local secrets...")
    env_secrets = load_env('.env')
    
    # Load private key file if referenced
    if 'KALSHI_PRIVATE_KEY_PATH' in env_secrets:
        key_path = env_secrets['KALSHI_PRIVATE_KEY_PATH']
        if os.path.exists(key_path):
            print(f"Loading private key from {key_path}")
            with open(key_path, 'r') as f:
                env_secrets['KALSHI_PRIVATE_KEY'] = f.read()
        else:
            print(f"Warning: Key file {key_path} not found")

    # Filter for known keys we want to push
    # We push everything that looks like an API key or config
    # but exclude local-only stuff like DRY_RUN if desired. 
    # For now, pushing most relevant keys.
    
    # List of keys that mapping logic expects (from pul-aws route)
    EXPECTED_KEYS = [
        'BINANCE_API_KEY', 'BINANCE_API_SECRET',
        'POLYMARKET_API_KEY', 'POLYMARKET_SECRET', 'POLYMARKET_WALLET_ADDRESS', 'POLYMARKET_PRIVATE_KEY',
        'KALSHI_API_KEY', 'KALSHI_PRIVATE_KEY',
        'BYBIT_API_KEY', 'BYBIT_API_SECRET',
        'OKX_API_KEY', 'OKX_API_SECRET', 'OKX_PASSPHRASE',
        'KRAKEN_API_KEY', 'KRAKEN_API_SECRET',
        'COINBASE_API_KEY', 'COINBASE_API_SECRET',
        'KUCOIN_API_KEY', 'KUCOIN_API_SECRET', 'KUCOIN_PASSPHRASE',
        'ALPACA_API_KEY', 'ALPACA_API_SECRET',
        'ALPACA_PAPER_API_KEY', 'ALPACA_PAPER_API_SECRET',
        'FINNHUB_API_KEY', 'NEWSAPI_KEY',
        'TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_BEARER_TOKEN', 'X_API_KEY', 'X_API_KEY_SECRET', 'X_BEARER_TOKEN',
        'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY',
        'IBKR_USERNAME', 'IBKR_PASSWORD',
        'GEMINI_API_KEY'
    ]
    
    # Normalize X keys to TWITTER keys if needed or keep both
    if 'X_API_KEY' in env_secrets: env_secrets['TWITTER_API_KEY'] = env_secrets['X_API_KEY']
    if 'X_API_KEY_SECRET' in env_secrets: env_secrets['TWITTER_API_SECRET'] = env_secrets['X_API_KEY_SECRET']
    if 'X_BEARER_TOKEN' in env_secrets: env_secrets['TWITTER_BEARER_TOKEN'] = env_secrets['X_BEARER_TOKEN']

    payload = {}
    for k in EXPECTED_KEYS:
        if k in env_secrets:
            payload[k] = env_secrets[k]
            
    print(f"Prepared {len(payload)} secrets to sync to AWS.")
    
    client = boto3.client('secretsmanager', region_name='us-east-1') # Lightsail region
    
    secret_name = 'polybot/trading-keys'
    
    print(f"Updating AWS Secret: {secret_name}")
    try:
        client.put_secret_value(
            SecretId=secret_name,
            SecretString=json.dumps(payload, indent=2)
        )
        print("Successfully updated secrets in AWS.")
    except client.exceptions.ResourceNotFoundException:
        print("Secret not found, creating...")
        client.create_secret(
            Name=secret_name,
            SecretString=json.dumps(payload, indent=2)
        )
        print("Created new secret.")
    except Exception as e:
        print(f"Error updating AWS: {e}")

if __name__ == "__main__":
    main()
