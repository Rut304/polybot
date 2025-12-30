import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Stats API - Returns aggregate trading statistics
// Used by E2E tests for data verification and accuracy validation
// 
// CRITICAL: These calculations must be 100% accurate for production trust
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
    const tradingMode = searchParams.get('trading_mode'); // 'paper' or 'live'
    const hours = searchParams.get('hours'); // time filter in hours

    // Get aggregated stats from the strategy performance view (most accurate)
    let strategyQuery = supabase
      .from('polybot_strategy_performance')
      .select('*');
    
    if (tradingMode) {
      strategyQuery = strategyQuery.eq('trading_mode', tradingMode);
    }

    const { data: strategyPerf, error: strategyError } = await strategyQuery;

    if (strategyError) {
      console.error('Error fetching strategy performance:', strategyError);
    }

    // Aggregate from strategy performance view
    const totalPnl = strategyPerf?.reduce((sum, s) => sum + (s.total_pnl || 0), 0) || 0;
    const totalTrades = strategyPerf?.reduce((sum, s) => sum + (s.total_trades || 0), 0) || 0;
    const winningTrades = strategyPerf?.reduce((sum, s) => sum + (s.winning_trades || 0), 0) || 0;
    const losingTrades = strategyPerf?.reduce((sum, s) => sum + (s.losing_trades || 0), 0) || 0;
    const bestTrade = strategyPerf?.reduce((best, s) => Math.max(best, s.best_trade || 0), 0) || 0;
    const worstTrade = strategyPerf?.reduce((worst, s) => Math.min(worst, s.worst_trade || 0), 0) || 0;

    // Calculate derived metrics
    const resolvedTrades = winningTrades + losingTrades;
    const winRate = resolvedTrades > 0 ? (winningTrades / resolvedTrades) * 100 : 0;
    
    // Starting balance (configurable, default $10,000)
    const startingBalance = 10000;
    const currentBalance = startingBalance + totalPnl;
    const roiPct = (totalPnl / startingBalance) * 100;

    // If time filter requested, also get filtered stats from raw trades
    let filteredStats = null;
    if (hours) {
      const hoursNum = parseInt(hours);
      const since = new Date();
      since.setHours(since.getHours() - hoursNum);

      let tradesQuery = supabase
        .from('polybot_simulated_trades')
        .select('actual_profit_usd, outcome, trading_mode')
        .gte('created_at', since.toISOString());

      if (tradingMode) {
        tradesQuery = tradesQuery.eq('trading_mode', tradingMode);
      }

      const { data: recentTrades } = await tradesQuery;

      if (recentTrades) {
        const validTrades = recentTrades.filter(t => t.outcome !== 'failed_execution');
        const filteredPnl = validTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
        const filteredWins = validTrades.filter(t => t.outcome === 'won').length;
        const filteredLosses = validTrades.filter(t => t.outcome === 'lost').length;
        const filteredResolved = filteredWins + filteredLosses;

        filteredStats = {
          hours: hoursNum,
          total_pnl: filteredPnl,
          total_trades: validTrades.length,
          winning_trades: filteredWins,
          losing_trades: filteredLosses,
          win_rate: filteredResolved > 0 ? (filteredWins / filteredResolved) * 100 : 0,
        };
      }
    }

    // Get count of failed executions separately
    const { count: failedCount } = await supabase
      .from('polybot_simulated_trades')
      .select('id', { count: 'exact', head: true })
      .eq('outcome', 'failed_execution');

    // Get pending trades count
    const { count: pendingCount } = await supabase
      .from('polybot_simulated_trades')
      .select('id', { count: 'exact', head: true })
      .eq('outcome', 'pending');

    return NextResponse.json({
      // Core metrics (from database aggregates - 100% accurate)
      total_pnl: totalPnl,
      total_trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      win_rate: winRate,
      
      // Balance metrics
      starting_balance: startingBalance,
      current_balance: currentBalance,
      roi_pct: roiPct,
      
      // Trade details
      best_trade: bestTrade,
      worst_trade: worstTrade,
      pending_trades: pendingCount || 0,
      failed_executions: failedCount || 0,
      
      // Strategy breakdown
      strategies: strategyPerf?.map(s => ({
        strategy: s.strategy,
        trading_mode: s.trading_mode,
        total_pnl: s.total_pnl,
        total_trades: s.total_trades,
        win_rate: s.win_rate_pct,
      })) || [],
      
      // Time-filtered stats (if requested)
      filtered: filteredStats,
      
      // Metadata
      timestamp: new Date().toISOString(),
      source: 'polybot_strategy_performance',
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
