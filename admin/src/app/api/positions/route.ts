import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const platform = searchParams.get('platform');
    const strategy = searchParams.get('strategy');
    
    if (!supabase) {
      // Return mock data for development
      return NextResponse.json({
        success: true,
        data: {
          positions: [
            {
              id: '1',
              platform: 'Polymarket',
              market: 'Will Bitcoin reach $100k in 2024?',
              market_slug: 'btc-100k-2024',
              side: 'yes',
              size: 100,
              entry_price: 0.65,
              current_price: 0.72,
              unrealized_pnl: 10.77,
              unrealized_pnl_pct: 10.77,
              strategy: 'single_platform_arb',
              opened_at: new Date(Date.now() - 3600000).toISOString(),
              status: 'open',
            },
            {
              id: '2',
              platform: 'Binance',
              market: 'BTC/USDT',
              side: 'long',
              size: 500,
              entry_price: 42150,
              current_price: 43200,
              unrealized_pnl: 12.47,
              unrealized_pnl_pct: 2.49,
              strategy: 'funding_rate_arb',
              opened_at: new Date(Date.now() - 86400000).toISOString(),
              status: 'open',
            },
            {
              id: '3',
              platform: 'Binance',
              market: 'BTC/USDT-PERP',
              side: 'short',
              size: 500,
              entry_price: 42180,
              current_price: 43200,
              unrealized_pnl: -12.10,
              unrealized_pnl_pct: -2.42,
              strategy: 'funding_rate_arb',
              opened_at: new Date(Date.now() - 86400000).toISOString(),
              status: 'open',
            },
          ],
          stats: {
            total_positions: 3,
            total_value: 1100,
            total_pnl: 11.14,
            total_pnl_pct: 1.01,
            winning_positions: 2,
            losing_positions: 1,
          },
        },
        mock: true,
      });
    }

    // Build query
    let query = supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (platform) {
      query = query.eq('platform', platform);
    }
    
    if (strategy) {
      query = query.eq('strategy', strategy);
    }

    const { data: tradesData, error } = await query;

    if (error) {
      console.error('Error fetching positions:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Map trades to positions format
    const positions = (tradesData || []).map((trade: any) => ({
      id: trade.id,
      platform: trade.platform || 'Unknown',
      market: trade.market_question || trade.market || 'Unknown',
      market_slug: trade.market_slug,
      side: trade.side || 'buy',
      size: parseFloat(trade.size_usd) || 0,
      entry_price: parseFloat(trade.price) || 0,
      current_price: parseFloat(trade.current_price) || parseFloat(trade.price) || 0,
      unrealized_pnl: parseFloat(trade.unrealized_pnl) || 0,
      unrealized_pnl_pct: parseFloat(trade.unrealized_pnl_pct) || 0,
      strategy: trade.strategy || 'manual',
      opened_at: trade.created_at,
      status: trade.status || 'open',
    }));

    // Calculate stats
    const openPositions = positions.filter((p: any) => p.status === 'open');
    const totalValue = openPositions.reduce((sum: number, p: any) => sum + p.size, 0);
    const totalPnl = openPositions.reduce((sum: number, p: any) => sum + (p.unrealized_pnl || 0), 0);
    const winning = openPositions.filter((p: any) => (p.unrealized_pnl || 0) > 0).length;
    const losing = openPositions.filter((p: any) => (p.unrealized_pnl || 0) < 0).length;

    return NextResponse.json({
      success: true,
      data: {
        positions,
        stats: {
          total_positions: openPositions.length,
          total_value: totalValue,
          total_pnl: totalPnl,
          total_pnl_pct: totalValue > 0 ? (totalPnl / totalValue) * 100 : 0,
          winning_positions: winning,
          losing_positions: losing,
        },
      },
    });
  } catch (error) {
    console.error('Error in positions API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
