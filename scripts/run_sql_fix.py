#!/usr/bin/env python3
"""
Run raw SQL against Supabase using the Management API.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Get project ref from URL
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0]  # ytaltvltxkkfczlvjgad
MANAGEMENT_TOKEN = os.getenv('SUPABASE_MANAGEMENT_TOKEN')

print(f"Project ref: {PROJECT_REF}")
print(f"Management token: {MANAGEMENT_TOKEN[:20]}..." if MANAGEMENT_TOKEN else "No token")

def run_sql(sql: str):
    """Run SQL via Supabase Management API"""
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    
    headers = {
        'Authorization': f'Bearer {MANAGEMENT_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, headers=headers, json={'query': sql})
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error {response.status_code}: {response.text}")
        return None

# SQL to fix the issues
fix_sql = """
-- Fix polybot_config sequence
SELECT setval(
    pg_get_serial_sequence('polybot_config', 'id'), 
    COALESCE((SELECT MAX(id) FROM polybot_config), 0) + 1,
    false
);

-- Add user_id to polybot_trades if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_trades' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_trades 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_id to polybot_trades';
    END IF;
END $$;

-- Add user_id to polybot_bot_logs if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polybot_bot_logs' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE polybot_bot_logs 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_id to polybot_bot_logs';
    END IF;
END $$;

-- Assign orphan trades to rutrohd
UPDATE polybot_trades 
SET user_id = 'b2629537-3a31-4fa1-b05a-a9d523a008aa'
WHERE user_id IS NULL;

-- Assign orphan bot logs to rutrohd
UPDATE polybot_bot_logs 
SET user_id = 'b2629537-3a31-4fa1-b05a-a9d523a008aa'
WHERE user_id IS NULL;

-- Insert missing configs
INSERT INTO polybot_config (user_id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM polybot_config c WHERE c.user_id = u.id
);

-- Verification
SELECT 'polybot_config' as table_name, COUNT(*) as count FROM polybot_config
UNION ALL
SELECT 'polybot_trades', COUNT(*) FROM polybot_trades
UNION ALL
SELECT 'polybot_bot_logs', COUNT(*) FROM polybot_bot_logs;
"""

print("\nRunning SQL fixes...")
result = run_sql(fix_sql)
if result:
    print("✅ SQL executed successfully")
    print(result)
else:
    print("❌ SQL execution failed")
