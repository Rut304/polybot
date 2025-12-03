import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch from both APIs in parallel - get more markets
    const [polymarketData, kalshiData] = await Promise.all([
      fetchPolymarketMarkets(),
      fetchKalshiMarkets(),
    ]);

    const combined = [...polymarketData, ...kalshiData];
    
    // Sort by volume (most liquid first)
    combined.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    
    return NextResponse.json({
      markets: combined,
      total: combined.length,
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json({ markets: [], total: 0, error: 'Failed to fetch markets' }, { status: 500 });
  }
}

async function fetchPolymarketMarkets() {
  try {
    // Fetch multiple pages to get more markets
    const allMarkets: any[] = [];
    let offset = 0;
    const limit = 500;
    const maxPages = 4; // Up to 2000 markets
    
    for (let page = 0; page < maxPages; page++) {
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&closed=false&active=true`,
        { 
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 60 }
        }
      );
      
      if (!response.ok) {
        console.error('Polymarket API error:', response.status);
        break;
      }
      
      const data = await response.json();
      if (!data || data.length === 0) break;
      
      allMarkets.push(...data);
      offset += limit;
      
      // If we got fewer than requested, we've reached the end
      if (data.length < limit) break;
    }
    
    // Filter to only include markets that are truly open
    const activeMarkets = allMarkets.filter((m: any) => !m.closed && m.active);
    
    return activeMarkets.map((m: any) => {
      let yesPrice = 0.5;
      let noPrice = 0.5;
      
      try {
        if (m.outcomePrices) {
          const prices = JSON.parse(m.outcomePrices);
          yesPrice = parseFloat(prices[0]) || 0.5;
          noPrice = parseFloat(prices[1]) || 0.5;
        } else if (m.bestAsk) {
          yesPrice = parseFloat(m.bestAsk);
          noPrice = 1 - yesPrice;
        }
      } catch (e) {
        // Use defaults
      }

      return {
        id: m.conditionId || m.condition_id || m.id,
        question: m.question || m.title,
        description: m.description,
        category: inferCategory(m.question || m.title || ''),
        yes_price: yesPrice,
        no_price: noPrice,
        volume: parseFloat(m.volume || m.volumeNum || '0'),
        liquidity: parseFloat(m.liquidity || m.liquidityNum || '0'),
        end_date: m.endDate || m.end_date_iso,
        platform: 'polymarket' as const,
        url: `https://polymarket.com/event/${m.slug || m.conditionId || m.id}`,
      };
    });
  } catch (e) {
    console.error('Polymarket fetch error:', e);
    return [];
  }
}

async function fetchKalshiMarkets() {
  try {
    // Fetch multiple pages using cursor pagination
    const allMarkets: any[] = [];
    let cursor: string | undefined;
    const limit = 500;
    const maxPages = 4; // Up to 2000 markets
    
    for (let page = 0; page < maxPages; page++) {
      // Note: Kalshi API doesn't accept status=active filter, we filter client-side
      const url = cursor 
        ? `https://api.elections.kalshi.com/trade-api/v2/markets?limit=${limit}&cursor=${cursor}`
        : `https://api.elections.kalshi.com/trade-api/v2/markets?limit=${limit}`;
      
      const response = await fetch(url, { 
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      });
      
      if (!response.ok) {
        console.error('Kalshi API error:', response.status);
        break;
      }
      
      const data = await response.json();
      if (!data.markets || data.markets.length === 0) break;
      
      allMarkets.push(...data.markets);
      cursor = data.cursor;
      
      // If no cursor or fewer than requested, we've reached the end
      if (!cursor || data.markets.length < limit) break;
    }
    
    // Filter to only active markets (since API doesn't support status filter)
    const activeMarkets = allMarkets.filter((m: any) => m.status === 'active');
    
    return activeMarkets.map((m: any) => ({
      id: m.ticker,
      question: m.title || m.subtitle,
      description: m.rules_primary,
      category: inferCategory(m.title || m.subtitle || ''),
      yes_price: (m.yes_bid || m.last_price || 50) / 100,
      no_price: (m.no_bid || (100 - (m.last_price || 50))) / 100,
      volume: m.volume || 0,
      liquidity: (m.liquidity || m.open_interest || 0) / 100,
      end_date: m.close_time || m.expiration_time,
      platform: 'kalshi' as const,
      url: `https://kalshi.com/markets/${m.ticker}`,
    }));
  } catch (e) {
    console.error('Kalshi fetch error:', e);
    return [];
  }
}

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president') || lower.includes('congress') || lower.includes('senate') || lower.includes('governor')) {
    return 'Politics';
  }
  if (lower.includes('bitcoin') || lower.includes('ethereum') || lower.includes('crypto') || lower.includes('btc') || lower.includes('eth')) {
    return 'Crypto';
  }
  if (lower.includes('nfl') || lower.includes('nba') || lower.includes('mlb') || lower.includes('super bowl') || lower.includes('world cup') || lower.includes('playoffs')) {
    return 'Sports';
  }
  if (lower.includes('fed') || lower.includes('interest rate') || lower.includes('gdp') || lower.includes('inflation') || lower.includes('stock') || lower.includes('s&p')) {
    return 'Finance';
  }
  if (lower.includes('oscar') || lower.includes('grammy') || lower.includes('movie') || lower.includes('album') || lower.includes('celebrity')) {
    return 'Entertainment';
  }
  if (lower.includes('ai') || lower.includes('spacex') || lower.includes('nasa') || lower.includes('climate') || lower.includes('vaccine')) {
    return 'Science';
  }
  return 'Other';
}
