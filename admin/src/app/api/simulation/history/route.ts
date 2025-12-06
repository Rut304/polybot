import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, logAuditEvent, checkRateLimit, getRequestMetadata, rateLimitResponse, unauthorizedResponse } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// GET - List all simulation sessions or get details for one
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (sessionId) {
      // Get specific session with its trades
      const [sessionResult, tradesResult] = await Promise.all([
        supabaseAdmin
          .from('polybot_simulation_sessions')
          .select('*')
          .eq('session_id', sessionId)
          .single(),
        supabaseAdmin
          .from('polybot_session_trades')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false }),
      ]);
      
      if (sessionResult.error) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 }
        );
      }
      
      // Calculate strategy breakdown
      const trades = tradesResult.data || [];
      const strategyBreakdown: Record<string, any> = {};
      
      for (const trade of trades) {
        const strategy = trade.arbitrage_type || 'unknown';
        if (!strategyBreakdown[strategy]) {
          strategyBreakdown[strategy] = {
            total_trades: 0,
            winning: 0,
            losing: 0,
            failed: 0,
            total_pnl: 0,
            total_volume: 0,
          };
        }
        strategyBreakdown[strategy].total_trades++;
        strategyBreakdown[strategy].total_volume += parseFloat(trade.position_size_usd) || 0;
        strategyBreakdown[strategy].total_pnl += parseFloat(trade.actual_profit_usd) || 0;
        
        if (trade.outcome === 'won') strategyBreakdown[strategy].winning++;
        else if (trade.outcome === 'lost') strategyBreakdown[strategy].losing++;
        else if (trade.outcome === 'failed_execution') strategyBreakdown[strategy].failed++;
      }
      
      return NextResponse.json({
        success: true,
        data: {
          session: sessionResult.data,
          trades: trades,
          strategy_breakdown: strategyBreakdown,
        },
      });
    }
    
    // List all sessions
    let query = supabaseAdmin
      .from('polybot_simulation_sessions')
      .select('*')
      .order('ended_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        sessions: data || [],
      },
    });
  } catch (error: any) {
    console.error('Error in simulation history API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Archive current simulation and start new session
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const metadata = await getRequestMetadata(request);
    const rateLimitResult = await checkRateLimit(metadata.ip_address, 'simulation.archive', 5, 60);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult.resetAt);
    }

    // Auth verification
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { notes } = body;
    
    // Get current simulation stats
    const { data: statsData } = await supabaseAdmin
      .from('polybot_simulation_stats')
      .select('*')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();
    
    const endingBalance = statsData?.simulated_balance || 5000;
    const totalPnl = statsData?.total_pnl || 0;
    
    // Check if there are any trades to archive
    const { count: tradesCount } = await supabaseAdmin
      .from('polybot_simulated_trades')
      .select('*', { count: 'exact', head: true });
    
    if (!tradesCount || tradesCount === 0) {
      return NextResponse.json(
        { success: false, error: 'No trades to archive' },
        { status: 400 }
      );
    }
    
    // Get current config for snapshot
    const { data: configData } = await supabaseAdmin
      .from('polybot_config')
      .select('*')
      .limit(1)
      .single();
    
    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Get trade statistics
    const { data: tradesData } = await supabaseAdmin
      .from('polybot_simulated_trades')
      .select('*');
    
    const trades = tradesData || [];
    const winning = trades.filter(t => t.outcome === 'won').length;
    const losing = trades.filter(t => t.outcome === 'lost').length;
    const failed = trades.filter(t => t.outcome === 'failed_execution').length;
    const winRate = (winning + losing) > 0 ? (winning / (winning + losing)) * 100 : 0;
    
    // Get earliest trade date
    const startedAt = trades.length > 0 
      ? trades.reduce((min, t) => t.created_at < min ? t.created_at : min, trades[0].created_at)
      : new Date().toISOString();
    
    // Calculate strategy performance
    const strategyPerf: Record<string, any> = {};
    for (const trade of trades) {
      const strategy = trade.arbitrage_type || 'unknown';
      if (!strategyPerf[strategy]) {
        strategyPerf[strategy] = {
          trades: 0, won: 0, lost: 0, failed: 0, pnl: 0, volume: 0
        };
      }
      strategyPerf[strategy].trades++;
      strategyPerf[strategy].volume += parseFloat(trade.position_size_usd) || 0;
      strategyPerf[strategy].pnl += parseFloat(trade.actual_profit_usd) || 0;
      if (trade.outcome === 'won') strategyPerf[strategy].won++;
      else if (trade.outcome === 'lost') strategyPerf[strategy].lost++;
      else if (trade.outcome === 'failed_execution') strategyPerf[strategy].failed++;
    }
    
    // Create session record
    const { error: sessionError } = await supabaseAdmin
      .from('polybot_simulation_sessions')
      .insert({
        session_id: sessionId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        status: 'completed',
        starting_balance: 5000.00,
        ending_balance: endingBalance,
        total_pnl: totalPnl,
        roi_pct: (totalPnl / 5000) * 100,
        total_trades: trades.length,
        winning_trades: winning,
        losing_trades: losing,
        failed_trades: failed,
        win_rate: winRate,
        strategies_used: Object.keys(strategyPerf),
        strategy_performance: strategyPerf,
        config_snapshot: configData || {},
        notes: notes || null,
      });
    
    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { success: false, error: 'Failed to create session record' },
        { status: 500 }
      );
    }
    
    // Copy trades to session_trades
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
      side: parseFloat(trade.polymarket_yes_price) > 0 ? 'yes' : 'no',
      position_size_usd: trade.position_size_usd,
      yes_price: trade.polymarket_yes_price || trade.kalshi_yes_price,
      no_price: trade.polymarket_no_price || trade.kalshi_no_price,
      expected_profit_pct: trade.expected_profit_pct,
      expected_profit_usd: trade.expected_profit_usd,
      actual_profit_usd: trade.actual_profit_usd,
      outcome: trade.outcome,
      resolution_notes: trade.resolution_notes,
      resolved_at: trade.resolved_at,
    }));
    
    if (sessionTrades.length > 0) {
      const { error: tradesError } = await supabaseAdmin
        .from('polybot_session_trades')
        .insert(sessionTrades);
      
      if (tradesError) {
        console.warn('Error copying trades to session:', tradesError);
      }
    }
    
    // Log audit event
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'simulation.archive',
      resource_type: 'simulation_session',
      resource_id: sessionId,
      details: {
        trades_archived: trades.length,
        ending_balance: endingBalance,
        total_pnl: totalPnl,
        roi_pct: (totalPnl / 5000) * 100,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });
    
    return NextResponse.json({
      success: true,
      data: {
        session_id: sessionId,
        trades_archived: trades.length,
        ending_balance: endingBalance,
        total_pnl: totalPnl,
        message: `Archived ${trades.length} trades. Session ID: ${sessionId}`,
      },
    });
  } catch (error: any) {
    console.error('Error archiving simulation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
