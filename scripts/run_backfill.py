#!/usr/bin/env python3
"""
Run SQL migrations directly against Supabase using the service role key.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# Create admin client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def run_sql(sql: str, description: str = ""):
    """Execute SQL via Supabase RPC"""
    print(f"\n{'='*60}")
    print(f"📝 {description or 'Running SQL'}")
    print(f"{'='*60}")
    
    try:
        # Use the rpc function to run raw SQL
        result = supabase.rpc('exec_sql', {'query': sql}).execute()
        print(f"✅ Success")
        if result.data:
            print(f"   Result: {result.data}")
        return True
    except Exception as e:
        # Try direct postgrest if rpc fails
        print(f"⚠️ RPC failed, trying direct query...")
        try:
            # For select queries, we can use from_
            if sql.strip().upper().startswith('SELECT'):
                # Can't run arbitrary SELECT via postgrest
                pass
        except:
            pass
        print(f"❌ Error: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("🚀 POLYBOT MULTI-TENANCY BACKFILL")
    print("="*60)
    
    # Check current state first
    print("\n📊 Checking current database state...")
    
    # Get auth users
    try:
        users_result = supabase.auth.admin.list_users()
        users = users_result if isinstance(users_result, list) else (users_result.users if hasattr(users_result, 'users') else [])
        print(f"\n✅ Found {len(users)} auth users:")
        for u in users:
            print(f"   - {u.email} (id: {u.id[:8]}...)")
    except Exception as e:
        print(f"❌ Failed to list users: {e}")
        return
    
    # Check existing tables
    print("\n📊 Checking existing data...")
    
    # Teams
    try:
        teams = supabase.table('polybot_teams').select('*').execute()
        print(f"   polybot_teams: {len(teams.data)} rows")
    except Exception as e:
        print(f"   polybot_teams: ❌ {e}")
    
    # Team members
    try:
        members = supabase.table('polybot_team_members').select('*').execute()
        print(f"   polybot_team_members: {len(members.data)} rows")
    except Exception as e:
        print(f"   polybot_team_members: ❌ {e}")
    
    # Profiles
    try:
        profiles = supabase.table('polybot_profiles').select('*').execute()
        print(f"   polybot_profiles: {len(profiles.data)} rows")
    except Exception as e:
        print(f"   polybot_profiles: ❌ {e}")
    
    # User profiles
    try:
        user_profiles = supabase.table('polybot_user_profiles').select('*').execute()
        print(f"   polybot_user_profiles: {len(user_profiles.data)} rows")
    except Exception as e:
        print(f"   polybot_user_profiles: ❌ {e}")
    
    # Config
    try:
        configs = supabase.table('polybot_config').select('id, user_id').execute()
        print(f"   polybot_config: {len(configs.data)} rows")
        for c in configs.data:
            print(f"      - id={c['id']}, user_id={c.get('user_id', 'NULL')[:8] if c.get('user_id') else 'NULL'}...")
    except Exception as e:
        print(f"   polybot_config: ❌ {e}")
    
    # Status
    try:
        status = supabase.table('polybot_status').select('id, user_id').execute()
        print(f"   polybot_status: {len(status.data)} rows")
    except Exception as e:
        print(f"   polybot_status: ❌ {e}")
    
    # Now do the backfill
    print("\n" + "="*60)
    print("🔧 STARTING BACKFILL")
    print("="*60)
    
    rutrohd_id = 'b2629537-3a31-4fa1-b05a-a9d523a008aa'
    muschnick_id = '4b66f317-9446-429f-b5f9-d03448c6a7ce'
    readonly_id = 'c763eb3f-f75e-42f3-a04c-e1e7eba71fbb'
    
    # STEP 1: Create teams for each user
    print("\n📌 Step 1: Creating personal teams...")
    
    for user_id, name in [(rutrohd_id, "Rut (Admin)'s Team"), (muschnick_id, "muschnick's Team"), (readonly_id, "Readonly's Team")]:
        try:
            # Check if team exists
            existing = supabase.table('polybot_teams').select('id').eq('owner_id', user_id).execute()
            if existing.data:
                print(f"   ✓ Team already exists for {name[:20]}...")
                continue
            
            # Create team
            result = supabase.table('polybot_teams').insert({
                'name': name,
                'owner_id': user_id,
                'max_members': 5
            }).execute()
            print(f"   ✅ Created team: {name}")
        except Exception as e:
            print(f"   ❌ Failed to create team for {user_id[:8]}: {e}")
    
    # STEP 2: Add team memberships
    print("\n📌 Step 2: Adding team memberships...")
    
    try:
        teams = supabase.table('polybot_teams').select('id, owner_id').execute()
        for team in teams.data:
            # Check if membership exists
            existing = supabase.table('polybot_team_members').select('id').eq('team_id', team['id']).eq('user_id', team['owner_id']).execute()
            if existing.data:
                print(f"   ✓ Membership already exists for team {team['id'][:8]}...")
                continue
            
            # Create membership
            result = supabase.table('polybot_team_members').insert({
                'team_id': team['id'],
                'user_id': team['owner_id'],
                'role': 'owner'
            }).execute()
            print(f"   ✅ Added owner membership for team {team['id'][:8]}...")
    except Exception as e:
        print(f"   ❌ Failed to add memberships: {e}")
    
    # STEP 3: Create missing polybot_profiles
    print("\n📌 Step 3: Creating missing polybot_profiles...")
    
    for user_id, email, tier in [
        (rutrohd_id, 'rutrohd@gmail.com', 'elite'),
        (muschnick_id, 'muschnick@gmail.com', 'free'),
        (readonly_id, 'readonly@polybot.local', 'free')
    ]:
        try:
            existing = supabase.table('polybot_profiles').select('id').eq('id', user_id).execute()
            if existing.data:
                print(f"   ✓ Profile already exists for {email}")
                continue
            
            result = supabase.table('polybot_profiles').insert({
                'id': user_id,
                'email': email,
                'subscription_tier': tier,
                'subscription_status': 'active'
            }).execute()
            print(f"   ✅ Created profile for {email}")
        except Exception as e:
            print(f"   ❌ Failed to create profile for {email}: {e}")
    
    # STEP 4: Create missing configs (using user_id as foreign key, not id)
    print("\n📌 Step 4: Creating missing polybot_config entries...")
    
    for user_id, email in [
        (muschnick_id, 'muschnick@gmail.com'),
        (readonly_id, 'readonly@polybot.local')
    ]:
        try:
            existing = supabase.table('polybot_config').select('id').eq('user_id', user_id).execute()
            if existing.data:
                print(f"   ✓ Config already exists for {email}")
                continue
            
            # Insert without specifying id (let it auto-generate)
            result = supabase.table('polybot_config').insert({
                'user_id': user_id
            }).execute()
            print(f"   ✅ Created config for {email}")
        except Exception as e:
            print(f"   ❌ Failed to create config for {email}: {e}")
    
    # STEP 5: Create missing status entries
    print("\n📌 Step 5: Creating missing polybot_status entries...")
    
    for user_id, email in [
        (muschnick_id, 'muschnick@gmail.com'),
        (readonly_id, 'readonly@polybot.local')
    ]:
        try:
            existing = supabase.table('polybot_status').select('id').eq('user_id', user_id).execute()
            if existing.data:
                print(f"   ✓ Status already exists for {email}")
                continue
            
            result = supabase.table('polybot_status').insert({
                'user_id': user_id,
                'is_running': False
            }).execute()
            print(f"   ✅ Created status for {email}")
        except Exception as e:
            print(f"   ❌ Failed to create status for {email}: {e}")
    
    # STEP 6: Assign orphan data to rutrohd
    print("\n📌 Step 6: Assigning orphan data to rutrohd@gmail.com...")
    
    # Trades
    try:
        trades = supabase.table('polybot_trades').select('id').is_('user_id', 'null').execute()
        if trades.data:
            for trade in trades.data:
                supabase.table('polybot_trades').update({'user_id': rutrohd_id}).eq('id', trade['id']).execute()
            print(f"   ✅ Assigned {len(trades.data)} orphan trades to rutrohd")
        else:
            print(f"   ✓ No orphan trades found")
    except Exception as e:
        print(f"   ⚠️ Trades check: {e}")
    
    # Opportunities
    try:
        opps = supabase.table('polybot_opportunities').select('id').is_('user_id', 'null').execute()
        if opps.data:
            for opp in opps.data:
                supabase.table('polybot_opportunities').update({'user_id': rutrohd_id}).eq('id', opp['id']).execute()
            print(f"   ✅ Assigned {len(opps.data)} orphan opportunities to rutrohd")
        else:
            print(f"   ✓ No orphan opportunities found")
    except Exception as e:
        print(f"   ⚠️ Opportunities check: {e}")
    
    # Bot logs
    try:
        logs = supabase.table('polybot_bot_logs').select('id').is_('user_id', 'null').execute()
        if logs.data:
            for log in logs.data:
                supabase.table('polybot_bot_logs').update({'user_id': rutrohd_id}).eq('id', log['id']).execute()
            print(f"   ✅ Assigned {len(logs.data)} orphan bot logs to rutrohd")
        else:
            print(f"   ✓ No orphan bot logs found")
    except Exception as e:
        print(f"   ⚠️ Bot logs check: {e}")
    
    # Final verification
    print("\n" + "="*60)
    print("📊 FINAL VERIFICATION")
    print("="*60)
    
    try:
        teams = supabase.table('polybot_teams').select('*').execute()
        print(f"\n✅ Teams: {len(teams.data)}")
        for t in teams.data:
            print(f"   - {t['name']} (owner: {t['owner_id'][:8]}...)")
    except Exception as e:
        print(f"❌ Teams: {e}")
    
    try:
        members = supabase.table('polybot_team_members').select('*, polybot_teams(name)').execute()
        print(f"\n✅ Team Members: {len(members.data)}")
    except Exception as e:
        print(f"❌ Team Members: {e}")
    
    try:
        profiles = supabase.table('polybot_profiles').select('id, email, subscription_tier').execute()
        print(f"\n✅ Profiles: {len(profiles.data)}")
        for p in profiles.data:
            print(f"   - {p.get('email', 'no-email')} ({p['subscription_tier']})")
    except Exception as e:
        print(f"❌ Profiles: {e}")
    
    try:
        configs = supabase.table('polybot_config').select('id, user_id').execute()
        print(f"\n✅ Configs: {len(configs.data)}")
    except Exception as e:
        print(f"❌ Configs: {e}")
    
    print("\n" + "="*60)
    print("✅ BACKFILL COMPLETE!")
    print("="*60 + "\n")

if __name__ == '__main__':
    main()
