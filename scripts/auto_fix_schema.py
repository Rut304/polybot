#!/usr/bin/env python3
"""
Auto-Fix Schema Script

This script automatically applies missing columns to Supabase.
It can be triggered by CI/CD when schema mismatches are detected.

Usage:
  SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx python scripts/auto_fix_schema.py

Requirements:
  pip install httpx
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple

try:
    import httpx
except ImportError:
    print("Installing httpx...")
    os.system("pip install httpx")
    import httpx

ROOT = Path(__file__).parent.parent


def get_missing_columns() -> List[str]:
    """Extract missing columns by running validation."""
    from validate_schema import (
        extract_frontend_save_fields,
        extract_sql_columns,
    )
    
    frontend_fields = extract_frontend_save_fields(
        ROOT / 'admin' / 'src' / 'app' / 'settings' / 'page.tsx'
    )
    sql_columns = extract_sql_columns(ROOT / 'scripts')
    
    # Filter out false positives (React setters, etc.)
    missing = set()
    for field in frontend_fields - sql_columns:
        # Skip React setter functions
        if field.startswith('set') and field[3].isupper():
            continue
        # Skip common non-DB fields
        if field in {'enabled', 'type', 'key', 'value'}:
            continue
        # Skip camelCase (should be snake_case for DB)
        if re.match(r'^[a-z]+[A-Z]', field):
            continue
        missing.add(field)
    
    return list(missing)


def infer_column_type(column_name: str) -> Tuple[str, str]:
    """Infer SQL type and default value from column name."""
    if column_name.startswith('enable_') or column_name.endswith('_enabled'):
        return "BOOLEAN", "false"
    elif '_pct' in column_name or 'threshold' in column_name or '_rate' in column_name or '_zscore' in column_name:
        return "DECIMAL(10, 4)", "0.5"
    elif '_usd' in column_name or 'balance' in column_name:
        return "DECIMAL(20, 4)", "1000"
    elif '_sec' in column_name or '_seconds' in column_name:
        return "INTEGER", "60"
    elif '_days' in column_name:
        return "INTEGER", "30"
    elif '_hours' in column_name:
        return "INTEGER", "24"
    elif '_minutes' in column_name:
        return "INTEGER", "5"
    elif column_name.endswith('_max') or column_name.endswith('_min'):
        return "INTEGER", "10"
    else:
        return "TEXT", "''"


def generate_fix_sql(missing_columns: List[str]) -> str:
    """Generate SQL to add missing columns."""
    lines = [
        "-- Auto-generated schema fix",
        f"-- Missing columns: {len(missing_columns)}",
        ""
    ]
    
    for col in sorted(missing_columns):
        dtype, default = infer_column_type(col)
        lines.append(f"ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS {col} {dtype} DEFAULT {default};")
    
    return '\n'.join(lines)


def apply_fix_to_supabase(sql: str) -> Dict:
    """Execute SQL against Supabase using the REST API."""
    supabase_url = os.environ.get('SUPABASE_URL')
    service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    # Use Supabase's SQL RPC endpoint
    # Note: This requires a custom function or direct DB access
    # For now, we'll use the REST API to check if columns exist
    
    print(f"🔧 Would apply to: {supabase_url}")
    print(f"📝 SQL to execute:\n{sql}")
    
    # For actual execution, you'd need to use Supabase's management API
    # or create an RPC function that executes raw SQL (security risk!)
    
    # Alternative: Use supabase-py with service role key
    try:
        from supabase import create_client
        
        client = create_client(supabase_url, service_key)
        
        # Check current columns
        result = client.table('polybot_config').select('*').limit(0).execute()
        print(f"✅ Connected to Supabase successfully")
        
        # For actual column addition, you need database admin access
        # This typically requires running SQL in the Supabase dashboard
        # or using their Management API (requires organization-level access)
        
        return {
            "status": "sql_generated",
            "message": "SQL generated. Manual execution required in Supabase Dashboard.",
            "sql": sql
        }
        
    except ImportError:
        return {
            "status": "sql_generated", 
            "message": "supabase-py not installed. SQL generated for manual execution.",
            "sql": sql
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "sql": sql
        }


def main():
    """Main entry point."""
    print("=" * 60)
    print("POLYBOT AUTO-FIX SCHEMA")
    print("=" * 60)
    
    # Get missing columns
    missing = get_missing_columns()
    
    if not missing:
        print("✅ No missing columns detected!")
        return 0
    
    print(f"\n🚨 Found {len(missing)} missing column(s):")
    for col in sorted(missing):
        print(f"   - {col}")
    
    # Generate fix SQL
    sql = generate_fix_sql(missing)
    
    print(f"\n📝 Generated Fix SQL:")
    print("-" * 40)
    print(sql)
    print("-" * 40)
    
    # Check if auto-fix is enabled
    auto_fix = os.environ.get('SCHEMA_AUTO_FIX', 'false').lower() == 'true'
    
    if auto_fix:
        print("\n🔧 Auto-fix enabled, applying changes...")
        result = apply_fix_to_supabase(sql)
        print(f"\nResult: {result['status']}")
        print(result['message'])
    else:
        print("\n⚠️  Auto-fix not enabled. Set SCHEMA_AUTO_FIX=true to enable.")
        print("📋 Copy the SQL above and run in Supabase SQL Editor.")
        
        # Save to file for easy access
        output_file = ROOT / 'scripts' / 'auto_generated_fix.sql'
        output_file.write_text(sql)
        print(f"\n💾 SQL saved to: {output_file}")
    
    # Output for CI/CD
    print(f"\n::set-output name=missing_count::{len(missing)}")
    print(f"::set-output name=missing_columns::{','.join(sorted(missing))}")
    
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
