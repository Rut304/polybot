import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client with service role for fetching user credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// IBKR Web API base URL
const IBKR_API_BASE = 'https://api.ibkr.com/v1/api';

interface IBKRQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: string;
  source: 'ibkr';
}

interface AlpacaQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: string;
  source: 'alpaca';
}

// Get user's IBKR credentials from database
async function getIBKRCredentials(userId: string) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_exchange_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('exchange', 'ibkr')
      .single();
    
    if (error || !data) return null;
    
    // Decrypt tokens (base64 for now - production should use real encryption)
    const accessToken = data.access_token 
      ? Buffer.from(data.access_token, 'base64').toString()
      : null;
    
    return {
      accessToken,
      accountId: data.account_id,
      isPaper: data.is_paper,
    };
  } catch (e) {
    console.error('Error fetching IBKR credentials:', e);
    return null;
  }
}

// Get Alpaca credentials from secrets table
async function getAlpacaCredentials() {
  if (!supabase) return null;
  
  try {
    const { data: keys } = await supabase
      .from('polybot_secrets')
      .select('key_name, key_value')
      .in('key_name', ['ALPACA_PAPER_API_KEY', 'ALPACA_PAPER_API_SECRET']);
    
    if (!keys || keys.length < 2) return null;
    
    const apiKey = keys.find(k => k.key_name === 'ALPACA_PAPER_API_KEY')?.key_value;
    const apiSecret = keys.find(k => k.key_name === 'ALPACA_PAPER_API_SECRET')?.key_value;
    
    return apiKey && apiSecret ? { apiKey, apiSecret } : null;
  } catch (e) {
    console.error('Error fetching Alpaca credentials:', e);
    return null;
  }
}

// Search for IBKR contract by symbol
async function searchIBKRContract(symbol: string, accessToken: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${IBKR_API_BASE}/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].conid;
    }
    return null;
  } catch (e) {
    console.error('Error searching IBKR contract:', e);
    return null;
  }
}

// Get IBKR market data snapshot
async function getIBKRQuote(symbol: string, accessToken: string): Promise<IBKRQuote | null> {
  try {
    const conid = await searchIBKRContract(symbol, accessToken);
    if (!conid) return null;
    
    // First request initializes the stream
    await fetch(
      `${IBKR_API_BASE}/iserver/marketdata/snapshot?conids=${conid}&fields=31,84,85,86,88`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    // Wait briefly for data
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Second request gets actual data
    const response = await fetch(
      `${IBKR_API_BASE}/iserver/marketdata/snapshot?conids=${conid}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const quote = data[0];
      return {
        symbol,
        bid: parseFloat(quote['84'] || '0'),      // Bid price
        ask: parseFloat(quote['86'] || '0'),      // Ask price
        last: parseFloat(quote['31'] || '0'),     // Last price
        change: parseFloat(quote['82'] || '0'),   // Change
        changePct: parseFloat(quote['83'] || '0'), // Change %
        volume: parseInt(quote['87'] || '0'),      // Volume
        timestamp: new Date().toISOString(),
        source: 'ibkr',
      };
    }
    return null;
  } catch (e) {
    console.error('Error fetching IBKR quote:', e);
    return null;
  }
}

// Get Alpaca quote as fallback
async function getAlpacaQuote(symbol: string, apiKey: string, apiSecret: string): Promise<AlpacaQuote | null> {
  try {
    // Get latest trade
    const tradeResponse = await fetch(
      `https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`,
      {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
        },
      }
    );
    
    // Get latest quote (bid/ask)
    const quoteResponse = await fetch(
      `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
      {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
        },
      }
    );
    
    // Get previous close for change calculation
    const barsResponse = await fetch(
      `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&limit=2`,
      {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
        },
      }
    );
    
    if (!tradeResponse.ok || !quoteResponse.ok) return null;
    
    const tradeData = await tradeResponse.json();
    const quoteData = await quoteResponse.json();
    const barsData = barsResponse.ok ? await barsResponse.json() : null;
    
    const lastPrice = tradeData.trade?.p || 0;
    const prevClose = barsData?.bars?.[0]?.c || lastPrice;
    const change = lastPrice - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    
    return {
      symbol,
      bid: quoteData.quote?.bp || lastPrice,
      ask: quoteData.quote?.ap || lastPrice,
      last: lastPrice,
      change,
      changePct,
      volume: tradeData.trade?.s || 0,
      timestamp: tradeData.trade?.t || new Date().toISOString(),
      source: 'alpaca',
    };
  } catch (e) {
    console.error('Error fetching Alpaca quote:', e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const userId = searchParams.get('userId');
    const preferIBKR = searchParams.get('preferIBKR') !== 'false';
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }
    
    let ibkrQuote: IBKRQuote | null = null;
    let alpacaQuote: AlpacaQuote | null = null;
    
    // Try IBKR first if user has credentials and prefers it
    if (userId && preferIBKR) {
      const ibkrCreds = await getIBKRCredentials(userId);
      if (ibkrCreds?.accessToken) {
        ibkrQuote = await getIBKRQuote(symbol, ibkrCreds.accessToken);
      }
    }
    
    // Always try to get Alpaca quote as fallback/comparison
    const alpacaCreds = await getAlpacaCredentials();
    if (alpacaCreds) {
      alpacaQuote = await getAlpacaQuote(symbol, alpacaCreds.apiKey, alpacaCreds.apiSecret);
    }
    
    // Return best available quote with both if available
    const primaryQuote = ibkrQuote || alpacaQuote;
    
    if (!primaryQuote) {
      return NextResponse.json({ 
        error: 'No quote available',
        symbol,
      }, { status: 404 });
    }
    
    return NextResponse.json({
      primary: primaryQuote,
      ibkr: ibkrQuote,
      alpaca: alpacaQuote,
      hasIBKR: !!ibkrQuote,
      hasAlpaca: !!alpacaQuote,
    });
    
  } catch (error) {
    console.error('Quote API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch quote',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
