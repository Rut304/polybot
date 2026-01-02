#!/usr/bin/env python3
"""
Execute SQL on Supabase via Management API

This script executes SQL directly on Supabase using their Management API.
Requires a Supabase access token (from supabase.com dashboard > Account > Access Tokens).

Usage:
  # Set your token first
  export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx
  
  # Run a SQL file
  python scripts/run_sql.py scripts/fix_all_missing_columns.sql
  
  # Or inline SQL
  python scripts/run_sql.py --sql "SELECT * FROM polybot_config LIMIT 1"

Get your access token from: https://supabase.com/dashboard/account/tokens
"""

import os
import sys
import json
import argparse
from pathlib import Path

try:
    import httpx
except ImportError:
    print("Installing httpx...")
    os.system(f"{sys.executable} -m pip install httpx")
    import httpx


# Your Supabase project reference (from URL: https://xxx.supabase.co -> xxx)
PROJECT_REF = "ytaltvltxkkfczlvjgad"  # From your SUPABASE_URL

SUPABASE_MANAGEMENT_API = "https://api.supabase.com"


def get_access_token() -> str:
    """Get Supabase access token from env or prompt."""
    # Check multiple possible env var names
    token = (
        os.environ.get('SUPABASE_ACCESS_TOKEN') or
        os.environ.get('SUPABASE_MANAGEMENT_TOKEN') or  # GitHub secret name
        os.environ.get('SUPABASE_MANAGEMENT_KEY')
    )
    if not token:
        print("\n⚠️  SUPABASE_ACCESS_TOKEN not set!")
        print("\nTo get your access token:")
        print("1. Go to https://supabase.com/dashboard/account/tokens")
        print("2. Click 'Generate new token'")
        print("3. Copy the token (starts with 'sbp_')")
        print("4. Run: export SUPABASE_ACCESS_TOKEN=sbp_your_token_here")
        print("")
        token = input("Or paste your token here (will not be saved): ").strip()
    return token


def execute_sql(sql: str, token: str) -> dict:
    """Execute SQL via Supabase Management API."""
    url = f"{SUPABASE_MANAGEMENT_API}/v1/projects/{PROJECT_REF}/database/query"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    # The Management API uses POST with query body
    response = httpx.post(
        url,
        headers=headers,
        json={"query": sql},
        timeout=30.0
    )
    
    if response.status_code == 401:
        print("❌ Authentication failed. Check your access token.")
        print("Get a new one at: https://supabase.com/dashboard/account/tokens")
        sys.exit(1)
    elif response.status_code == 403:
        print("❌ Permission denied.")
        sys.exit(1)
    elif response.status_code not in [200, 201]:
        print(f"❌ API Error: {response.status_code}")
        print(response.text)
        sys.exit(1)
    
    return response.json()


def execute_sql_statements(sql: str, token: str):
    """Execute SQL, splitting into individual statements if needed."""
    # Split by semicolons but be careful with strings
    statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
    
    print(f"📝 Executing {len(statements)} SQL statement(s)...")
    
    success_count = 0
    error_count = 0
    
    for i, stmt in enumerate(statements, 1):
        if not stmt or stmt.startswith('--'):
            continue
            
        # Skip comment-only statements
        lines = [l for l in stmt.split('\n') if l.strip() and not l.strip().startswith('--')]
        if not lines:
            continue
        
        clean_stmt = '\n'.join(lines)
        short_preview = clean_stmt[:60].replace('\n', ' ') + ('...' if len(clean_stmt) > 60 else '')
        
        try:
            result = execute_sql(clean_stmt + ';', token)
            print(f"  ✅ [{i}] {short_preview}")
            success_count += 1
            
            # Show results for SELECT statements
            if clean_stmt.upper().strip().startswith('SELECT'):
                if isinstance(result, list) and result:
                    print(f"      Results: {len(result)} rows")
                    for row in result[:5]:  # Show first 5 rows
                        print(f"        {row}")
                    if len(result) > 5:
                        print(f"        ... and {len(result) - 5} more rows")
        except Exception as e:
            print(f"  ❌ [{i}] {short_preview}")
            print(f"      Error: {e}")
            error_count += 1
    
    print(f"\n{'='*40}")
    print(f"✅ Success: {success_count} | ❌ Errors: {error_count}")
    return error_count == 0


def main():
    global PROJECT_REF
    parser = argparse.ArgumentParser(description='Execute SQL on Supabase')
    parser.add_argument('file', nargs='?', help='SQL file to execute')
    parser.add_argument('--sql', help='SQL statement to execute')
    parser.add_argument('--project', default=PROJECT_REF,
                        help='Supabase project reference')
    args = parser.parse_args()
    
    PROJECT_REF = args.project
    
    # Get SQL to execute
    if args.sql:
        sql = args.sql
    elif args.file:
        sql_file = Path(args.file)
        if not sql_file.exists():
            print(f"❌ File not found: {args.file}")
            sys.exit(1)
        sql = sql_file.read_text()
    else:
        print("Usage: python scripts/run_sql.py <file.sql>")
        print("   or: python scripts/run_sql.py --sql 'SELECT 1'")
        sys.exit(1)
    
    # Get token
    token = get_access_token()
    if not token:
        print("❌ No access token provided")
        sys.exit(1)
    
    print(f"🔗 Connecting to project: {PROJECT_REF}")
    print(f"{'='*40}")
    
    # Execute
    success = execute_sql_statements(sql, token)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
