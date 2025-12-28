import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create fresh admin client each request
function getSupabaseAdmin(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url || !serviceKey) return null;
  
  // Simple initialization - SDK handles auth headers properly
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured - missing SUPABASE_SERVICE_KEY' }, { status: 500 });
    }

    // Check various tables
    const results: Record<string, any> = {};

    // 1. Check auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    results.auth_users = {
      count: authUsers?.users?.length || 0,
      users: (authUsers?.users || []).map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at
      })),
      error: authError?.message
    };

    // 2. Check polybot_profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('polybot_profiles')
      .select('*');
    results.polybot_profiles = {
      count: profiles?.length || 0,
      data: profiles,
      error: profilesError?.message
    };

    // 3. Check polybot_user_profiles
    const { data: userProfiles, error: userProfilesError } = await supabase
      .from('polybot_user_profiles')
      .select('*');
    results.polybot_user_profiles = {
      count: userProfiles?.length || 0,
      data: userProfiles,
      error: userProfilesError?.message
    };

    // 4. Check polybot_teams (if exists)
    const { data: teams, error: teamsError } = await supabase
      .from('polybot_teams')
      .select('*')
      .limit(100);
    results.polybot_teams = {
      count: teams?.length || 0,
      data: teams,
      error: teamsError?.message
    };

    // 5. Check polybot_team_members (if exists)
    const { data: teamMembers, error: membersError } = await supabase
      .from('polybot_team_members')
      .select('*')
      .limit(100);
    results.polybot_team_members = {
      count: teamMembers?.length || 0,
      data: teamMembers,
      error: membersError?.message
    };

    // 6. Check polybot_config
    const { data: configs, error: configsError } = await supabase
      .from('polybot_config')
      .select('id, user_id, updated_at');
    results.polybot_config = {
      count: configs?.length || 0,
      data: configs?.map(c => ({ id: c.id, user_id: c.user_id })),
      error: configsError?.message
    };

    // 7. Check polybot_key_vault
    const { data: keys, error: keysError } = await supabase
      .from('polybot_key_vault')
      .select('id, user_id, key_name');
    results.polybot_key_vault = {
      count: keys?.length || 0,
      data: keys?.map(k => ({ user_id: k.user_id, key_name: k.key_name })),
      error: keysError?.message
    };

    // 8. Check polybot_trades
    const { data: trades, error: tradesError } = await supabase
      .from('polybot_trades')
      .select('id, user_id')
      .limit(10);
    results.polybot_trades = {
      sample_count: trades?.length || 0,
      unique_users: [...new Set(trades?.map(t => t.user_id) || [])].length,
      error: tradesError?.message
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    }, { status: 200 });

  } catch (error: any) {
    console.error('DB Check error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
