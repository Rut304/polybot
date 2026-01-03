import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Public Live Feed API - Returns recent trades for landing page ticker
// No authentication required - shows anonymized public data
// ============================================================================

export const dynamic = 'force-dynamic';

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

interface PublicTrade {
  id: string;
  market: string;
  action: string;
  outcome: string;
  platform: string;
  profit: number;
  timestamp: string;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      // Return sample data if DB not configured
      return NextResponse.json({
        trades: getSampleTrades(),
        source: 'sample',
        count: 10
      });
    }

    // Fetch recent successful trades from simulation/paper trading
    // Only show trades with positive outcomes for social proof
    const { data: trades, error } = await supabase
      .from('polybot_simulated_trades')
      .select('id, polymarket_market_title, kalshi_market_title, trade_type, actual_profit_usd, outcome, created_at, trading_mode')
      .in('outcome', ['won', 'pending'])  // Only show successful or pending
      .eq('trading_mode', 'paper')  // Only show paper trades publicly (not live trades)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching public trades:', error);
      return NextResponse.json({
        trades: getSampleTrades(),
        source: 'sample',
        error: 'Database error, showing sample data'
      });
    }

    if (!trades || trades.length === 0) {
      return NextResponse.json({
        trades: getSampleTrades(),
        source: 'sample',
        count: 0
      });
    }

    // Transform and anonymize the data
    const publicTrades: PublicTrade[] = trades.map(trade => {
      const marketTitle = trade.polymarket_market_title || trade.kalshi_market_title || 'Market Trade';
      const platform = trade.trade_type?.includes('polymarket') ? 'polymarket' : 
                       trade.trade_type?.includes('kalshi') ? 'kalshi' : 'polymarket';
      const profit = trade.actual_profit_usd || 0;
      
      // Anonymize market title to avoid revealing specific positions
      const anonymizedMarket = anonymizeMarket(marketTitle);
      
      // Determine action based on profit
      const action = profit >= 0 ? 'BUY YES' : 'BUY NO';
      
      return {
        id: trade.id,
        market: anonymizedMarket,
        action: action,
        outcome: trade.outcome,
        platform: platform,
        profit: Math.abs(profit),
        timestamp: trade.created_at
      };
    });

    // Also fetch aggregate stats (paper trades only for public display)
    const { data: stats } = await supabase
      .from('polybot_simulated_trades')
      .select('actual_profit_usd, outcome')
      .eq('trading_mode', 'paper');
    
    const totalTrades = stats?.length || 0;
    const winningTrades = stats?.filter(t => t.outcome === 'won').length || 0;
    const totalProfit = stats?.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0) || 0;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;

    return NextResponse.json({
      trades: publicTrades,
      source: 'live',
      stats: {
        totalTrades,
        winningTrades,
        winRate: Math.round(winRate * 10) / 10,
        totalProfit: Math.round(totalProfit * 100) / 100
      }
    });

  } catch (error) {
    console.error('Error in live feed:', error);
    return NextResponse.json({
      trades: getSampleTrades(),
      source: 'sample',
      error: 'Server error'
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function anonymizeMarket(title: string): string {
  // Keep first 40 chars, truncate with ellipsis
  if (title.length > 40) {
    return title.substring(0, 37) + '...';
  }
  return title;
}

function getSampleTrades(): PublicTrade[] {
  // Sample trades for when database is unavailable
  const markets = [
    'Will BTC reach $150k by 2025?',
    'Fed Rate Cut in January?',
    'Trump Win 2024 Election?',
    'ETH/BTC Ratio > 0.05?',
    'S&P 500 > 6000 EOY?',
    'Will Tesla hit $400?',
    'Super Bowl Winner: Chiefs?',
    'World Cup 2026 Host: USA?',
    'Apple Stock > $200?',
    'Gold Price > $2500?'
  ];
  
  return markets.map((market, i) => ({
    id: `sample-${i}`,
    market,
    action: i % 2 === 0 ? 'BUY YES' : 'SELL NO',
    outcome: 'won',
    platform: i % 3 === 0 ? 'kalshi' : 'polymarket',
    profit: Math.round((50 + Math.random() * 450) * 100) / 100,
    timestamp: new Date(Date.now() - i * 60000 * 5).toISOString()
  }));
}
