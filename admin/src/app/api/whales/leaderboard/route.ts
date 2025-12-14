import { NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com';

// Get current Polymarket build ID by scraping their homepage
async function getPolymarketBuildId(): Promise<string | null> {
  try {
    const response = await fetch('https://polymarket.com/leaderboard', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch Polymarket page: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract buildId from Next.js __NEXT_DATA__ script
    const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
    if (buildIdMatch && buildIdMatch[1]) {
      return buildIdMatch[1];
    }
    
    console.error('Could not find buildId in Polymarket page');
    return null;
  } catch (error) {
    console.error('Error fetching Polymarket build ID:', error);
    return null;
  }
}

// Fetch leaderboard from Polymarket's Next.js data endpoint
async function fetchPolymarketLeaderboard(limit: number = 100): Promise<any[]> {
  try {
    // First, get the current build ID
    const buildId = await getPolymarketBuildId();
    
    if (!buildId) {
      console.error('Could not get Polymarket build ID');
      return [];
    }
    
    // Fetch the leaderboard data using Next.js data route
    const dataUrl = `https://polymarket.com/_next/data/${buildId}/leaderboard.json`;
    
    const response = await fetch(dataUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Polymarket leaderboard data returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // The leaderboard data is in pageProps.dehydratedState.queries
    // Query index 1 is the profit leaderboard (sorted by PnL)
    const queries = data?.pageProps?.dehydratedState?.queries || [];
    
    // Find the profit leaderboard query (sorted by pnl)
    const profitQuery = queries.find((q: any) => 
      q.queryKey?.[0] === '/leaderboard' && q.queryKey?.[1] === 'profit'
    );
    
    if (profitQuery?.state?.data) {
      return profitQuery.state.data.slice(0, limit);
    }
    
    // Fallback to volume leaderboard if profit not found
    const volumeQuery = queries.find((q: any) => 
      q.queryKey?.[0] === '/leaderboard' && q.queryKey?.[1] === 'volume'
    );
    
    if (volumeQuery?.state?.data) {
      return volumeQuery.state.data.slice(0, limit);
    }
    
    console.error('Could not find leaderboard data in response');
    return [];
  } catch (error) {
    console.error('Error fetching Polymarket leaderboard:', error);
    return [];
  }
}

// GET /api/whales/leaderboard - Fetch top traders from Polymarket
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const minVolume = parseFloat(searchParams.get('minVolume') || '10000'); // $10k minimum
  const minPnl = parseFloat(searchParams.get('minPnl') || '0'); // Minimum profit

  try {
    // Fetch from Polymarket leaderboard
    const traders = await fetchPolymarketLeaderboard(limit);
    
    if (traders.length === 0) {
      console.warn('No traders returned from Polymarket - API may be unavailable');
    }
    
    // Transform Polymarket data to our whale format
    // Polymarket leaderboard format:
    // { rank, proxyWallet, name, pseudonym, amount, pnl, volume, profileImage }
    const whales = traders
      .filter((trader: any) => {
        const volume = trader.volume || 0;
        const pnl = trader.pnl || trader.amount || 0;
        
        return volume >= minVolume && pnl >= minPnl;
      })
      .map((trader: any) => ({
        address: trader.proxyWallet || '',
        username: trader.pseudonym || trader.name || null,
        volume: trader.volume || 0,
        pnl: trader.pnl || trader.amount || 0,
        rank: trader.rank || 0,
        profileImage: trader.profileImage || trader.profileImageOptimized || null,
        tier: calculateTier(trader.volume || 0, trader.pnl || 0),
      }));

    return NextResponse.json({
      success: true,
      count: whales.length,
      source: 'polymarket',
      filters: {
        minVolume,
        minPnl,
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
