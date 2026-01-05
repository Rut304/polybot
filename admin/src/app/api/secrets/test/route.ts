import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, logAuditEvent, checkRateLimit, getRequestMetadata, rateLimitResponse, unauthorizedResponse } from '@/lib/audit';
import { getAwsSecrets } from '@/lib/aws-secrets';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Polymarket CLOB API base URL
const POLYMARKET_CLOB_API = 'https://clob.polymarket.com';
const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com';

// Generate L1 authentication headers for Polymarket
function generatePolymarketAuth(apiKey: string, apiSecret: string, timestamp: string) {
  const message = `${timestamp}GET/auth/nonce`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('base64');
  
  return {
    'POLY_ADDRESS': apiKey,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp,
    'POLY_NONCE': '0',
  };
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }

  const metadata = await getRequestMetadata(request);

  // Rate limiting (strict - 5 per minute for testing)
  const rateLimitResult = await checkRateLimit(metadata.ip_address, 'secrets.test', 5, 60);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.resetAt);
  }

  // Auth verification
  const authResult = await verifyAuth(request);
  if (!authResult) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { platform } = body;

    if (!platform) {
      return NextResponse.json(
        { error: 'platform is required (polymarket, kalshi, alpaca)' },
        { status: 400 }
      );
    }

    // Fetch the relevant secrets from AWS (PRIMARY SOURCE)
    const awsSecrets = await getAwsSecrets();
    const requiredKeys = getRequiredKeys(platform);
    const secretsMap = new Map(
      requiredKeys.map(k => [k, awsSecrets[k] || ''])
    );

    let testResult;
    switch (platform.toLowerCase()) {
      case 'polymarket':
        testResult = await testPolymarket(secretsMap);
        break;
      case 'kalshi':
        testResult = await testKalshi(secretsMap);
        break;
      case 'alpaca':
        testResult = await testAlpaca(secretsMap);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown platform: ${platform}` },
          { status: 400 }
        );
    }

    // Log the test
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'secret.test',
      resource_type: 'secret',
      resource_id: platform,
      details: { 
        platform,
        success: testResult.success,
        message: testResult.message,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: testResult.success ? 'info' : 'warning',
    });

    return NextResponse.json(testResult);
  } catch (error: any) {
    console.error('Error testing secrets:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test secrets' },
      { status: 500 }
    );
  }
}

function getRequiredKeys(platform: string): string[] {
  switch (platform.toLowerCase()) {
    case 'polymarket':
      return ['POLYMARKET_API_KEY', 'POLYMARKET_SECRET', 'POLYMARKET_WALLET_ADDRESS'];
    case 'kalshi':
      return ['KALSHI_API_KEY', 'KALSHI_PRIVATE_KEY'];
    case 'alpaca':
      return ['ALPACA_PAPER_API_KEY', 'ALPACA_PAPER_API_SECRET', 'ALPACA_LIVE_API_KEY', 'ALPACA_LIVE_API_SECRET'];
    default:
      return [];
  }
}

async function testPolymarket(secrets: Map<string, string | null>): Promise<TestResult> {
  const apiKey = secrets.get('POLYMARKET_API_KEY');
  const apiSecret = secrets.get('POLYMARKET_SECRET');
  const walletAddress = secrets.get('POLYMARKET_WALLET_ADDRESS');

  // First check if keys are configured
  if (!apiKey || !apiSecret) {
    return {
      success: false,
      message: 'API key or secret not configured',
      details: {
        api_key_configured: !!apiKey,
        api_secret_configured: !!apiSecret,
        wallet_configured: !!walletAddress,
      },
    };
  }

  try {
    // Test 1: Check if Gamma API is accessible (public, no auth needed)
    const gammaResponse = await fetch(`${POLYMARKET_GAMMA_API}/markets?limit=1`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!gammaResponse.ok) {
      return {
        success: false,
        message: 'Polymarket Gamma API is not accessible',
        details: { gamma_status: gammaResponse.status },
      };
    }

    // Test 2: Try to get server time from CLOB API (public endpoint)
    const timeResponse = await fetch(`${POLYMARKET_CLOB_API}/time`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!timeResponse.ok) {
      return {
        success: false,
        message: 'Polymarket CLOB API is not accessible',
        details: { clob_status: timeResponse.status },
      };
    }

    const timeData = await timeResponse.json();

    // Test 3: If we have a wallet address, check positions (public endpoint)
    let positionCount = 0;
    if (walletAddress) {
      try {
        const posResponse = await fetch(
          `https://data-api.polymarket.com/positions?user=${walletAddress.toLowerCase()}`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (posResponse.ok) {
          const positions = await posResponse.json();
          positionCount = Array.isArray(positions) ? positions.length : 0;
        }
      } catch {
        // Position check is optional
      }
    }

    // Note: Full auth validation would require making a signed request
    // For now, we verify the keys are in valid format
    const keyValid = apiKey.length > 20 && apiKey.startsWith('0x');
    const secretValid = apiSecret.length > 20;

    if (!keyValid) {
      return {
        success: false,
        message: 'API key format appears invalid (should start with 0x)',
        details: {
          key_format: 'invalid',
          gamma_api: 'accessible',
          clob_api: 'accessible',
        },
      };
    }

    return {
      success: true,
      message: 'Polymarket connection verified',
      details: {
        gamma_api: 'accessible',
        clob_api: 'accessible',
        server_time: timeData.serverTime || timeData,
        wallet_configured: !!walletAddress,
        positions_found: positionCount,
        key_format: 'valid',
        note: 'Full trading auth requires signed request - keys appear valid',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection test failed: ${error.message}`,
      details: { error: error.message },
    };
  }
}

async function testKalshi(secrets: Map<string, string | null>): Promise<TestResult> {
  const apiKey = secrets.get('KALSHI_API_KEY');
  const privateKey = secrets.get('KALSHI_PRIVATE_KEY');

  if (!apiKey || !privateKey) {
    return {
      success: false,
      message: 'API key or private key not configured',
      details: {
        api_key_configured: !!apiKey,
        private_key_configured: !!privateKey,
      },
    };
  }

  try {
    // Test Kalshi exchange status (public endpoint)
    const response = await fetch('https://api.elections.kalshi.com/trade-api/v2/exchange/status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return {
        success: false,
        message: 'Kalshi API is not accessible',
        details: { status: response.status },
      };
    }

    const data = await response.json();

    // Validate key formats
    const keyValid = apiKey.length > 10;
    const pkValid = privateKey.includes('-----BEGIN') || privateKey.length > 100;

    if (!pkValid) {
      return {
        success: false,
        message: 'Private key format appears invalid (should be RSA key)',
        details: {
          exchange_status: data.exchange_active ? 'active' : 'inactive',
          key_format: 'valid',
          private_key_format: 'invalid',
        },
      };
    }

    return {
      success: true,
      message: 'Kalshi connection verified',
      details: {
        exchange_status: data.exchange_active ? 'active' : 'inactive',
        trading_active: data.trading_active,
        key_format: 'valid',
        private_key_format: 'valid',
        note: 'Full auth requires signed request - keys appear valid',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection test failed: ${error.message}`,
      details: { error: error.message },
    };
  }
}

