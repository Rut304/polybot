#!/usr/bin/env python3
"""Reset simulation data to start fresh."""
from supabase import create_client

url = 'https://ytaltvltxkkfczlvjgad.supabase.co'
key = (
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YWx0dmx0eGtrZmN6bHZqZ2FkIiwi'
    'cm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ0NTA4OCwiZXhwIjoyMDgw'
    'MDIxMDg4fQ.eWq6y3iT6DvX9JRzgNxX4N8O7YFZY_9ncRL2gmwefbw'
)
supabase = create_client(url, key)

# Get sample trade to see columns
result = supabase.table('polybot_trades').select('*').limit(1).execute()
if result.data:
    print('Trade columns:', list(result.data[0].keys()))

# Count all trades
count_result = supabase.table('polybot_trades').select(
    'id', count='exact'
).execute()
print(f'Total trades: {count_result.count}')

# Delete all trades (paper trading mode)
if count_result.count and count_result.count > 0:
    delete_result = supabase.table('polybot_trades').delete().neq(
        'id', -1
    ).execute()
    print(f'Deleted {len(delete_result.data)} trades')

# Reset config - only update fields that exist
supabase.table('polybot_config').update({
    'total_opportunities_found': 0
}).eq('id', 1).execute()
print('Reset simulation config')
