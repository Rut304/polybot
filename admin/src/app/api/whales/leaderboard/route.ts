import { NextResponse } from 'next/server';

// The correct endpoint is the Polymarket Data-API (not the CLOB API)
// CLOB API is for trading, Data-API is for aggregated user data like leaderboards
const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';

// Time period options: DAY, WEEK, MONTH, ALL
// OrderBy options: PNL, VOL
// Category options: OVERALL, POLITICS, SPORTS, CRYPTO
interface LeaderboardParams {
  limit?: number;
  offset?: number;
  timePeriod?: 'DAY' | 'WEEK' | 'MONTH' | 'ALL';
  orderBy?: 'PNL' | 'VOL';
  category?: 'OVERALL' | 'POLITICS' | 'SPORTS' | 'CRYPTO';
}

// Fetch leaderboard from Polymarket Data-API (the correct public endpoint)
async function fetchPolymarketLeaderboard(params: LeaderboardParams = {}): Promise<any[]> {
  const {
    limit = 100,
    offset = 0,
    timePeriod = 'ALL',
    orderBy = 'PNL',
    category = 'OVERALL',
  } = params;

  try {
    const url = new URL(`${POLYMARKET_DATA_API}/v1/leaderboard`);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());
    url.searchParams.set('timePeriod', timePeriod);
    url.searchParams.set('orderBy', orderBy);
    if (category !== 'OVERALL') {
      url.searchParams.set('category', category);
    }

    console.log(`Fetching Polymarket leaderboard: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Polymarket Data-API leaderboard returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    // Data-API returns array directly, not wrapped in data property
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching Polymarket leaderboard:', error);
    return [];
  }
}

// GET /api/whales/leaderboard - Fetch top traders from Polymarket Data-API
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const minVolume = parseFloat(searchParams.get('minVolume') || '10000'); // $10k minimum
  const minPnl = parseFloat(searchParams.get('minPnl') || '0'); // Minimum profit
  const timePeriod = (searchParams.get('timePeriod') || 'ALL') as 'DAY' | 'WEEK' | 'MONTH' | 'ALL';
  const orderBy = (searchParams.get('orderBy') || 'PNL') as 'PNL' | 'VOL';
  const category = (searchParams.get('category') || 'OVERALL') as 'OVERALL' | 'POLITICS' | 'SPORTS' | 'CRYPTO';

  try {
    // Fetch from Polymarket Data-API leaderboard
    const traders = await fetchPolymarketLeaderboard({
      limit: Math.min(limit, 50), // API max is 50 per request
      offset,
      timePeriod,
      orderBy,
      category,
    });
    
    if (traders.length === 0) {
      console.warn('No traders returned from Polymarket Data-API');
      return NextResponse.json({
        success: true,
        count: 0,
        source: 'polymarket-data-api',
        filters: { minVolume, minPnl, timePeriod, orderBy, category },
        data: [],
        message: 'No traders found matching criteria',
      });
    }
    
    // Transform Polymarket Data-API format to our whale format
    // Data-API format: { rank, proxyWallet, userName, xUsername, verifiedBadge, vol, pnl, profileImage }
    const whales = traders
      .filter((trader: any) => {
        const volume = trader.vol || 0;
        const pnl = trader.pnl || 0;
        
        return volume >= minVolume && pnl >= minPnl;
      })
      .slice(0, limit)
      .map((trader: any) => ({
        address: trader.proxyWallet || '',
        username: trader.userName || null,
        xUsername: trader.xUsername || null,
        verified: trader.verifiedBadge || false,
        volume: trader.vol || 0,
        pnl: trader.pnl || 0,
        rank: parseInt(trader.rank, 10) || 0,
        profileImage: trader.profileImage || null,
        tier: calculateTier(trader.vol || 0, trader.pnl || 0),
      }));

    return NextResponse.json({
      success: true,
      count: whales.length,
      source: 'polymarket-data-api',
      filters: {
        minVolume,
        minPnl,
        timePeriod,
        orderBy,
        category,
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

// Calculate whale tier based on volume and PnL
function calculateTier(volume: number, pnl: number): string {
  if (volume >= 10000000 && pnl >= 500000) return 'mega_whale';
  if (volume >= 1000000 && pnl >= 100000) return 'whale';
  if (volume >= 100000 && pnl >= 10000) return 'smart_money';
  return 'retail';
}
