import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/audit';

// ============================================================================
// Trades API - Returns trade history for the authenticated user
// Multi-tenant: Filters by user_id to prevent data leakage
// ============================================================================

export const dynamic = 'force-dynamic';

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Verify authentication and get user_id
    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tradingMode = searchParams.get('trading_mode'); // 'paper' or 'live'
    const outcome = searchParams.get('outcome'); // 'won', 'lost', 'pending'
    const exchange = searchParams.get('exchange'); // Filter by platform
    const includeSimulation = searchParams.get('include_simulation') !== 'false'; // Default true

    // Build query with multi-tenant filtering
    // For simulation/paper trades: Show trades where user_id IS NULL (shared simulation)
    // For live trades: ONLY show trades belonging to the authenticated user
    let query = supabase
      .from('polybot_simulated_trades')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply trading mode filter with appropriate user filtering
    if (tradingMode === 'live') {
      // Live trades: STRICT user filtering - only show user's own trades
      query = query.eq('user_id', authResult.user_id).eq('trading_mode', 'live');
    } else if (tradingMode === 'paper') {
      // Paper/simulation trades: Show shared simulation trades (user_id IS NULL) OR user's own paper trades
      query = query.eq('trading_mode', 'paper').or(`user_id.is.null,user_id.eq.${authResult.user_id}`);
    } else {
      // All trades: Show simulation trades (user_id IS NULL) OR user's own trades
      if (includeSimulation) {
        query = query.or(`user_id.is.null,user_id.eq.${authResult.user_id}`);
      } else {
        query = query.eq('user_id', authResult.user_id);
      }
    }
    if (outcome) {
      query = query.eq('outcome', outcome);
    }
    if (exchange) {
      // Filter by buy or sell platform
      query = query.or(`buy_platform.eq.${exchange},sell_platform.eq.${exchange}`);
    }

    const { data: trades, count, error } = await query;

    if (error) {
      console.error('Error fetching trades:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary stats from returned trades
    const validTrades = trades?.filter(t => t.outcome !== 'failed_execution') || [];
    const totalPnL = validTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
    const winningTrades = validTrades.filter(t => t.outcome === 'won').length;
    const losingTrades = validTrades.filter(t => t.outcome === 'lost').length;
    const winRate = (winningTrades + losingTrades) > 0 
      ? (winningTrades / (winningTrades + losingTrades)) * 100 
      : 0;

    return NextResponse.json({
      trades: trades || [],
      total_count: count || 0,
      summary: {
        total_pnl: totalPnL,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        win_rate: winRate,
        total_in_response: trades?.length || 0,
      },
      pagination: {
        limit,
        offset,
        has_more: count ? offset + limit < count : false,
      }
    });
  } catch (error) {
    console.error('Trades API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
