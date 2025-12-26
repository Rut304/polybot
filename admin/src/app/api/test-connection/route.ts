import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
};

export async function POST(req: NextRequest) {
  try {
    const { platform, userId } = await req.json();
    
    if (!platform || !userId) {
      return NextResponse.json({ error: 'Missing platform or userId' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    // Get the secrets for this platform
    const { data: secrets, error: secretsError } = await supabase
      .from('polybot_secrets')
      .select('key_name, key_value')
      .eq('user_id', userId);
    
    if (secretsError) {
      console.error('Error fetching secrets:', secretsError);
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
    }
    
    // Map secrets to a lookup object
    const secretsMap: Record<string, string> = {};
    secrets?.forEach(s => {
      if (s.key_value) {
        secretsMap[s.key_name] = s.key_value;
      }
    });
    
    // Test based on platform
    let result: { connected: boolean; balance?: number; error?: string; details?: string };
    
    switch (platform.toLowerCase()) {
      case 'polymarket':
        result = await testPolymarket(secretsMap);
        break;
      case 'kalshi':
        result = await testKalshi(secretsMap);
        break;
      case 'alpaca':
        result = await testAlpaca(secretsMap);
        break;
      case 'binance':
        result = await testBinance(secretsMap);
        break;
      case 'coinbase':
        result = await testCoinbase(secretsMap);
        break;
      default:
        result = { connected: false, error: `Unknown platform: ${platform}` };
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Test connection error:', error);
    return NextResponse.json({ 
      connected: false, 
      error: error.message || 'Connection test failed' 
    }, { status: 500 });
  }
}

// Polymarket test - check if API key works
async function testPolymarket(secrets: Record<string, string>): Promise<{ connected: boolean; balance?: number; error?: string; details?: string }> {
  const apiKey = secrets['POLYMARKET_API_KEY'];
  const privateKey = secrets['POLYMARKET_PRIVATE_KEY'];
  
  if (!apiKey && !privateKey) {
    return { connected: false, error: 'No Polymarket credentials configured' };
  }
  
  try {
    // Polymarket uses the Polygon CLOB API
    // For now, just verify we have credentials set
    // Real balance check would require the py-clob-client library
    return { 
      connected: true, 
      details: 'Credentials configured. Balance check requires Python backend.' 
    };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

// Kalshi test
async function testKalshi(secrets: Record<string, string>): Promise<{ connected: boolean; balance?: number; error?: string; details?: string }> {
  const apiKey = secrets['KALSHI_API_KEY'];
  const privateKey = secrets['KALSHI_PRIVATE_KEY'];
  
  if (!apiKey) {
    return { connected: false, error: 'No Kalshi API key configured' };
  }
  
  try {
    // Kalshi API endpoint for account balance
    const response = await fetch('https://trading-api.kalshi.com/trade-api/v2/portfolio/balance', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        return { connected: false, error: 'Invalid API key' };
      }
      return { connected: false, error: `API error: ${response.status}` };
    }
    
    const data = await response.json();
    return { 
      connected: true, 
      balance: data.balance / 100, // Kalshi returns cents
      details: `Balance: $${(data.balance / 100).toFixed(2)}` 
    };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

// Alpaca test
async function testAlpaca(secrets: Record<string, string>): Promise<{ connected: boolean; balance?: number; error?: string; details?: string }> {
  const apiKey = secrets['ALPACA_API_KEY'];
  const apiSecret = secrets['ALPACA_SECRET_KEY'];
  
  if (!apiKey || !apiSecret) {
    return { connected: false, error: 'Missing Alpaca API key or secret' };
  }
  
  try {
    // Use paper trading API by default
    const baseUrl = secrets['ALPACA_BASE_URL'] || 'https://paper-api.alpaca.markets';
    
    const response = await fetch(`${baseUrl}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { connected: false, error: 'Invalid API credentials' };
      }
      return { connected: false, error: `API error: ${response.status}` };
    }
    
    const data = await response.json();
    return { 
      connected: true, 
      balance: parseFloat(data.portfolio_value),
      details: `Portfolio: $${parseFloat(data.portfolio_value).toLocaleString()} | Cash: $${parseFloat(data.cash).toLocaleString()}` 
    };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

// Binance test (US)
async function testBinance(secrets: Record<string, string>): Promise<{ connected: boolean; balance?: number; error?: string; details?: string }> {
  const apiKey = secrets['BINANCE_API_KEY'];
  const apiSecret = secrets['BINANCE_SECRET_KEY'];
  
  if (!apiKey || !apiSecret) {
    return { connected: false, error: 'Missing Binance API key or secret' };
  }
  
  try {
    // For Binance we need to sign the request - just verify key exists for now
    return { 
      connected: true, 
      details: 'Credentials configured. Full balance check via CCXT in Python backend.' 
    };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

// Coinbase test
async function testCoinbase(secrets: Record<string, string>): Promise<{ connected: boolean; balance?: number; error?: string; details?: string }> {
  const apiKey = secrets['COINBASE_API_KEY'];
  const apiSecret = secrets['COINBASE_SECRET_KEY'];
  
  if (!apiKey || !apiSecret) {
    return { connected: false, error: 'Missing Coinbase API key or secret' };
  }
  
  try {
    // Coinbase also needs signed requests - verify key exists
    return { 
      connected: true, 
      details: 'Credentials configured. Full balance check via CCXT in Python backend.' 
    };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}
