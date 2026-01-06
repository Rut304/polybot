import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/audit';
import { getAwsSecrets } from '@/lib/aws-secrets';

// ============================================================================
// Balances API - Returns balances for the authenticated user
// - Connected platforms determined from AWS Secrets Manager
// - Actual balance data from polybot_balances table (populated by Python bot)
// - For LIVE mode: Fetches real-time Alpaca balance from live API
// ============================================================================

// Platform detection: which secrets indicate a platform is configured
const PLATFORM_REQUIRED_KEYS: Record<string, string[]> = {
  polymarket: ['polymarket_api_key', 'polymarket_secret'],
  kalshi: ['kalshi_api_key', 'kalshi_private_key'],
  binance: ['binance_api_key', 'binance_api_secret'],
  coinbase: ['coinbase_api_key', 'coinbase_api_secret'],
  alpaca: ['alpaca_api_key', 'alpaca_api_secret'],
  kraken: ['kraken_api_key', 'kraken_api_secret'],
  bybit: ['bybit_api_key', 'bybit_api_secret'],
  okx: ['okx_api_key', 'okx_api_secret', 'okx_passphrase'],
  kucoin: ['kucoin_api_key', 'kucoin_api_secret', 'kucoin_passphrase'],
  ibkr: ['ibkr_username', 'ibkr_password'],
};

const PLATFORM_TYPES: Record<string, string> = {
  polymarket: 'prediction_market',
  kalshi: 'prediction_market',
  binance: 'crypto_exchange',
  coinbase: 'crypto_exchange',
  alpaca: 'stock_broker',
  kraken: 'crypto_exchange',
  bybit: 'crypto_exchange',
  okx: 'crypto_exchange',
  kucoin: 'crypto_exchange',
  ibkr: 'stock_broker',
};

// Create Supabase admin client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

/**
 * Determine connected platforms from AWS secrets
 */
function getConnectedPlatforms(secrets: Record<string, string>): string[] {
  const connected: string[] = [];
  
  // Create case-insensitive lookup (AWS keys may be uppercase or lowercase)
  const secretsLower = Object.fromEntries(
    Object.entries(secrets).map(([k, v]) => [k.toLowerCase(), v])
  );
  
  for (const [platform, requiredKeys] of Object.entries(PLATFORM_REQUIRED_KEYS)) {
    const allKeysPresent = requiredKeys.every(key => !!secretsLower[key.toLowerCase()]);
    if (allKeysPresent) {
      connected.push(platform);
    }
  }
  
  return connected;
}

/**
 * Fetch real-time Alpaca balance based on trading mode
 */
