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
    const status = searchParams.get('status') || 'all';
    const platform = searchParams.get('platform');
    const strategy = searchParams.get('strategy');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured',
      }, { status: 500 });
    }

    // Query simulated trades (these are the "positions")
    let query = supabase
      .from('polybot_simulated_trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by outcome status if specified
    if (status === 'open' || status === 'pending') {
      query = query.eq('outcome', 'pending');
    } else if (status === 'won') {
      query = query.eq('outcome', 'won');
    } else if (status === 'lost') {
      query = query.eq('outcome', 'lost');
    } else if (status === 'failed') {
      query = query.eq('outcome', 'failed_execution');
    }
    // 'all' returns everything
    
    if (strategy) {
      query = query.eq('arbitrage_type', strategy);
    }

    const { data: tradesData, error } = await query;

    if (error) {
      console.error('Error fetching positions:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Map simulated trades to positions format
    const positions = (tradesData || []).map((trade: any) => {
      // Determine platform from arbitrage_type or trade_type
      let tradePlatform = 'Kalshi';
      if (trade.arbitrage_type?.includes('poly')) {
        tradePlatform = 'Polymarket';
      } else if (trade.arbitrage_type?.includes('binance') || trade.trade_type?.includes('funding')) {
        tradePlatform = 'Binance';
      }
      
      // Filter by platform if specified
      if (platform && tradePlatform.toLowerCase() !== platform.toLowerCase()) {
        return null;
      }

      return {
        id: trade.id.toString(),
        position_id: trade.position_id,
        platform: tradePlatform,
        market: trade.polymarket_market_title || trade.kalshi_market_title || 'Unknown',
        market_id: trade.polymarket_token_id || trade.kalshi_ticker,
        side: trade.polymarket_yes_price > 0 ? 'yes' : 'no',
        size: parseFloat(trade.position_size_usd) || 0,
        entry_price: parseFloat(trade.polymarket_yes_price) || parseFloat(trade.kalshi_yes_price) || 0,
        current_price: parseFloat(trade.polymarket_yes_price) || 0,
        expected_profit_pct: parseFloat(trade.expected_profit_pct) || 0,
        actual_profit: parseFloat(trade.actual_profit_usd) || 0,
        strategy: trade.arbitrage_type || trade.trade_type || 'unknown',
        outcome: trade.outcome,
        opened_at: trade.created_at,
        resolved_at: trade.resolved_at,
        resolution_notes: trade.resolution_notes,
        status: trade.outcome === 'pending' ? 'open' : 'closed',
      };
    }).filter(Boolean);

    // Calculate stats from all trades
    const allTrades = tradesData || [];
    const wonTrades = allTrades.filter((t: any) => t.outcome === 'won');
    const lostTrades = allTrades.filter((t: any) => t.outcome === 'lost');
    const failedTrades = allTrades.filter((t: any) => t.outcome === 'failed_execution');
    const pendingTrades = allTrades.filter((t: any) => t.outcome === 'pending');
    
    const totalProfit = wonTrades.reduce((sum: number, t: any) => 
      sum + (parseFloat(t.actual_profit_usd) || 0), 0);
    const totalLoss = lostTrades.reduce((sum: number, t: any) => 
      sum + Math.abs(parseFloat(t.actual_profit_usd) || 0), 0);
    const totalValue = allTrades.reduce((sum: number, t: any) => 
      sum + (parseFloat(t.position_size_usd) || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        positions,
        stats: {
          total_positions: positions.length,
          total_value: totalValue,
          total_pnl: totalProfit - totalLoss,
          total_pnl_pct: totalValue > 0 ? ((totalProfit - totalLoss) / totalValue) * 100 : 0,
          winning_positions: wonTrades.length,
          losing_positions: lostTrades.length,
          failed_executions: failedTrades.length,
          pending_positions: pendingTrades.length,
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
