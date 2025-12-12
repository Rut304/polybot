import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, logAuditEvent, checkRateLimit, getRequestMetadata, rateLimitResponse, unauthorizedResponse } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get total starting balance from config
async function getTotalStartingBalance(): Promise<number> {
  const { data: config } = await supabaseAdmin
    .from('polybot_config')
    .select('polymarket_starting_balance, kalshi_starting_balance, binance_starting_balance, coinbase_starting_balance, alpaca_starting_balance')
    .eq('id', 1)
    .single();
  
  if (!config) return 100000; // Default: 5 platforms x $20,000
  
  return (
    (config.polymarket_starting_balance || 20000) +
    (config.kalshi_starting_balance || 20000) +
    (config.binance_starting_balance || 20000) +
    (config.coinbase_starting_balance || 20000) +
    (config.alpaca_starting_balance || 20000)
  );
}

// Archive the current simulation session before reset
async function archiveCurrentSession(): Promise<{ sessionId: string | null; tradesArchived: number }> {
  try {
    // Get current simulation stats
    const { data: currentStats } = await supabaseAdmin
      .from('polybot_simulation_stats')
      .select('*')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    // Get trade counts
    const { count: tradesCount } = await supabaseAdmin
      .from('polybot_simulated_trades')
      .select('*', { count: 'exact', head: true });

    // Don't archive if no trades exist
    if (!tradesCount || tradesCount === 0) {
      return { sessionId: null, tradesArchived: 0 };
    }

    const endingBalance = currentStats?.simulated_balance || 
      parseFloat(currentStats?.stats_json?.simulated_current_balance || '100000');
    const totalPnl = currentStats?.total_pnl || 
      parseFloat(currentStats?.stats_json?.total_pnl || '0');

    // Try to use the database function first
    const { data: archiveResult, error: archiveError } = await supabaseAdmin
      .rpc('archive_simulation_session', {
        p_ending_balance: endingBalance,
        p_total_pnl: totalPnl,
        p_notes: `Session archived on reset at ${new Date().toISOString()}`
      });

    if (!archiveError && archiveResult) {
      return { sessionId: archiveResult, tradesArchived: tradesCount };
    }

    // Fallback: Manual archive if function doesn't exist
    console.log('Fallback: Using manual archive method');
    
    // Create session record manually
    const sessionId = crypto.randomUUID();
    
    // Get trade stats
    const { data: trades } = await supabaseAdmin
      .from('polybot_simulated_trades')
      .select('*');

    const winningTrades = trades?.filter(t => t.outcome === 'won').length || 0;
    const losingTrades = trades?.filter(t => t.outcome === 'lost').length || 0;
    const failedTrades = trades?.filter(t => t.outcome === 'failed_execution').length || 0;
    const totalTrades = trades?.length || 0;
    const winRate = (winningTrades + losingTrades) > 0 
      ? (winningTrades / (winningTrades + losingTrades)) * 100 
      : 0;

    // Get starting balance from first stat record or config
    const { data: firstStat } = await supabaseAdmin
      .from('polybot_simulation_stats')
      .select('simulated_balance, stats_json')
      .order('snapshot_at', { ascending: true })
      .limit(1)
      .single();
    
    const startingBalance = firstStat?.simulated_balance || 
      parseFloat(firstStat?.stats_json?.simulated_starting_balance || '100000');

    // Insert session
    const { error: sessionError } = await supabaseAdmin
      .from('polybot_simulation_sessions')
      .insert({
        session_id: sessionId,
        started_at: trades?.[0]?.created_at || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        status: 'completed',
        starting_balance: startingBalance,
        ending_balance: endingBalance,
        total_pnl: totalPnl,
        roi_pct: startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0,
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        failed_trades: failedTrades,
        win_rate: winRate,
        notes: `Session archived on reset at ${new Date().toISOString()}`,
        config_snapshot: currentStats?.stats_json || {},
      });

    if (sessionError) {
      console.error('Failed to create session record:', sessionError);
      return { sessionId: null, tradesArchived: 0 };
    }

    // Copy trades to session_trades
    if (trades && trades.length > 0) {
      const sessionTrades = trades.map(trade => ({
        session_id: sessionId,
        original_trade_id: trade.id,
        position_id: trade.position_id,
        created_at: trade.created_at,
        platform: trade.arbitrage_type?.includes('kalshi') ? 'Kalshi' : 
                  trade.arbitrage_type?.includes('poly') ? 'Polymarket' : 'Unknown',
        market_id: trade.polymarket_token_id || trade.kalshi_ticker,
        market_title: trade.polymarket_market_title || trade.kalshi_market_title,
        trade_type: trade.trade_type,
        arbitrage_type: trade.arbitrage_type,
        side: trade.polymarket_yes_price > 0 ? 'yes' : 'no',
        position_size_usd: trade.position_size_usd,
        yes_price: trade.polymarket_yes_price,
        no_price: trade.polymarket_no_price,
        expected_profit_pct: trade.expected_profit_pct,
        expected_profit_usd: trade.expected_profit_usd,
        actual_profit_usd: trade.actual_profit_usd,
        outcome: trade.outcome,
        resolution_notes: trade.resolution_notes,
        resolved_at: trade.resolved_at,
        raw_data: trade,
      }));

      const { error: tradesError } = await supabaseAdmin
        .from('polybot_session_trades')
        .insert(sessionTrades);

      if (tradesError) {
        console.error('Failed to archive trades:', tradesError);
      }
    }

    return { sessionId, tradesArchived: tradesCount };
  } catch (error) {
    console.error('Error archiving session:', error);
    return { sessionId: null, tradesArchived: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const metadata = await getRequestMetadata(request);
    const rateLimitResult = await checkRateLimit(metadata.ip_address, 'simulation.reset', 10, 60);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult.resetAt);
    }

    // Auth verification
    const authResult = await verifyAuth(request);
    if (!authResult) {
      await logAuditEvent({
        action: 'simulation.reset',
        resource_type: 'simulation',
        resource_id: 'all',
        details: { error: 'Unauthorized reset attempt' },
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        severity: 'warning',
      });
      return unauthorizedResponse();
    }

    // ARCHIVE SESSION FIRST - before deleting any data
    const archiveResult = await archiveCurrentSession();
    console.log('Archive result:', archiveResult);

    // Track what we're deleting
    const counts = {
      trades: 0,
      stats: 0,
      opportunities: 0,
      positions: 0,
    };

    // Get counts before deletion
    const [tradesCount, statsCount, oppsCount, positionsCount] = await Promise.all([
      supabaseAdmin.from('polybot_simulated_trades').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('polybot_simulation_stats').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('polybot_opportunities').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('polybot_positions').select('*', { count: 'exact', head: true }),
    ]);

    counts.trades = tradesCount.count || 0;
    counts.stats = statsCount.count || 0;
    counts.opportunities = oppsCount.count || 0;
    counts.positions = positionsCount.count || 0;

    // Delete all simulated trades (use neq to match all rows)
    const { error: tradesError } = await supabaseAdmin
      .from('polybot_simulated_trades')
      .delete()
      .not('id', 'is', null); // Matches all rows

    if (tradesError) {
      await logAuditEvent({
        user_id: authResult.user_id,
        user_email: authResult.user_email,
        action: 'simulation.reset',
        resource_type: 'simulation',
        resource_id: 'all',
        details: { error: 'Failed to delete trades', message: tradesError.message },
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        severity: 'error',
      });
      throw tradesError;
    }

    // Delete all simulation history
    const { error: historyError } = await supabaseAdmin
      .from('polybot_simulation_stats')
      .delete()
      .not('id', 'is', null); // Matches all rows

    if (historyError) throw historyError;

    // Delete all opportunities
    const { error: oppsError } = await supabaseAdmin
      .from('polybot_opportunities')
      .delete()
      .not('id', 'is', null); // Matches all rows

    if (oppsError) throw oppsError;

    // Delete all positions (simulation positions)
    const { error: positionsError } = await supabaseAdmin
      .from('polybot_positions')
      .delete()
      .not('id', 'is', null); // Matches all rows

    if (positionsError) {
      console.warn('Could not delete positions:', positionsError);
    }

    // Reset bot status session counters and live tracking
    const { error: statusError } = await supabaseAdmin
      .from('polybot_status')
      .update({
        opportunities_this_session: 0,
        trades_this_session: 0,
        daily_trades_count: 0,
        daily_profit_usd: 0,
        daily_loss_usd: 0,
        last_opportunity_at: null,
        last_trade_at: null,
      })
      .not('id', 'is', null); // Update all rows

    if (statusError) {
      console.warn('Could not reset status counters:', statusError);
    }

    // Reset live stats table if it exists
    const { error: liveStatsError } = await supabaseAdmin
      .from('polybot_live_stats')
      .delete()
      .not('id', 'is', null);

    if (liveStatsError) {
      console.warn('Could not reset live stats:', liveStatsError);
    }

    // Get the total starting balance from config
    const startingBalance = await getTotalStartingBalance();

    // Insert fresh starting stats with configured starting balance
    const { error: statsError } = await supabaseAdmin
      .from('polybot_simulation_stats')
      .insert({
        snapshot_at: new Date().toISOString(),
        simulated_balance: startingBalance,
        total_pnl: 0,
        total_trades: 0,
        win_rate: 0,
        stats_json: {
          total_opportunities_seen: 0,
          total_simulated_trades: 0,
          simulated_starting_balance: String(startingBalance) + '.00',
          simulated_current_balance: String(startingBalance) + '.00',
          total_pnl: '0.00',
          winning_trades: 0,
          losing_trades: 0,
          pending_trades: 0,
          win_rate_pct: 0,
          roi_pct: 0,
          best_trade_profit: '0.00',
          worst_trade_loss: '0.00',
          largest_opportunity_seen_pct: '0.00',
          first_opportunity_at: null,
          last_opportunity_at: null,
          execution_success_rate_pct: 100,
          total_fees_paid: '0.00',
          total_losses: '0.00',
          failed_executions: 0,
          avg_trade_pnl: '0.00',
        },
      });

    if (statsError) throw statsError;

    // Log successful reset
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'simulation.reset',
      resource_type: 'simulation',
      resource_id: 'all',
      details: {
        deleted: counts,
        new_balance: startingBalance,
        archived_session_id: archiveResult.sessionId,
        trades_archived: archiveResult.tradesArchived,
        message: `Reset simulation: archived ${archiveResult.tradesArchived} trades to session ${archiveResult.sessionId || 'none'}, deleted ${counts.trades} trades, ${counts.opportunities} opportunities, ${counts.stats} stat records`,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({
      success: true,
      deleted: counts,
      new_balance: startingBalance,
      archived: {
        session_id: archiveResult.sessionId,
        trades_archived: archiveResult.tradesArchived,
      },
      message: archiveResult.sessionId 
        ? `Simulation reset complete. Archived ${archiveResult.tradesArchived} trades to session history. Starting balance: $${startingBalance.toLocaleString()}`
        : `Simulation reset complete. No trades to archive. Starting balance: $${startingBalance.toLocaleString()}`,
    });
  } catch (error: any) {
    console.error('Error resetting simulation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset simulation' },
      { status: 500 }
    );
  }
}
