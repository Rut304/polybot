import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, logAuditEvent, checkRateLimit, getRequestMetadata, rateLimitResponse, unauthorizedResponse } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// POST - Generate AI analysis for a simulation session
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - allow 10 requests per 5 minutes
    const metadata = await getRequestMetadata(request);
    const rateLimitResult = await checkRateLimit(metadata.ip_address, 'simulation.analyze', 10, 300);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult.resetAt);
    }

    // Auth verification
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { session_id } = body;
    
    if (!session_id) {
      return NextResponse.json(
        { success: false, error: 'session_id is required' },
        { status: 400 }
      );
    }
    
    // Get session and trades
    const [sessionResult, tradesResult] = await Promise.all([
      supabaseAdmin
        .from('polybot_simulation_sessions')
        .select('*')
        .eq('session_id', session_id)
        .single(),
      supabaseAdmin
        .from('polybot_session_trades')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true }),
    ]);
    
    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }
    
    const session = sessionResult.data;
    const trades = tradesResult.data || [];
    
    // Calculate detailed metrics for analysis
    const metrics = calculateDetailedMetrics(trades);
    
    // Generate AI analysis (this would call an AI service in production)
    const analysis = generateAnalysis(session, metrics);
    const recommendations = generateRecommendations(session, metrics);
    
    // Update session with analysis
    const { error: updateError } = await supabaseAdmin
      .from('polybot_simulation_sessions')
      .update({
        ai_analysis: analysis,
        ai_recommendations: recommendations,
        analysis_generated_at: new Date().toISOString(),
      })
      .eq('session_id', session_id);
    
    if (updateError) {
      console.warn('Failed to save analysis to session:', updateError);
    }
    
    // Log audit event
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'simulation.analyze',
      resource_type: 'simulation_session',
      resource_id: session_id,
      details: { recommendations_count: recommendations.length },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });
    
    return NextResponse.json({
      success: true,
      data: {
        session_id,
        analysis,
        recommendations,
        metrics,
      },
    });
  } catch (error: any) {
    console.error('Error analyzing simulation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

interface TradeMetrics {
  byStrategy: Record<string, {
    trades: number;
    won: number;
    lost: number;
    failed: number;
    pnl: number;
    volume: number;
    avgProfit: number;
    avgLoss: number;
    winRate: number;
    profitFactor: number;
  }>;
  byHour: Record<number, { trades: number; pnl: number }>;
  byDayOfWeek: Record<number, { trades: number; pnl: number }>;
  largestWin: number;
  largestLoss: number;
  avgHoldTime: number;
  consecutiveLosses: number;
  maxDrawdown: number;
}

function calculateDetailedMetrics(trades: any[]): TradeMetrics {
  const metrics: TradeMetrics = {
    byStrategy: {},
    byHour: {},
    byDayOfWeek: {},
    largestWin: 0,
    largestLoss: 0,
    avgHoldTime: 0,
    consecutiveLosses: 0,
    maxDrawdown: 0,
  };
  
  let currentLossStreak = 0;
  let runningPnl = 5000;
  let peakBalance = 5000;
  
  for (const trade of trades) {
    const strategy = trade.arbitrage_type || 'unknown';
    const pnl = parseFloat(trade.actual_profit_usd) || 0;
    const volume = parseFloat(trade.position_size_usd) || 0;
    const createdAt = new Date(trade.created_at);
    const hour = createdAt.getHours();
    const dayOfWeek = createdAt.getDay();
    
    // Strategy breakdown
    if (!metrics.byStrategy[strategy]) {
      metrics.byStrategy[strategy] = {
        trades: 0, won: 0, lost: 0, failed: 0, pnl: 0, volume: 0,
        avgProfit: 0, avgLoss: 0, winRate: 0, profitFactor: 0,
      };
    }
    metrics.byStrategy[strategy].trades++;
    metrics.byStrategy[strategy].volume += volume;
    metrics.byStrategy[strategy].pnl += pnl;
    
    if (trade.outcome === 'won') {
      metrics.byStrategy[strategy].won++;
      currentLossStreak = 0;
    } else if (trade.outcome === 'lost') {
      metrics.byStrategy[strategy].lost++;
      currentLossStreak++;
      metrics.consecutiveLosses = Math.max(metrics.consecutiveLosses, currentLossStreak);
    } else if (trade.outcome === 'failed_execution') {
      metrics.byStrategy[strategy].failed++;
    }
    
    // Largest win/loss
    if (pnl > metrics.largestWin) metrics.largestWin = pnl;
    if (pnl < metrics.largestLoss) metrics.largestLoss = pnl;
    
    // Time-based analysis
    if (!metrics.byHour[hour]) metrics.byHour[hour] = { trades: 0, pnl: 0 };
    metrics.byHour[hour].trades++;
    metrics.byHour[hour].pnl += pnl;
    
    if (!metrics.byDayOfWeek[dayOfWeek]) metrics.byDayOfWeek[dayOfWeek] = { trades: 0, pnl: 0 };
    metrics.byDayOfWeek[dayOfWeek].trades++;
    metrics.byDayOfWeek[dayOfWeek].pnl += pnl;
    
    // Drawdown calculation
    runningPnl += pnl;
    if (runningPnl > peakBalance) {
      peakBalance = runningPnl;
    }
    const drawdown = (peakBalance - runningPnl) / peakBalance * 100;
    if (drawdown > metrics.maxDrawdown) {
      metrics.maxDrawdown = drawdown;
    }
  }
  
  // Calculate derived metrics for each strategy
  for (const strategy of Object.keys(metrics.byStrategy)) {
    const s = metrics.byStrategy[strategy];
    const completedTrades = s.won + s.lost;
    s.winRate = completedTrades > 0 ? (s.won / completedTrades) * 100 : 0;
    
    // Calculate avg profit/loss
    const wins = trades.filter(t => t.arbitrage_type === strategy && t.outcome === 'won');
    const losses = trades.filter(t => t.arbitrage_type === strategy && t.outcome === 'lost');
    
    s.avgProfit = wins.length > 0 
      ? wins.reduce((sum, t) => sum + (parseFloat(t.actual_profit_usd) || 0), 0) / wins.length 
      : 0;
    s.avgLoss = losses.length > 0 
      ? Math.abs(losses.reduce((sum, t) => sum + (parseFloat(t.actual_profit_usd) || 0), 0) / losses.length)
      : 0;
    
    s.profitFactor = s.avgLoss > 0 ? s.avgProfit / s.avgLoss : 0;
  }
  
  return metrics;
}

function generateAnalysis(session: any, metrics: TradeMetrics): string {
  const roiPct = parseFloat(session.roi_pct) || 0;
  const totalTrades = session.total_trades || 0;
  const winRate = parseFloat(session.win_rate) || 0;
  const totalPnl = parseFloat(session.total_pnl) || 0;
  
  let analysis = `## Simulation Analysis Report\n\n`;
  analysis += `### Overview\n`;
  analysis += `This simulation ran from ${new Date(session.started_at).toLocaleDateString()} to ${new Date(session.ended_at).toLocaleDateString()}.\n\n`;
  
  // Overall performance assessment
  if (roiPct > 10) {
    analysis += `**Strong Performance**: The simulation achieved a ${roiPct.toFixed(2)}% return, significantly outperforming expectations.\n\n`;
  } else if (roiPct > 0) {
    analysis += `**Positive Performance**: The simulation was profitable with a ${roiPct.toFixed(2)}% return, though there's room for optimization.\n\n`;
  } else if (roiPct > -20) {
    analysis += `**Moderate Loss**: The simulation lost ${Math.abs(roiPct).toFixed(2)}%, indicating strategy adjustments are needed.\n\n`;
  } else {
    analysis += `**Significant Loss**: The simulation experienced a ${Math.abs(roiPct).toFixed(2)}% drawdown. Immediate strategy review is recommended.\n\n`;
  }
  
  // Win rate analysis
  analysis += `### Trade Analysis\n`;
  analysis += `- **Total Trades**: ${totalTrades}\n`;
  analysis += `- **Win Rate**: ${winRate.toFixed(1)}%\n`;
  analysis += `- **Largest Win**: $${metrics.largestWin.toFixed(2)}\n`;
  analysis += `- **Largest Loss**: $${Math.abs(metrics.largestLoss).toFixed(2)}\n`;
  analysis += `- **Max Drawdown**: ${metrics.maxDrawdown.toFixed(1)}%\n`;
  analysis += `- **Max Consecutive Losses**: ${metrics.consecutiveLosses}\n\n`;
  
  // Strategy breakdown
  analysis += `### Strategy Performance\n\n`;
  for (const [strategy, stats] of Object.entries(metrics.byStrategy)) {
    const strategyName = formatStrategyName(strategy);
    analysis += `#### ${strategyName}\n`;
    analysis += `- Trades: ${stats.trades} (Won: ${stats.won}, Lost: ${stats.lost}, Failed: ${stats.failed})\n`;
    analysis += `- Win Rate: ${stats.winRate.toFixed(1)}%\n`;
    analysis += `- P&L: $${stats.pnl.toFixed(2)}\n`;
    analysis += `- Avg Win: $${stats.avgProfit.toFixed(2)} | Avg Loss: $${stats.avgLoss.toFixed(2)}\n`;
    analysis += `- Profit Factor: ${stats.profitFactor.toFixed(2)}\n\n`;
  }
  
  // Key insights
  analysis += `### Key Insights\n\n`;
  
  // Find best/worst performing strategy
  const strategies = Object.entries(metrics.byStrategy);
  if (strategies.length > 0) {
    const bestStrategy = strategies.reduce((best, [name, stats]) => 
      stats.pnl > (best?.[1]?.pnl || -Infinity) ? [name, stats] : best, 
      strategies[0]
    );
    const worstStrategy = strategies.reduce((worst, [name, stats]) => 
      stats.pnl < (worst?.[1]?.pnl || Infinity) ? [name, stats] : worst,
      strategies[0]
    );
    
    analysis += `1. **Best Performing Strategy**: ${formatStrategyName(bestStrategy[0])} with $${(bestStrategy[1] as any).pnl.toFixed(2)} P&L\n`;
    analysis += `2. **Worst Performing Strategy**: ${formatStrategyName(worstStrategy[0])} with $${(worstStrategy[1] as any).pnl.toFixed(2)} P&L\n`;
  }
  
  // Execution issues
  const failedTrades = session.failed_trades || 0;
  const executionRate = totalTrades > 0 ? ((totalTrades - failedTrades) / totalTrades) * 100 : 100;
  if (executionRate < 80) {
    analysis += `3. **Execution Issues**: ${(100 - executionRate).toFixed(0)}% of trades failed to execute, indicating potential latency or API issues.\n`;
  }
  
  return analysis;
}

function generateRecommendations(session: any, metrics: TradeMetrics): any[] {
  const recommendations: any[] = [];
  const roiPct = parseFloat(session.roi_pct) || 0;
  const winRate = parseFloat(session.win_rate) || 0;
  
  // ROI-based recommendations
  if (roiPct < -10) {
    recommendations.push({
      id: 'reduce_position_size',
      priority: 'high',
      category: 'risk_management',
      title: 'Reduce Position Size',
      description: 'Given the significant losses, reduce max position size by 50% to limit further drawdown.',
      config_changes: {
        max_trade_size: 25,
        'funding_max_position_usd': 500,
        'grid_default_investment_usd': 250,
      },
      expected_impact: 'Reduce maximum potential loss per trade',
    });
  }
  
  // Win rate recommendations
  if (winRate < 50) {
    recommendations.push({
      id: 'increase_min_profit_threshold',
      priority: 'high',
      category: 'strategy',
      title: 'Increase Minimum Profit Threshold',
      description: 'Low win rate suggests taking marginal opportunities. Increase minimum profit thresholds to be more selective.',
      config_changes: {
        'kalshi_single_min_profit_pct': 4.0,
        'poly_single_min_profit_pct': 3.0,
      },
      expected_impact: 'Fewer trades but higher quality opportunities',
    });
  }
  
  // Strategy-specific recommendations
  for (const [strategy, stats] of Object.entries(metrics.byStrategy)) {
    if (stats.failed > stats.trades * 0.3) {
      recommendations.push({
        id: `fix_execution_${strategy}`,
        priority: 'high',
        category: 'execution',
        title: `Fix ${formatStrategyName(strategy)} Execution`,
        description: `${stats.failed} out of ${stats.trades} trades failed. Check API connectivity and rate limits.`,
        config_changes: {},
        expected_impact: 'Improve execution success rate',
      });
    }
    
    if (stats.pnl < -100 && stats.trades > 10) {
      recommendations.push({
        id: `disable_${strategy}`,
        priority: 'medium',
        category: 'strategy',
        title: `Consider Disabling ${formatStrategyName(strategy)}`,
        description: `This strategy lost $${Math.abs(stats.pnl).toFixed(2)} over ${stats.trades} trades. Consider disabling until market conditions change.`,
        config_changes: {
          [`enable_${strategy}`]: false,
        },
        expected_impact: 'Stop losses from this underperforming strategy',
      });
    }
  }
  
  // Drawdown recommendation
  if (metrics.maxDrawdown > 30) {
    recommendations.push({
      id: 'add_drawdown_protection',
      priority: 'high',
      category: 'risk_management',
      title: 'Add Drawdown Protection',
      description: `Max drawdown reached ${metrics.maxDrawdown.toFixed(1)}%. Implement automatic pause when drawdown exceeds 20%.`,
      config_changes: {
        'max_drawdown_pct': 20,
        'auto_pause_on_drawdown': true,
      },
      expected_impact: 'Prevent catastrophic losses',
    });
  }
  
  // Consecutive losses recommendation
  if (metrics.consecutiveLosses > 5) {
    recommendations.push({
      id: 'add_loss_streak_protection',
      priority: 'medium',
      category: 'risk_management',
      title: 'Add Loss Streak Protection',
      description: `Experienced ${metrics.consecutiveLosses} consecutive losses. Consider pausing after 5 consecutive losses.`,
      config_changes: {
        'max_consecutive_losses': 5,
        'pause_on_loss_streak': true,
      },
      expected_impact: 'Prevent tilt-induced trading decisions',
    });
  }
  
  return recommendations;
}

function formatStrategyName(strategy: string): string {
  const names: Record<string, string> = {
    'kalshi_single': 'Kalshi Single-Platform Arb',
    'poly_single': 'Polymarket Single-Platform Arb',
    'polymarket_single': 'Polymarket Single-Platform Arb',
    'cross_platform': 'Cross-Platform Arb',
    'funding_rate_arb': 'Funding Rate Arbitrage',
    'grid_trading': 'Grid Trading',
    'pairs_trading': 'Pairs Trading',
    'market_making': 'Market Making',
    'news_arbitrage': 'News Arbitrage',
  };
  return names[strategy] || strategy.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
