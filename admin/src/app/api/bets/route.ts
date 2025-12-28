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

// GET - Get user's bets
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

    // Check if polybot_bets table exists by trying to query it
    const { data: bets, error } = await supabase
      .from('polybot_bets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      // Table might not exist, return empty array
      if (error.code === '42P01' || error.message.includes('does not exist') || error.code === 'PGRST205') {
        return NextResponse.json({
          bets: [],
          message: 'Bets table not configured yet'
        });
      }
      console.error('Bets fetch error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bets: bets || [],
      count: bets?.length || 0
    });
  } catch (error) {
    console.error('Error in bets API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new bet
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
    
    // Validate required fields
    if (!body.market_id || !body.amount || !body.outcome) {
      return NextResponse.json(
        { error: 'market_id, amount, and outcome are required' },
        { status: 400 }
      );
    }

    // Insert bet
    const { data: bet, error } = await supabase
      .from('polybot_bets')
      .insert([{
        user_id: userId,
        market_id: body.market_id,
        amount: body.amount,
        outcome: body.outcome,
        odds: body.odds || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Bet create error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bet,
      message: 'Bet created successfully'
    });
  } catch (error) {
    console.error('Error in bets POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