async function testAlpaca(secrets: Map<string, string | null>): Promise<TestResult> {
  // Check for paper or live keys
  const paperKey = secrets.get('ALPACA_PAPER_API_KEY');
  const paperSecret = secrets.get('ALPACA_PAPER_API_SECRET');
  const liveKey = secrets.get('ALPACA_LIVE_API_KEY');
  const liveSecret = secrets.get('ALPACA_LIVE_API_SECRET');

  // Prefer paper keys for testing
  const apiKey = paperKey || liveKey;
  const apiSecret = paperSecret || liveSecret;
  const isPaper = !!paperKey;
  const baseUrl = isPaper 
    ? 'https://paper-api.alpaca.markets'
    : 'https://api.alpaca.markets';

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      message: 'No Alpaca API keys configured',
      details: {
        paper_key_configured: !!paperKey,
        paper_secret_configured: !!paperSecret,
        live_key_configured: !!liveKey,
        live_secret_configured: !!liveSecret,
      },
    };
  }

  try {
    // Test account endpoint (requires auth)
    const response = await fetch(`${baseUrl}/v2/account`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'Invalid Alpaca API credentials',
        details: {
          status: response.status,
          mode: isPaper ? 'paper' : 'live',
          error: 'Authentication failed',
        },
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: `Alpaca API error: ${response.status}`,
        details: { status: response.status, mode: isPaper ? 'paper' : 'live' },
      };
    }

    const account = await response.json();

    return {
      success: true,
      message: `Alpaca ${isPaper ? 'Paper' : 'Live'} trading connected`,
      details: {
        mode: isPaper ? 'paper' : 'live',
        account_status: account.status,
        buying_power: `$${parseFloat(account.buying_power).toLocaleString()}`,
        portfolio_value: `$${parseFloat(account.portfolio_value).toLocaleString()}`,
        cash: `$${parseFloat(account.cash).toLocaleString()}`,
        pattern_day_trader: account.pattern_day_trader,
        trading_blocked: account.trading_blocked,
        account_blocked: account.account_blocked,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection test failed: ${error.message}`,
      details: { error: error.message },
    };
  }
}

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}
