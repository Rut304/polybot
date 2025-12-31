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
// Note: Most free APIs have restrictions. We try multiple sources.
const CAPITOL_TRADES_API = 'https://bff.capitoltrades.com/trades';
// Quiver Quant API - free tier available with rate limiting
const QUIVER_QUANT_API = 'https://api.quiverquant.com/beta/live/congresstrading';
// House Stock Watcher API (free)
const HOUSE_STOCK_WATCHER_API = 'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json';
// Senate Stock Watcher API (free)
const SENATE_STOCK_WATCHER_API = 'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json';

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

// Fetch from House Stock Watcher (S3 bucket - free, public)
async function fetchHouseStockWatcher(limit: number): Promise<CongressionalTrade[]> {
  try {
    const response = await fetch(HOUSE_STOCK_WATCHER_API, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`House Stock Watcher returned ${response.status}`);
      return [];
    }

    const trades = await response.json();
    
    if (!Array.isArray(trades)) return [];
    
    // Sort by transaction date (newest first) and take limit
    const sorted = trades
      .sort((a: any, b: any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .slice(0, limit);
    
    return sorted.map((trade: any): CongressionalTrade => {
      const amounts = parseAmountRange(trade.amount || '');
      return {
        id: `house-${trade.representative}-${trade.ticker}-${trade.transaction_date}`.replace(/[^a-zA-Z0-9-]/g, '_'),
        politician: trade.representative || 'Unknown',
        chamber: 'house',
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
    }).filter((t) => t.ticker && t.politician);
  } catch (error) {
    console.error('Error fetching House Stock Watcher:', error);
    return [];
  }
}

// Fetch from Senate Stock Watcher (S3 bucket - free, public)
async function fetchSenateStockWatcher(limit: number): Promise<CongressionalTrade[]> {
  try {
    const response = await fetch(SENATE_STOCK_WATCHER_API, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`Senate Stock Watcher returned ${response.status}`);
      return [];
    }

    const trades = await response.json();
    
    if (!Array.isArray(trades)) return [];
    
    // Sort by transaction date (newest first) and take limit
    const sorted = trades
      .sort((a: any, b: any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .slice(0, limit);
    
    return sorted.map((trade: any): CongressionalTrade => {
      const amounts = parseAmountRange(trade.amount || '');
      return {
        id: `senate-${trade.senator}-${trade.ticker}-${trade.transaction_date}`.replace(/[^a-zA-Z0-9-]/g, '_'),
        politician: trade.senator || 'Unknown',
        chamber: 'senate',
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
    }).filter((t) => t.ticker && t.politician);
  } catch (error) {
    console.error('Error fetching Senate Stock Watcher:', error);
    return [];
  }
}

// Fetch from Quiver Quant (free tier with rate limits)
async function fetchQuiverQuant(limit: number): Promise<CongressionalTrade[]> {
  const apiKey = process.env.QUIVER_QUANT_API_KEY;
  
  // Quiver Quant requires API key but has a free tier
  if (!apiKey) {
    console.log('Quiver Quant API key not configured, skipping...');
    return [];
  }
  
  try {
    const response = await fetch(`${QUIVER_QUANT_API}?limit=${limit}`, {
      headers: { 
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error(`Quiver Quant returned ${response.status}`);
      return [];
    }

    const trades = await response.json();
    
    if (!Array.isArray(trades)) return [];
    
    return trades.map((trade: any): CongressionalTrade => {
      const amounts = parseAmountRange(trade.Range || '');
      return {
        id: `quiver-${trade.Representative}-${trade.Ticker}-${trade.TransactionDate}`.replace(/[^a-zA-Z0-9-]/g, '_'),
        politician: trade.Representative || 'Unknown',
        chamber: (trade.House || '').toLowerCase() === 'senate' ? 'senate' : 'house',
        party: trade.Party === 'R' ? 'Republican' : trade.Party === 'D' ? 'Democrat' : 'Independent',
        state: '',
        ticker: (trade.Ticker || '').toUpperCase(),
        assetName: trade.Description || '',
        transactionType: (trade.Transaction || '').toLowerCase().includes('sale') ? 'sale' : 'purchase',
        transactionDate: trade.TransactionDate || '',
        disclosureDate: trade.ReportDate || '',
        amountLow: amounts.low,
        amountHigh: amounts.high,
        amountEstimated: amounts.estimated,
        source: 'quiver_quant',
      };
    }).filter((t) => t.ticker && t.politician);
  } catch (error) {
    console.error('Error fetching Quiver Quant:', error);
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
    let dataSource = 'unknown';

    // Try multiple data sources in order of preference
    // 1. House/Senate Stock Watcher (free, public S3 buckets)
    // 2. Capitol Trades API (may have rate limits)
    // 3. Quiver Quant (if API key configured)
    // 4. Sample data (fallback)

    // Fetch from both House and Senate Stock Watcher in parallel
    const [houseTrades, senateTrades] = await Promise.all([
      fetchHouseStockWatcher(limit),
      fetchSenateStockWatcher(limit),
    ]);

    if (houseTrades.length > 0 || senateTrades.length > 0) {
      dataSource = 'stock_watcher';
      trades = [...houseTrades, ...senateTrades];
      console.log(`Loaded ${trades.length} trades from Stock Watcher APIs`);
    }

    // If Stock Watcher failed, try Capitol Trades
    if (trades.length === 0) {
      const capitolTrades = await fetchCapitolTrades(limit);
      if (capitolTrades.length > 0) {
        dataSource = 'capitol_trades';
        trades = capitolTrades;
        console.log(`Loaded ${trades.length} trades from Capitol Trades`);
      }
    }

    // If still no data, try Quiver Quant
    if (trades.length === 0) {
      const quiverTrades = await fetchQuiverQuant(limit);
      if (quiverTrades.length > 0) {
        dataSource = 'quiver_quant';
        trades = quiverTrades;
        console.log(`Loaded ${trades.length} trades from Quiver Quant`);
      }
    }

    // Last resort: sample data
    if (trades.length === 0) {
      console.log('All APIs unavailable, using sample data');
      usingSampleData = true;
      dataSource = 'sample_data';
      trades = getSampleTrades();
    }

    // Filter by chamber if needed
    if (chamber !== 'both') {
      trades = trades.filter(t => t.chamber === chamber);
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
      dataSource,
      data: results,
      ...(usingSampleData && {
        notice: 'Using sample data. Congressional trading APIs are temporarily unavailable. Data shown is illustrative.'
      }),
      ...(!usingSampleData && {
        notice: `Live data from ${dataSource.replace('_', ' ')}. Updated within the last hour.`
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
