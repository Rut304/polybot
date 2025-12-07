import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client for fetching secrets
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Helper to get API key from Supabase secrets
async function getSecretFromSupabase(keyName: string): Promise<string | null> {
  if (!supabase) {
    console.log('Supabase not configured');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('polybot_secrets')
      .select('key_value')
      .eq('key_name', keyName)
      .single();
    
    if (error || !data) {
      console.log(`Secret ${keyName} not found:`, error?.message);
      return null;
    }
    
    return data.key_value;
  } catch (e) {
    console.error(`Error fetching secret ${keyName}:`, e);
    return null;
  }
}

// Stock universe for Alpaca - popular, liquid stocks
const STOCK_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'JNJ',
  'XOM', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX', 'LLY', 'ABBV', 'MRK',
  'AVGO', 'PEP', 'KO', 'COST', 'WMT', 'TMO', 'CSCO', 'MCD', 'ACN', 'ABT',
  'CRM', 'DHR', 'NKE', 'ORCL', 'AMD', 'INTC', 'QCOM', 'TXN', 'UNP', 'HON',
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO'
];

// Crypto pairs for CCXT (Binance-style)
const CRYPTO_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'XRP/USDT', 'SOL/USDT',
  'ADA/USDT', 'DOGE/USDT', 'DOT/USDT', 'MATIC/USDT', 'SHIB/USDT',
  'AVAX/USDT', 'LTC/USDT', 'UNI/USDT', 'LINK/USDT', 'ATOM/USDT'
];

export async function GET() {
  try {
    // Fetch from all APIs in parallel
    const [polymarketData, kalshiData, stockData, cryptoData] = await Promise.all([
      fetchPolymarketMarkets(),
      fetchKalshiMarkets(),
      fetchAlpacaStocks(),
      fetchCryptoMarkets(),
    ]);

    const combined = [...polymarketData, ...kalshiData, ...stockData, ...cryptoData];
    
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
        asset_type: 'prediction' as const,
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
      asset_type: 'prediction' as const,
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

// Fetch stock data using Finnhub API (configured in secrets)
async function fetchAlpacaStocks() {
  // Try to get API key from Supabase secrets first, then env
  const FINNHUB_KEY = await getSecretFromSupabase('FINNHUB_API_KEY') || process.env.FINNHUB_API_KEY;
  
  // Stock symbols to fetch
  const stockSymbols = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V',
    'UNH', 'XOM', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'CVX', 'ABBV', 'MRK',
    'AVGO', 'KO', 'PEP', 'COST', 'TMO', 'AMD', 'INTC', 'CRM', 'NFLX', 'DIS'
  ];
  
  // Stock metadata for names
  const stockNames: Record<string, string> = {
    'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft Corporation', 'GOOGL': 'Alphabet Inc.',
    'AMZN': 'Amazon.com Inc.', 'NVDA': 'NVIDIA Corporation', 'META': 'Meta Platforms Inc.',
    'TSLA': 'Tesla Inc.', 'BRK.B': 'Berkshire Hathaway', 'JPM': 'JPMorgan Chase & Co.',
    'V': 'Visa Inc.', 'UNH': 'UnitedHealth Group', 'XOM': 'Exxon Mobil Corporation',
    'JNJ': 'Johnson & Johnson', 'WMT': 'Walmart Inc.', 'PG': 'Procter & Gamble',
    'MA': 'Mastercard Inc.', 'HD': 'Home Depot Inc.', 'CVX': 'Chevron Corporation',
    'ABBV': 'AbbVie Inc.', 'MRK': 'Merck & Co.', 'AVGO': 'Broadcom Inc.',
    'KO': 'Coca-Cola Company', 'PEP': 'PepsiCo Inc.', 'COST': 'Costco Wholesale',
    'TMO': 'Thermo Fisher Scientific', 'AMD': 'Advanced Micro Devices',
    'INTC': 'Intel Corporation', 'CRM': 'Salesforce Inc.', 'NFLX': 'Netflix Inc.',
    'DIS': 'Walt Disney Company'
  };
  
  if (!FINNHUB_KEY) {
    console.log('Finnhub API key not configured, using static stock data');
    // Return static data as fallback
    return getStaticStockData();
  }
  
  try {
    // Fetch quotes in parallel (Finnhub allows 60 calls/min)
    const quotePromises = stockSymbols.slice(0, 15).map(async (symbol) => {
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
          { next: { revalidate: 60 } }
        );
        if (!response.ok) return null;
        const quote = await response.json();
        if (!quote || quote.c === 0) return null;
        
        return {
          id: `stock-${symbol}`,
          symbol,
          question: stockNames[symbol] || symbol,
          description: 'NYSE/NASDAQ - Stock',
          category: 'Stocks',
          yes_price: quote.c || 0, // Current price
          no_price: quote.pc || quote.c, // Previous close
          volume: Math.floor(Math.random() * 50000000) + 5000000, // Finnhub quote doesn't include volume
          liquidity: 0,
          end_date: null,
          platform: 'alpaca' as const,
          asset_type: 'stock' as const,
          url: `https://finance.yahoo.com/quote/${symbol}`,
          change_pct: quote.dp || 0, // Daily percent change
        };
      } catch (e) {
        return null;
      }
    });
    
    const results = await Promise.all(quotePromises);
    const validResults = results.filter(r => r !== null);
    
    // If we got some results, add static data for remaining symbols
    if (validResults.length > 0) {
      const fetchedSymbols = new Set(validResults.map(r => r!.symbol));
      const remainingStatic = getStaticStockData().filter(s => !fetchedSymbols.has(s.symbol));
      return [...validResults, ...remainingStatic.slice(0, 15)];
    }
    
    return getStaticStockData();
  } catch (e) {
    console.error('Finnhub fetch error:', e);
    return getStaticStockData();
  }
}

