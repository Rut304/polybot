#!/usr/bin/env python3
"""
Execute SQL on Supabase using direct Postgres connection.

This script connects directly to Supabase's Postgres database using psycopg2.
You need the database connection string from Supabase Dashboard:
  Settings > Database > Connection string > URI

Usage:
  DATABASE_URL="postgresql://..." python scripts/run_sql_direct.py scripts/fix_all_missing_columns.sql
  
Or set in .env:
  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.ytaltvltxkkfczlvjgad.supabase.co:5432/postgres
"""

import os
import sys
from pathlib import Path

# Try to load .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def get_connection():
    """Get database connection."""
    db_url = os.environ.get('DATABASE_URL')
    
    if not db_url:
        # Try to construct from Supabase URL
        supabase_url = os.environ.get('SUPABASE_URL', '')
        if 'supabase.co' in supabase_url:
            project_ref = supabase_url.split('//')[1].split('.')[0]
            print(f"\n📋 No DATABASE_URL found. To get it:")
            print(f"   1. Go to: https://supabase.com/dashboard/project/{project_ref}/settings/database")
            print(f"   2. Copy 'Connection string' > 'URI'")
            print(f"   3. Add to .env: DATABASE_URL=postgresql://...")
            print(f"\n   Or run SQL directly in Supabase SQL Editor")
        return None
    
    try:
        import psycopg2
        return psycopg2.connect(db_url)
    except ImportError:
        print("Installing psycopg2-binary...")
        os.system(f"{sys.executable} -m pip install psycopg2-binary")
        import psycopg2
        return psycopg2.connect(db_url)


def execute_sql_file(filepath: str):
    """Execute SQL file."""
    conn = get_connection()
    if not conn:
        return False
    
    sql = Path(filepath).read_text()
    
    # Split into statements
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    
    print(f"📝 Executing {len(statements)} statements from {filepath}")
    
    cur = conn.cursor()
    success = 0
    errors = 0
    
    for stmt in statements:
        # Skip comments-only
        lines = [l for l in stmt.split('\n') if l.strip() and not l.strip().startswith('--')]
        if not lines:
            continue
        
        clean = '\n'.join(lines)
        preview = clean[:50].replace('\n', ' ') + ('...' if len(clean) > 50 else '')
        
        try:
            cur.execute(clean)
            conn.commit()
            print(f"  ✅ {preview}")
            success += 1
            
            # Show SELECT results
            if clean.upper().strip().startswith('SELECT'):
                rows = cur.fetchall()
                for row in rows[:5]:
                    print(f"      {row}")
        except Exception as e:
            conn.rollback()
            print(f"  ❌ {preview}")
            print(f"      Error: {e}")
            errors += 1
    
    cur.close()
    conn.close()
    
    print(f"\n{'='*40}")
    print(f"✅ Success: {success} | ❌ Errors: {errors}")
    return errors == 0


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/run_sql_direct.py <file.sql>")
        print("       python scripts/run_sql_direct.py --sql 'SELECT 1'")
        sys.exit(1)
    
    if sys.argv[1] == '--sql':
        sql = ' '.join(sys.argv[2:])
        conn = get_connection()
        if conn:
            cur = conn.cursor()
            cur.execute(sql)
            if sql.upper().strip().startswith('SELECT'):
                for row in cur.fetchall():
                    print(row)
            conn.commit()
            cur.close()
            conn.close()
    else:
        success = execute_sql_file(sys.argv[1])
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
