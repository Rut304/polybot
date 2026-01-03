#!/usr/bin/env python3
"""
Run add_news_api_keys.sql via Supabase Python client
"""
import os
import sys
from dotenv import load_dotenv

# Load env from project root
load_dotenv('/Users/rut/polybot/.env')

from supabase import create_client

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

print(f"✅ URL: {url}")
print(f"✅ Key: {key[:20]}...")

client = create_client(url, key)

# Check before
result = client.table('polybot_secrets').select('key_name, description, category').eq('category', 'news_sentiment').execute()
print(f'\n📊 Before: {len(result.data)} news_sentiment keys')

# Upsert all news API keys
data = [
    {'key_name': 'FINNHUB_API_KEY', 'description': 'Finnhub API key - Real-time market news & sentiment (60 calls/min free)', 'category': 'news_sentiment'},
    {'key_name': 'NEWS_API_KEY', 'description': 'NewsAPI.org API key - General news aggregator (100 req/day free)', 'category': 'news_sentiment'},
    {'key_name': 'NEWSAPI_KEY', 'description': 'NewsAPI.org API key (alternate key name)', 'category': 'news_sentiment'},
    {'key_name': 'ALPHAVANTAGE_API_KEY', 'description': 'Alpha Vantage API key - News with sentiment scores (25 req/day free)', 'category': 'news_sentiment'},
    {'key_name': 'ALPHA_VANTAGE_API_KEY', 'description': 'Alpha Vantage API key (alternate key name)', 'category': 'news_sentiment'},
    {'key_name': 'TWITTER_API_KEY', 'description': 'Twitter/X API key for social sentiment', 'category': 'news_sentiment'},
    {'key_name': 'TWITTER_API_SECRET', 'description': 'Twitter/X API secret', 'category': 'news_sentiment'},
    {'key_name': 'TWITTER_BEARER_TOKEN', 'description': 'Twitter/X Bearer token for API v2 (required for search)', 'category': 'news_sentiment'},
    {'key_name': 'POLYGON_API_KEY', 'description': 'Polygon.io API key for market data & news', 'category': 'news_sentiment'},
    {'key_name': 'BENZINGA_API_KEY', 'description': 'Benzinga API key for professional financial news', 'category': 'news_sentiment'},
    {'key_name': 'NEWSDATA_API_KEY', 'description': 'NewsData.io API key - Alternative news source', 'category': 'news_sentiment'},
]

print('\n🔄 Upserting news API keys...')
result = client.table('polybot_secrets').upsert(data, on_conflict='key_name').execute()
print(f'✅ Upserted {len(result.data)} rows')

# Verify after
result = client.table('polybot_secrets').select('key_name, description, category, is_configured').eq('category', 'news_sentiment').execute()
print(f'\n📊 After: {len(result.data)} news_sentiment keys:')
for row in result.data:
    configured = '✅ Set' if row.get('is_configured') else '❌ Not set'
    print(f"  • {row['key_name']} - {configured}")

print('\n✅ Done! You can now set the API key values in the Settings page.')
