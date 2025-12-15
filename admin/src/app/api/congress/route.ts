import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create supabase client only when needed (for POST handler)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Congressional data sources
// Note: Most free APIs have been shut down. We try multiple sources.
const CAPITOL_TRADES_API = 'https://bff.capitoltrades.com/trades';
// Unusual Whales Congress API (requires API key for full access)
const UNUSUAL_WHALES_API = 'https://api.unusualwhales.com/api/congress/trades';

interface CongressionalTrade {
  id: string;
  politician: string;
  chamber: 'house' | 'senate';
  party: string;
  state: string;
  ticker: string;
  assetName: string;
  transactionType: 'purchase' | 'sale' | 'exchange';
  transactionDate: string;
  disclosureDate: string;
  amountLow: number;
  amountHigh: number;
  amountEstimated: number;
  source: string;
  disclosureUrl?: string;
}

// Sample data to show when APIs are unavailable
// Based on real congressional trading patterns
function getSampleTrades(): CongressionalTrade[] {
  const now = new Date();
  const getDate = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };
  
  return [
    {
      id: 'sample-1',
      politician: 'Nancy Pelosi',
      chamber: 'house',
      party: 'Democrat',
      state: 'CA',
      ticker: 'NVDA',
      assetName: 'NVIDIA Corporation',
      transactionType: 'purchase',
      transactionDate: getDate(5),
      disclosureDate: getDate(2),
      amountLow: 500001,
      amountHigh: 1000000,
      amountEstimated: 750000,
      source: 'sample_data',
    },
    {
      id: 'sample-2',
      politician: 'Tommy Tuberville',
      chamber: 'senate',
      party: 'Republican',
      state: 'AL',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      transactionType: 'purchase',
      transactionDate: getDate(7),
      disclosureDate: getDate(3),
      amountLow: 100001,
      amountHigh: 250000,
      amountEstimated: 175000,
      source: 'sample_data',
    },
    {
      id: 'sample-3',
      politician: 'Dan Crenshaw',
      chamber: 'house',
      party: 'Republican',
      state: 'TX',
      ticker: 'TSLA',
      assetName: 'Tesla Inc.',
      transactionType: 'sale',
      transactionDate: getDate(10),
      disclosureDate: getDate(5),
      amountLow: 50001,
      amountHigh: 100000,
      amountEstimated: 75000,
      source: 'sample_data',
    },
    {
      id: 'sample-4',
      politician: 'Ro Khanna',
      chamber: 'house',
      party: 'Democrat',
      state: 'CA',
      ticker: 'MSFT',
      assetName: 'Microsoft Corporation',
      transactionType: 'purchase',
      transactionDate: getDate(12),
      disclosureDate: getDate(6),
      amountLow: 15001,
      amountHigh: 50000,
      amountEstimated: 32500,
      source: 'sample_data',
    },
    {
      id: 'sample-5',
      politician: 'Mark Warner',
      chamber: 'senate',
      party: 'Democrat',
      state: 'VA',
      ticker: 'GOOGL',
      assetName: 'Alphabet Inc.',
      transactionType: 'purchase',
      transactionDate: getDate(15),
      disclosureDate: getDate(8),
      amountLow: 250001,
      amountHigh: 500000,
      amountEstimated: 375000,
      source: 'sample_data',
    },
    {
      id: 'sample-6',
      politician: 'Josh Gottheimer',
      chamber: 'house',
      party: 'Democrat',
      state: 'NJ',
      ticker: 'META',
      assetName: 'Meta Platforms Inc.',
      transactionType: 'purchase',
      transactionDate: getDate(18),
      disclosureDate: getDate(10),
      amountLow: 1001,
      amountHigh: 15000,
      amountEstimated: 8000,
      source: 'sample_data',
    },
    {
      id: 'sample-7',
      politician: 'Marjorie Taylor Greene',
      chamber: 'house',
      party: 'Republican',
      state: 'GA',
      ticker: 'AMZN',
      assetName: 'Amazon.com Inc.',
      transactionType: 'sale',
      transactionDate: getDate(20),
      disclosureDate: getDate(12),
      amountLow: 15001,
      amountHigh: 50000,
      amountEstimated: 32500,
      source: 'sample_data',
    },
    {
      id: 'sample-8',
      politician: 'John Hickenlooper',
      chamber: 'senate',
      party: 'Democrat',
      state: 'CO',
      ticker: 'XOM',
      assetName: 'Exxon Mobil Corporation',
      transactionType: 'purchase',
      transactionDate: getDate(22),
      disclosureDate: getDate(14),
      amountLow: 50001,
      amountHigh: 100000,
      amountEstimated: 75000,
      source: 'sample_data',
    },
  ];
}