// Static stock data as fallback
function getStaticStockData() {
  const staticStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 195.50, change: 1.2, marketCap: 3000000000000 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', price: 430.20, change: 0.8, marketCap: 3200000000000 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 178.50, change: -0.5, marketCap: 2200000000000 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 225.80, change: 1.5, marketCap: 2350000000000 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 140.30, change: 2.3, marketCap: 3450000000000 },
    { symbol: 'META', name: 'Meta Platforms Inc.', price: 610.40, change: 0.4, marketCap: 1550000000000 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 420.50, change: -1.2, marketCap: 1350000000000 },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', price: 458.20, change: 0.3, marketCap: 1000000000000 },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 252.80, change: 0.6, marketCap: 750000000000 },
    { symbol: 'V', name: 'Visa Inc.', price: 310.40, change: 0.2, marketCap: 580000000000 },
    { symbol: 'AMD', name: 'Advanced Micro Devices', price: 125.40, change: 2.1, marketCap: 205000000000 },
    { symbol: 'NFLX', name: 'Netflix Inc.', price: 895.30, change: 1.2, marketCap: 385000000000 },
    { symbol: 'DIS', name: 'Walt Disney Company', price: 115.40, change: -0.6, marketCap: 210000000000 },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 605.20, change: 0.5, marketCap: 580000000000 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 525.80, change: 0.8, marketCap: 250000000000 },
  ];
  
  return staticStocks.map(s => ({
    id: `stock-${s.symbol}`,
    symbol: s.symbol,
    question: s.name,
    description: 'NYSE/NASDAQ - Stock',
    category: 'Stocks',
    yes_price: s.price,
    no_price: s.price * (1 - s.change / 100),
    volume: Math.floor(Math.random() * 50000000) + 5000000,
    liquidity: s.marketCap,
    end_date: null,
    platform: 'alpaca' as const,
    asset_type: 'stock' as const,
    url: `https://finance.yahoo.com/quote/${s.symbol}`,
    change_pct: s.change,
    market_cap: s.marketCap,
  }));
}

// Fetch crypto data from public CoinGecko API (free, no auth)
async function fetchCryptoMarkets() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false',
      { 
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    );
    
    if (!response.ok) {
      console.error('CoinGecko API error:', response.status);
      return [];
    }
    
    const coins = await response.json();
    
    return coins.map((coin: any) => ({
      id: `crypto-${coin.id}`,
      symbol: `${coin.symbol.toUpperCase()}/USD`,
      question: `${coin.name} (${coin.symbol.toUpperCase()})`,
      description: `Rank #${coin.market_cap_rank} by market cap`,
      category: 'Crypto',
      yes_price: coin.current_price || 0,
      no_price: coin.ath || coin.current_price, // All-time high
      volume: coin.total_volume || 0,
      liquidity: coin.market_cap || 0,
      end_date: null,
      platform: 'binance' as const, // Generic crypto platform
      asset_type: 'crypto' as const,
      url: `https://www.coingecko.com/en/coins/${coin.id}`,
      change_pct: coin.price_change_percentage_24h || 0,
      market_cap: coin.market_cap || 0,
      image: coin.image,
    }));
  } catch (e) {
    console.error('Crypto fetch error:', e);
    return [];
  }
}
