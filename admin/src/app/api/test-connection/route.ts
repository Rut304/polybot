import { NextRequest, NextResponse } from 'next/server';
import { getAwsSecrets, isAwsConfigured } from '@/lib/aws-secrets';

export async function POST(req: NextRequest) {
  try {
    const { platform } = await req.json();
    
    if (!platform) {
      return NextResponse.json({ error: 'Missing platform' }, { status: 400 });
    }
    
    // Get all secrets from AWS Secrets Manager (PRIMARY SOURCE)
    if (!isAwsConfigured()) {
      return NextResponse.json({ 
        error: 'AWS Secrets Manager not configured. Set AMAZON_ACCESS_KEY_ID and AMAZON_SECRET_ACCESS_KEY.' 
      }, { status: 500 });
    }
    
    const secretsMap = await getAwsSecrets();
    
    if (Object.keys(secretsMap).length === 0) {
      return NextResponse.json({ 
        error: 'No secrets found in AWS Secrets Manager (polybot/trading-keys)' 
      }, { status: 500 });
    }
    
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
  
  if (!privateKey) {
    return { connected: false, error: 'No Kalshi private key configured' };
  }
  
  // Kalshi requires RSA key signing for API calls, which is complex in JS
  // Just verify credentials are configured - actual connection test runs in Python bot
  return { 
    connected: true, 
    details: 'Credentials configured. Balance check via Python backend.' 
  };
}

// Alpaca test
async function testAlpaca(secrets: Record<string, string>): Promise<{ connected: boolean; balance?: number; error?: string; details?: string }> {
  // Try paper keys first, then fall back to generic keys
  const apiKey = secrets['ALPACA_PAPER_API_KEY'] || secrets['ALPACA_API_KEY'];
  const apiSecret = secrets['ALPACA_PAPER_API_SECRET'] || secrets['ALPACA_API_SECRET'];
  
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
  const apiSecret = secrets['BINANCE_API_SECRET'] || secrets['BINANCE_SECRET_KEY'];
  
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
  const apiSecret = secrets['COINBASE_API_SECRET'] || secrets['COINBASE_SECRET_KEY'];
  
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
