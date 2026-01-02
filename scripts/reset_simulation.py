#!/usr/bin/env python3
"""Reset simulation data to start fresh."""
import os
from supabase import create_client

# Load from environment
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

url = os.environ.get('SUPABASE_URL', 'https://ytaltvltxkkfczlvjgad.supabase.co')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not key:
    print("Error: SUPABASE_SERVICE_ROLE_KEY not set")
    exit(1)

supabase = create_client(url, key)

print("Resetting simulation data...")

# 1. Delete all trades
count_result = supabase.table('polybot_trades').select(
    'id', count='exact'
).execute()
print(f'Trades found: {count_result.count}')

if count_result.count and count_result.count > 0:
    delete_result = supabase.table('polybot_trades').delete().neq(
        'id', -1
    ).execute()
    print(f'  Deleted {len(delete_result.data)} trades')

# 2. Delete simulation stats history
stats_result = supabase.table('polybot_simulation_stats').select(
    'id', count='exact'
).execute()
print(f'Simulation stats found: {stats_result.count}')

if stats_result.count and stats_result.count > 0:
    supabase.table('polybot_simulation_stats').delete().neq(
        'id', -1
    ).execute()
    print('  Deleted simulation stats')

# 3. Delete simulated trades
sim_trades = supabase.table('polybot_simulated_trades').select(
    'id', count='exact'
).execute()
print(f'Simulated trades found: {sim_trades.count}')

if sim_trades.count and sim_trades.count > 0:
    supabase.table('polybot_simulated_trades').delete().neq(
        'id', -1
    ).execute()
    print('  Deleted simulated trades')

# 4. Delete balance history
balance_hist = supabase.table('polybot_balance_history').select(
    'id', count='exact'
).execute()
print(f'Balance history found: {balance_hist.count}')

if balance_hist.count and balance_hist.count > 0:
    supabase.table('polybot_balance_history').delete().neq(
        'id', -1
    ).execute()
    print('  Deleted balance history')

print("\n✅ Simulation reset complete!")