// Amount range mapping (Congress uses ranges, not exact amounts)
const AMOUNT_RANGES: Record<string, [number, number]> = {
  '$1,001 - $15,000': [1001, 15000],
  '$15,001 - $50,000': [15001, 50000],
  '$50,001 - $100,000': [50001, 100000],
  '$100,001 - $250,000': [100001, 250000],
  '$250,001 - $500,000': [250001, 500000],
  '$500,001 - $1,000,000': [500001, 1000000],
  '$1,000,001 - $5,000,000': [1000001, 5000000],
  '$5,000,001 - $25,000,000': [5000001, 25000000],
  '$25,000,001 - $50,000,000': [25000001, 50000000],
  'Over $50,000,000': [50000000, 100000000],
};

function parseAmountRange(amount: string): { low: number; high: number; estimated: number } {
  // Handle Capitol Trades format (direct numbers)
  if (typeof amount === 'number') {
    return { low: amount, high: amount, estimated: amount };
  }
  
  const range = AMOUNT_RANGES[amount];
  if (range) {
    return {
      low: range[0],
      high: range[1],
      estimated: (range[0] + range[1]) / 2,
    };
  }
  
  // Try to parse numbers from string
  const numbers = amount?.match(/[\d,]+/g);
  if (numbers && numbers.length >= 2) {
    const low = parseInt(numbers[0].replace(/,/g, ''), 10);
    const high = parseInt(numbers[1].replace(/,/g, ''), 10);
    return { low, high, estimated: (low + high) / 2 };
  }
  
  return { low: 0, high: 0, estimated: 0 };
}

function generateTradeId(trade: any, chamber: string): string {
  const politician = (trade.representative || trade.senator || trade.politician?.name || '').trim();
  const ticker = trade.ticker || trade.asset?.ticker || '';
  const date = trade.transaction_date || trade.txDate || '';
  return `${chamber}-${politician}-${ticker}-${date}`.replace(/[^a-zA-Z0-9-]/g, '_');
}

// Fetch from Capitol Trades API (primary source)
async function fetchCapitolTrades(limit: number): Promise<CongressionalTrade[]> {
  try {
    const response = await fetch(`${CAPITOL_TRADES_API}?pageSize=${Math.min(limit, 100)}&sortBy=-txDate`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; PolyBot/1.0)',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`Capitol Trades API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const trades = data.data || data;
    
    if (!Array.isArray(trades)) {
      console.error('Capitol Trades returned unexpected format');
      return [];
    }
    
    return trades.map((trade: any): CongressionalTrade => {
      const amounts = parseAmountRange(trade.value || trade.amount || '');
      const politician = trade.politician || {};
      const asset = trade.asset || {};
      
      const chamberValue = (politician.chamber || '').toLowerCase();
      
      return {
        id: generateTradeId(trade, politician.chamber || 'unknown'),
        politician: politician.name || (politician.firstName + ' ' + politician.lastName) || 'Unknown',
        chamber: chamberValue === 'senate' ? 'senate' : 'house',
        party: politician.party || 'Unknown',
        state: politician.state || '',
        ticker: (asset.ticker || trade.ticker || '').toUpperCase(),
        assetName: asset.name || trade.assetDescription || '',
        transactionType: (trade.txType || trade.type || '').toLowerCase().includes('sale') ? 'sale' : 
                        (trade.txType || trade.type || '').toLowerCase().includes('exchange') ? 'exchange' : 'purchase',
        transactionDate: trade.txDate || trade.transactionDate || '',
        disclosureDate: trade.filingDate || trade.disclosureDate || '',
        amountLow: amounts.low,
        amountHigh: amounts.high,
        amountEstimated: amounts.estimated,
        source: 'capitol_trades',
        disclosureUrl: trade.filingUrl || '',
      };
    }).filter((t) => t.ticker && t.politician);
  } catch (error) {
    console.error('Error fetching Capitol Trades:', error);
    return [];
  }
}

