import { NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com';
const POLYMARKET_CLOB_API = 'https://clob.polymarket.com';

// Fetch leaderboard from Polymarket directly
async function fetchPolymarketLeaderboard(limit: number = 100): Promise<any[]> {
  try {
    const response = await fetch(`${POLYMARKET_CLOB_API}/leaderboard?limit=${limit}&period=all`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Polymarket leaderboard returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Polymarket leaderboard:', error);
    return [];
  }
}

// GET /api/whales/leaderboard - Fetch top traders from Polymarket
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const minWinRate = parseFloat(searchParams.get('minWinRate') || '65');
  const minVolume = parseFloat(searchParams.get('minVolume') || '5000');
  const minPredictions = parseInt(searchParams.get('minPredictions') || '25', 10);

  try {
    // Fetch from Polymarket CLOB API
    const traders = await fetchPolymarketLeaderboard(limit);
    
    // Filter and transform
    const whales = traders
      .filter((trader: any) => {
        const winRate = (trader.win_rate || 0) * 100;
        const volume = trader.volume || 0;
        const predictions = trader.predictions || 0;
        
        return winRate >= minWinRate && 
               volume >= minVolume && 
               predictions >= minPredictions;
      })
      .map((trader: any, index: number) => ({
        address: trader.address || '',
        username: trader.username || null,
        volume: trader.volume || 0,
        win_rate: (trader.win_rate || 0) * 100,
        predictions: trader.predictions || 0,
        pnl: trader.profit || trader.pnl || 0,
        rank: index + 1,
        tier: calculateTier(trader.volume || 0, (trader.win_rate || 0) * 100),
      }));

    return NextResponse.json({
      success: true,
      count: whales.length,
      filters: {
        minWinRate,
        minVolume,
        minPredictions,
      },
      data: whales,
    });
  } catch (error) {
    console.error('Error in whale leaderboard API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
        data: [],
      },
      { status: 500 }
    );
  }
}

// Calculate whale tier based on volume and win rate
function calculateTier(volume: number, winRate: number): string {
  if (volume >= 100000 && winRate >= 80) return 'mega_whale';
  if (volume >= 50000 && winRate >= 75) return 'whale';
  if (volume >= 10000 && winRate >= 70) return 'smart_money';
  return 'retail';
}
