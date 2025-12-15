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

// Congressional data sources (all free)
const HOUSE_API = 'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json';
const SENATE_API = 'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json';

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
  const range = AMOUNT_RANGES[amount];
  if (range) {
    return {
      low: range[0],
      high: range[1],
      estimated: (range[0] + range[1]) / 2,
    };
  }
  return { low: 0, high: 0, estimated: 0 };
}

function generateTradeId(trade: any, chamber: string): string {
  const politician = (trade.representative || trade.senator || '').trim();
  const ticker = trade.ticker || '';
  const date = trade.transaction_date || '';
  return `${chamber}-${politician}-${ticker}-${date}`.replace(/[^a-zA-Z0-9-]/g, '_');
}

async function fetchHouseTrades(limit: number): Promise<CongressionalTrade[]> {
  try {
    const response = await fetch(HOUSE_API, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`House API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // House data is an array of transactions
    const trades: CongressionalTrade[] = data
      .slice(0, limit)
      .map((trade: any) => {
        const amounts = parseAmountRange(trade.amount || '');
        return {
          id: generateTradeId(trade, 'house'),
          politician: (trade.representative || '').trim(),
          chamber: 'house' as const,
          party: trade.party || 'Unknown',
          state: trade.state || '',
          ticker: (trade.ticker || '').toUpperCase(),
          assetName: trade.asset_description || '',
          transactionType: (trade.type || '').toLowerCase().includes('sale') ? 'sale' : 'purchase',
          transactionDate: trade.transaction_date || '',
          disclosureDate: trade.disclosure_date || '',
          amountLow: amounts.low,
          amountHigh: amounts.high,
          amountEstimated: amounts.estimated,
          source: 'house_stock_watcher',
          disclosureUrl: trade.ptr_link || '',
        };
      })
      .filter((t: CongressionalTrade) => t.ticker && t.politician);

    return trades;
  } catch (error) {
    console.error('Error fetching House trades:', error);
    return [];
  }
}

async function fetchSenateTrades(limit: number): Promise<CongressionalTrade[]> {
  try {
    const response = await fetch(SENATE_API, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`Senate API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Senate data is an array of transactions
    const trades: CongressionalTrade[] = data
      .slice(0, limit)
      .map((trade: any) => {
        const amounts = parseAmountRange(trade.amount || '');
        return {
          id: generateTradeId(trade, 'senate'),
          politician: (trade.senator || '').trim(),
          chamber: 'senate' as const,
          party: trade.party || 'Unknown',
          state: trade.state || '',
          ticker: (trade.ticker || '').toUpperCase(),
          assetName: trade.asset_description || '',
          transactionType: (trade.type || '').toLowerCase().includes('sale') ? 'sale' : 'purchase',
          transactionDate: trade.transaction_date || '',
          disclosureDate: trade.disclosure_date || '',
          amountLow: amounts.low,
          amountHigh: amounts.high,
          amountEstimated: amounts.estimated,
          source: 'senate_stock_watcher',
          disclosureUrl: trade.ptr_link || '',
        };
      })
      .filter((t: CongressionalTrade) => t.ticker && t.politician);

    return trades;
  } catch (error) {
    console.error('Error fetching Senate trades:', error);
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
    const trades: CongressionalTrade[] = [];

    // Fetch from relevant chambers
    if (chamber === 'house' || chamber === 'both') {
      const houseTrades = await fetchHouseTrades(limit);
      trades.push(...houseTrades);
    }

    if (chamber === 'senate' || chamber === 'both') {
      const senateTrades = await fetchSenateTrades(limit);
      trades.push(...senateTrades);
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
      filters: { chamber, party, politician },
      stats: {
        purchases,
        sales,
        totalVolume: results.reduce((sum, t) => sum + t.amountEstimated, 0),
        topPoliticians,
        topTickers,
      },
      data: results,
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