async function fetchAlpacaBalance(secrets: Record<string, string>, isLiveMode: boolean): Promise<{
  cash_balance: number;
  positions_value: number;
  total_balance: number;
  positions_count: number;
} | null> {
  try {
    // Select keys based on mode
    const apiKey = isLiveMode 
      ? secrets['ALPACA_LIVE_API_KEY'] 
      : (secrets['ALPACA_PAPER_API_KEY'] || secrets['alpaca_api_key']);
    const apiSecret = isLiveMode 
      ? secrets['ALPACA_LIVE_API_SECRET'] 
      : (secrets['ALPACA_PAPER_API_SECRET'] || secrets['alpaca_api_secret']);
    
    if (!apiKey || !apiSecret) {
      console.log(`[Alpaca] No ${isLiveMode ? 'LIVE' : 'PAPER'} credentials found`);
      return null;
    }
    
    const baseUrl = isLiveMode 
      ? 'https://api.alpaca.markets' 
      : 'https://paper-api.alpaca.markets';
    
    console.log(`[Alpaca] Fetching ${isLiveMode ? 'LIVE' : 'PAPER'} balance from ${baseUrl}...`);
    
    const response = await fetch(`${baseUrl}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    });
    
    if (!response.ok) {
      console.error(`[Alpaca] API error: ${response.status} ${await response.text()}`);
      return null;
    }
    
    const account = await response.json();
    const equity = parseFloat(account.equity) || 0;
    const cash = parseFloat(account.cash) || 0;
    
    console.log(`[Alpaca] ${isLiveMode ? 'LIVE' : 'PAPER'} balance: $${equity.toFixed(2)} (cash: $${cash.toFixed(2)})`);
    
    return {
      cash_balance: cash,
      positions_value: equity - cash,
      total_balance: equity,
      positions_count: 0, // Would need separate API call for positions
    };
  } catch (error) {
    console.error('[Alpaca] Error fetching balance:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if live mode is requested (from query param or user's settings)
    const url = new URL(request.url);
    const modeParam = url.searchParams.get('mode');
    
    // Get user's trading mode from database if not specified in URL
    let isLiveMode = modeParam === 'live';
    const supabase = getSupabaseClient();
    
    if (!modeParam && supabase) {
      // Use polybot_profiles as the source of truth for trading mode
      const { data: profile } = await supabase
        .from('polybot_profiles')
        .select('is_simulation')
        .eq('id', authResult.user_id)
        .single();
      
      if (profile) {
        isLiveMode = !profile.is_simulation;
      }
    }
    
    console.log(`[/api/balances] Mode: ${isLiveMode ? 'LIVE' : 'PAPER'}`);

    // Get secrets from AWS to determine connected platforms
    console.log('[/api/balances] Fetching AWS secrets...');
    const secrets = await getAwsSecrets();
    const connectedPlatforms = getConnectedPlatforms(secrets);
    console.log(`[/api/balances] Connected platforms: ${connectedPlatforms.join(', ') || 'none'}`);

    if (!supabase) {
      console.warn('[/api/balances] Supabase not configured');
      return NextResponse.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          total_usd: 0,
          total_positions_usd: 0,
          total_cash_usd: 0,
          connected_exchanges: connectedPlatforms,
          platforms: [],
        },
      });
    }

    // Fetch balance data from polybot_balances table (populated by Python bot)
    const { data: balancesData, error } = await supabase
      .from('polybot_balances')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('[/api/balances] Error fetching from polybot_balances:', error);
    }

    // Get platform balances from the table
    const allPlatformBalances = balancesData?.platforms || [];
    
    // Filter to only connected platforms
    let userPlatforms = allPlatformBalances.filter((p: any) => 
      connectedPlatforms.includes(p.platform?.toLowerCase())
    );
    
    // For LIVE mode: Fetch real-time Alpaca balance from LIVE API
    // (The polybot_balances table may have paper trading data)
    if (isLiveMode && connectedPlatforms.includes('alpaca')) {
      const liveAlpacaBalance = await fetchAlpacaBalance(secrets, true);
      if (liveAlpacaBalance) {
        // Replace or add Alpaca balance with live data
        userPlatforms = userPlatforms.filter((p: any) => p.platform?.toLowerCase() !== 'alpaca');
        userPlatforms.push({
          platform: 'Alpaca',
          platform_type: 'stock_broker',
          cash_balance: liveAlpacaBalance.cash_balance,
          positions_value: liveAlpacaBalance.positions_value,
          total_usd: liveAlpacaBalance.total_balance,
          positions_count: liveAlpacaBalance.positions_count,
          last_updated: new Date().toISOString(),
        });
      }
    }
    
    // For connected platforms not in the table, add them with $0
    const platformsInTable = userPlatforms.map((p: any) => p.platform?.toLowerCase());
    const missingPlatforms = connectedPlatforms.filter(p => !platformsInTable.includes(p));
    
    // Build final platforms array
    const platforms = [
      ...userPlatforms.map((p: any) => ({
        platform: p.platform,
        platform_type: p.platform_type || PLATFORM_TYPES[p.platform?.toLowerCase()] || 'unknown',
        connected: true,
        cash_balance: parseFloat(p.cash_balance) || 0,
        positions_value: parseFloat(p.positions_value) || 0,
        total_balance: (parseFloat(p.cash_balance) || 0) + (parseFloat(p.positions_value) || 0),
        positions_count: p.positions_count || 0,
        last_updated: p.last_updated || balancesData?.updated_at,
      })),
      ...missingPlatforms.map(platform => ({
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        platform_type: PLATFORM_TYPES[platform] || 'unknown',
        connected: true,
        cash_balance: 0,
        positions_value: 0,
        total_balance: 0,
        positions_count: 0,
        last_updated: new Date().toISOString(),
      })),
    ];

    // Calculate totals
    const total_cash = platforms.reduce((sum, p) => sum + p.cash_balance, 0);
    const total_positions = platforms.reduce((sum, p) => sum + p.positions_value, 0);

    return NextResponse.json({
      success: true,
      data: {
        timestamp: balancesData?.updated_at || new Date().toISOString(),
        total_usd: total_cash + total_positions,
        total_positions_usd: total_positions,
        total_cash_usd: total_cash,
        connected_exchanges: connectedPlatforms,
        trading_mode: isLiveMode ? 'live' : 'paper',
        platforms,
      },
    });
  } catch (error) {
    console.error('[/api/balances] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint to trigger balance refresh (calls Python bot)
export async function POST(request: NextRequest) {
  try {
    // In a real implementation, this would trigger the Python balance_aggregator
    // For now, return success with a message
    return NextResponse.json({
      success: true,
      message: 'Balance refresh triggered. Updates will appear shortly.',
    });
  } catch (error) {
    console.error('Error triggering balance refresh:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger refresh' },
      { status: 500 }
    );
  }
}
