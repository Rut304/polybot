import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ============================================================================
// Trades API - Returns trade history for the authenticated user
// Used by E2E tests for data verification and accuracy validation
// ============================================================================

export const dynamic = 'force-dynamic';

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tradingMode = searchParams.get('trading_mode'); // 'paper' or 'live'
    const outcome = searchParams.get('outcome'); // 'won', 'lost', 'pending'

    // Build query
    let query = supabase
      .from('polybot_simulated_trades')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (tradingMode) {
      query = query.eq('trading_mode', tradingMode);
    }
    if (outcome) {
      query = query.eq('outcome', outcome);
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
