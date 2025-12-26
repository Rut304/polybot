#!/usr/bin/env python3
"""
Run SQL migration against Supabase using psycopg2.
This bypasses the REST API limitations for DDL statements.
"""

import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

def run_migration():
    """Execute the SaaS profile migration SQL."""
    import psycopg2
    
    # Get database URL from Supabase
    supabase_url = os.getenv('SUPABASE_URL', '')
    # Extract project ref from URL
    # https://ytaltvltxkkfczlvjgad.supabase.co -> ytaltvltxkkfczlvjgad
    project_ref = supabase_url.replace('https://', '').replace('.supabase.co', '')
    
    # Build connection string for direct postgres access
    # Supabase direct connection: postgres://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
    db_password = os.getenv('SUPABASE_DB_PASSWORD', '')
    
    if not db_password:
        # Try to use service role key as fallback for connection
        print("⚠️  SUPABASE_DB_PASSWORD not set.")
        print("Please run this SQL directly in Supabase Dashboard > SQL Editor")
        print(f"File: scripts/saas_profile_migration.sql")
        return False
    
    conn_string = f"postgresql://postgres.{project_ref}:{db_password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    
    try:
        print("🔗 Connecting to Supabase PostgreSQL...")
        conn = psycopg2.connect(conn_string)
        conn.autocommit = True
        cur = conn.cursor()
        
        # Read migration file
        migration_path = Path(__file__).parent / 'saas_profile_migration.sql'
        sql = migration_path.read_text()
        
        print("📝 Running SaaS profile migration...")
        
        # Split into statements and execute
        statements = sql.split(';')
        for i, stmt in enumerate(statements):
            stmt = stmt.strip()
            if stmt and not stmt.startswith('--'):
                try:
                    cur.execute(stmt)
                    print(f"  ✓ Statement {i+1} executed")
                except Exception as e:
                    if 'already exists' in str(e).lower():
                        print(f"  ⏭️  Statement {i+1} skipped (already exists)")
                    else:
                        print(f"  ❌ Statement {i+1} failed: {e}")
        
        print("✅ Migration complete!")
        
        # Verify columns
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'polybot_profiles'
            ORDER BY ordinal_position
        """)
        print("\n📋 polybot_profiles columns:")
        for row in cur.fetchall():
            print(f"  - {row[0]}: {row[1]}")
        
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\n💡 To run manually:")
        print("1. Go to Supabase Dashboard > SQL Editor")
        print("2. Paste contents of scripts/saas_profile_migration.sql")
        print("3. Click 'Run'")
        return False

if __name__ == '__main__':
    run_migration()
