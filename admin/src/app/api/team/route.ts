import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

// GET - Get user's team info
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      );
    }

    // Get user from auth token
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (user && !authError) {
        userId = user.id;
      }
    }
    
    // Also support query param for backwards compatibility
    if (!userId) {
      userId = request.nextUrl.searchParams.get('userId');
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Valid auth token or userId required' },
        { status: 400 }
      );
    }

    // Get user's team memberships
    const { data: memberships, error: memberError } = await supabase
      .from('polybot_team_members')
      .select('team_id, role')
      .eq('user_id', userId)
      .limit(100);

    if (memberError) {
      console.error('Team member fetch error:', memberError);
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({
        teams: [],
        message: 'User is not a member of any team'
      });
    }

    // Get team details
    const teamIds = memberships.map(m => m.team_id);
    const { data: teams, error: teamsError } = await supabase
      .from('polybot_teams')
      .select('id, name, owner_id, created_at')
      .in('id', teamIds)
      .limit(100);

    if (teamsError) {
      console.error('Teams fetch error:', teamsError);
      return NextResponse.json(
        { error: teamsError.message },
        { status: 500 }
      );
    }

    // Combine membership and team data
    const teamsWithRole = teams?.map(team => {
      const membership = memberships.find(m => m.team_id === team.id);
      return {
        ...team,
        user_role: membership?.role || 'viewer',
      };
    }) || [];

    return NextResponse.json({
      teams: teamsWithRole,
      count: teamsWithRole.length
    });
  } catch (error) {
    console.error('Error in team API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new team
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      );
    }

    // Get user from auth token
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (user && !authError) {
        userId = user.id;
      }
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Valid auth token required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('polybot_teams')
      .insert([{
        name,
        owner_id: userId,
        subscription_tier: 'free',
        max_members: 5,
      }])
      .select()
      .single();

    if (teamError) {
      console.error('Team create error:', teamError);
      return NextResponse.json(
        { error: teamError.message },
        { status: 500 }
      );
    }

    // Add creator as owner
    const { error: memberError } = await supabase
      .from('polybot_team_members')
      .insert([{
        team_id: team.id,
        user_id: userId,
        role: 'owner',
      }]);

    if (memberError) {
      console.error('Team member add error:', memberError);
      // Clean up team if member add fails
      await supabase.from('polybot_teams').delete().eq('id', team.id);
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      team,
      message: 'Team created successfully'
    });
  } catch (error) {
    console.error('Error in team POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