// GET /api/congress - Fetch congressional trades
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chamber = searchParams.get('chamber') || 'both'; // house, senate, both
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const party = searchParams.get('party'); // D, R, I
  const politician = searchParams.get('politician'); // Filter by name

  try {
    let trades: CongressionalTrade[] = [];
    let usingSampleData = false;

    // Try Capitol Trades API first (primary source with fresh data)
    const capitolTrades = await fetchCapitolTrades(limit);
    
    if (capitolTrades.length > 0) {
      // Filter by chamber if needed
      trades = chamber === 'both' 
        ? capitolTrades 
        : capitolTrades.filter(t => t.chamber === chamber);
    } else {
      // Use sample data as fallback when APIs are unavailable
      console.log('All APIs unavailable, using sample data');
      usingSampleData = true;
      const sampleTrades = getSampleTrades();
      
      // Filter by chamber if needed
      trades = chamber === 'both' 
        ? sampleTrades 
        : sampleTrades.filter(t => t.chamber === chamber);
    }

    // Apply filters
    let filtered = trades;

    if (party) {
      filtered = filtered.filter(t => 
        t.party.toUpperCase().startsWith(party.toUpperCase())
      );
    }

    if (politician) {
      const searchTerm = politician.toLowerCase();
      filtered = filtered.filter(t => 
        t.politician.toLowerCase().includes(searchTerm)
      );
    }

    // Sort by disclosure date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.disclosureDate || a.transactionDate || 0).getTime();
      const dateB = new Date(b.disclosureDate || b.transactionDate || 0).getTime();
      return dateB - dateA;
    });

    // Limit results
    const results = filtered.slice(0, limit);

    // Calculate stats
    const purchases = results.filter(t => t.transactionType === 'purchase').length;
    const sales = results.filter(t => t.transactionType === 'sale').length;
    const topPoliticians = Object.entries(
      results.reduce((acc: Record<string, number>, t) => {
        acc[t.politician] = (acc[t.politician] || 0) + 1;
        return acc;
      }, {})
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const topTickers = Object.entries(
      results.reduce((acc: Record<string, number>, t) => {
        acc[t.ticker] = (acc[t.ticker] || 0) + 1;
        return acc;
      }, {})
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ticker, count]) => ({ ticker, count }));

    return NextResponse.json({
      success: true,
      count: results.length,
      usingSampleData,
      filters: { chamber, party, politician },
      stats: {
        purchases,
        sales,
        totalVolume: results.reduce((sum, t) => sum + t.amountEstimated, 0),
        topPoliticians,
        topTickers,
      },
      data: results,
      ...(usingSampleData && {
        notice: 'Using sample data. Free congressional trading APIs (House Stock Watcher, Senate Stock Watcher) have been restricted. For live data, consider Unusual Whales or Quiver Quant paid APIs.'
      }),
    });
  } catch (error) {
    console.error('Error in congressional trades API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch congressional trades',
        data: [],
      },
      { status: 500 }
    );
  }
}

// GET tracked politicians from database
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'getTracked') {
      const { data, error } = await getSupabaseClient()
        .from('polybot_tracked_politicians')
        .select('*')
        .order('total_pnl_usd', { ascending: false });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data || [],
      });
    }

    if (action === 'toggleTracking') {
      const { politician, enabled, settings } = body;
      
      if (enabled) {
        // Add or update tracking
        const { error } = await getSupabaseClient()
          .from('polybot_tracked_politicians')
          .upsert({
            name: politician.name,
            chamber: politician.chamber,
            party: politician.party,
            state: politician.state,
            copy_enabled: settings?.copyEnabled || false,
            copy_scale_pct: settings?.copyScale || 10,
            max_copy_size_usd: settings?.maxCopySize || 1000,
          }, { onConflict: 'name' });

        if (error) throw error;
      } else {
        // Remove tracking
        const { error } = await getSupabaseClient()
          .from('polybot_tracked_politicians')
          .delete()
          .eq('name', politician.name);

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error in congressional POST:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    );
  }
}
