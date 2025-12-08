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
        message: `Reset simulation: deleted ${counts.trades} trades, ${counts.opportunities} opportunities, ${counts.stats} stat records`,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({
      success: true,
      deleted: counts,
      new_balance: startingBalance,
      message: `Simulation reset complete. Deleted ${counts.trades} trades, ${counts.opportunities} opportunities. Starting balance: $${startingBalance.toLocaleString()}`,
    });
  } catch (error: any) {
    console.error('Error resetting simulation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset simulation' },
      { status: 500 }
    );
  }
}
