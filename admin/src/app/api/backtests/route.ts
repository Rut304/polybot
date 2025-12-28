import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
};

// GET - Get all backtests for a user
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const backtestId = searchParams.get('id');

    if (backtestId) {
      // Get specific backtest with trades
      const { data: backtest, error } = await supabase
        .from('polybot_backtests')
        .select('*')
        .eq('id', backtestId)
        .eq('user_id', userId)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Backtest not found' }, { status: 404 });
      }

      // Get trades for this backtest
      const { data: trades } = await supabase
        .from('polybot_backtest_trades')
        .select('*')
        .eq('backtest_id', backtestId)
        .order('trade_date', { ascending: true });

      return NextResponse.json({ ...backtest, trades: trades || [] });
    }

    // Get all backtests
    const { data: backtests, error } = await supabase
      .from('polybot_backtests')
      .select('id, name, strategy_type, status, start_date, end_date, total_pnl, win_rate, total_trades, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching backtests:', error);
      return NextResponse.json({ error: 'Failed to fetch backtests' }, { status: 500 });
    }

    return NextResponse.json({ backtests: backtests || [] });
  } catch (error: any) {
    console.error('Backtest API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new backtest
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await req.json();
    const {
      name,
      strategy_type,
      start_date,
      end_date,
      initial_capital = 10000,
      position_size = 5,
      stop_loss,
      take_profit,
      strategy_params = {},
    } = body;

    // Validate required fields
    if (!name || !strategy_type || !start_date || !end_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, strategy_type, start_date, end_date' 
      }, { status: 400 });
    }

    // Create the backtest record
    const { data: backtest, error } = await supabase
      .from('polybot_backtests')
      .insert({
        user_id: userId,
        name,
        strategy_type,
        start_date,
        end_date,
        initial_capital,
        position_size,
        stop_loss,
        take_profit,
        strategy_params,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating backtest:', error);
      return NextResponse.json({ error: 'Failed to create backtest' }, { status: 500 });
    }

    // Trigger the backtest execution (async)
    // In production, this would be a job queue
    runBacktest(backtest.id, supabase).catch(console.error);

    return NextResponse.json({ 
      backtest,
      message: 'Backtest created and running' 
    });
  } catch (error: any) {
    console.error('Backtest POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a backtest
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const backtestId = searchParams.get('id');

    if (!backtestId) {
      return NextResponse.json({ error: 'Missing backtest ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { error } = await supabase
      .from('polybot_backtests')
      .delete()
      .eq('id', backtestId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting backtest:', error);
      return NextResponse.json({ error: 'Failed to delete backtest' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Backtest DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Simulated backtest execution
// In production, this would call the Python backend
async function runBacktest(backtestId: string, supabase: any) {
  try {
    // Mark as running
    await supabase
      .from('polybot_backtests')
      .update({ status: 'running' })
      .eq('id', backtestId);

    // Get backtest config
    const { data: backtest } = await supabase
      .from('polybot_backtests')
      .select('*')
      .eq('id', backtestId)
      .single();

    if (!backtest) return;

    // Simulate backtest results (in production, call Python backend)
    const simulatedResults = await simulateBacktest(backtest);

    // Update with results
    await supabase
      .from('polybot_backtests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_trades: simulatedResults.total_trades,
        winning_trades: simulatedResults.winning_trades,
        losing_trades: simulatedResults.losing_trades,
        total_pnl: simulatedResults.total_pnl,
        max_drawdown: simulatedResults.max_drawdown,
        sharpe_ratio: simulatedResults.sharpe_ratio,
        win_rate: simulatedResults.win_rate,
        avg_trade_return: simulatedResults.avg_trade_return,
        results: simulatedResults.results,
      })
      .eq('id', backtestId);

    // Insert simulated trades
    if (simulatedResults.trades && simulatedResults.trades.length > 0) {
      await supabase
        .from('polybot_backtest_trades')
        .insert(simulatedResults.trades.map((t: any) => ({
          backtest_id: backtestId,
          ...t,
        })));
    }
  } catch (error) {
    console.error('Backtest execution error:', error);
    await supabase
      .from('polybot_backtests')
      .update({ 
        status: 'failed', 
        error_message: error instanceof Error ? error.message : 'Unknown error' 
      })
      .eq('id', backtestId);
  }
}

// Simulate backtest results (placeholder - in production this calls Python)
async function simulateBacktest(backtest: any) {
  // Calculate number of days
  const startDate = new Date(backtest.start_date);
  const endDate = new Date(backtest.end_date);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Generate realistic-looking results based on strategy
  const tradesPerDay = backtest.strategy_type.includes('arbitrage') ? 0.5 : 2;
  const totalTrades = Math.floor(days * tradesPerDay);
  const winRate = getStrategyWinRate(backtest.strategy_type);
  const winningTrades = Math.floor(totalTrades * winRate);
  const losingTrades = totalTrades - winningTrades;
  
  // Calculate PnL
  const avgWin = backtest.initial_capital * (backtest.position_size / 100) * 0.08; // 8% avg win
  const avgLoss = backtest.initial_capital * (backtest.position_size / 100) * 0.05; // 5% avg loss
  const totalPnl = (winningTrades * avgWin) - (losingTrades * avgLoss);
  
  // Generate individual trades
  const trades = [];
  let currentDate = new Date(startDate);
  let equity = backtest.initial_capital;
  const equityCurve = [{ date: currentDate.toISOString(), equity }];
  
  for (let i = 0; i < totalTrades; i++) {
    currentDate = new Date(currentDate.getTime() + (Math.random() * 2 + 0.5) * 24 * 60 * 60 * 1000);
    if (currentDate > endDate) break;
    
    const isWin = Math.random() < winRate;
    const pnl = isWin 
      ? avgWin * (0.5 + Math.random()) 
      : -avgLoss * (0.5 + Math.random());
    
    equity += pnl;
    
    trades.push({
      trade_date: currentDate.toISOString(),
      symbol: getRandomSymbol(backtest.strategy_type),
      market_title: getRandomMarketTitle(backtest.strategy_type),
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      entry_price: 0.45 + Math.random() * 0.1,
      exit_price: isWin ? 0.55 + Math.random() * 0.1 : 0.35 + Math.random() * 0.1,
      position_size: backtest.initial_capital * (backtest.position_size / 100),
      pnl: pnl,
      pnl_percent: (pnl / (backtest.initial_capital * (backtest.position_size / 100))) * 100,
      exit_reason: isWin ? 'signal' : (Math.random() > 0.5 ? 'stop_loss' : 'signal'),
    });
    
    equityCurve.push({ date: currentDate.toISOString(), equity });
  }
  
  // Calculate max drawdown
  let maxEquity = backtest.initial_capital;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.equity > maxEquity) maxEquity = point.equity;
    const drawdown = ((maxEquity - point.equity) / maxEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return {
    total_trades: trades.length,
    winning_trades: trades.filter(t => t.pnl > 0).length,
    losing_trades: trades.filter(t => t.pnl <= 0).length,
    total_pnl: totalPnl,
    max_drawdown: maxDrawdown,
    sharpe_ratio: totalPnl > 0 ? 1.2 + Math.random() * 0.8 : 0.5 - Math.random() * 0.5,
    win_rate: winRate * 100,
    avg_trade_return: trades.length > 0 ? totalPnl / trades.length : 0,
    results: {
      equity_curve: equityCurve,
      monthly_returns: calculateMonthlyReturns(trades),
    },
    trades,
  };
}

function getStrategyWinRate(strategyType: string): number {
  const rates: Record<string, number> = {
    'polymarket_single': 0.52,
    'kalshi_single': 0.78,
    'cross_platform': 0.85,
    'overlapping_arb': 0.65,
    'rsi': 0.55,
    'momentum': 0.48,
    'congressional': 0.62,
  };
  return rates[strategyType] || 0.50;
}

function getRandomSymbol(strategyType: string): string {
  const symbols: Record<string, string[]> = {
    'polymarket_single': ['TRUMP-WIN', 'BTC-100K', 'FED-CUT'],
    'kalshi_single': ['INXD-24', 'KXBTC-24', 'KXFED-24'],
    'congressional': ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN'],
    'rsi': ['SPY', 'QQQ', 'AAPL', 'TSLA'],
  };
  const list = symbols[strategyType] || ['MARKET-1', 'MARKET-2', 'MARKET-3'];
  return list[Math.floor(Math.random() * list.length)];
}

function getRandomMarketTitle(strategyType: string): string {
  const titles: Record<string, string[]> = {
    'polymarket_single': [
      'Will Trump win 2024 election?',
      'Will BTC hit $100K by Dec 2024?',
      'Will Fed cut rates in January?',
    ],
    'kalshi_single': [
      'S&P 500 closing range today',
      'Bitcoin price range this week',
      'Fed rate decision',
    ],
    'congressional': [
      'Apple Inc.',
      'NVIDIA Corporation',
      'Microsoft Corporation',
    ],
  };
  const list = titles[strategyType] || ['Market Opportunity'];
  return list[Math.floor(Math.random() * list.length)];
}

function calculateMonthlyReturns(trades: any[]): Record<string, number> {
  const monthly: Record<string, number> = {};
  for (const trade of trades) {
    const month = trade.trade_date.substring(0, 7); // YYYY-MM
    monthly[month] = (monthly[month] || 0) + trade.pnl;
  }
  return monthly;
}
