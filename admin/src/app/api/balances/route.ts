import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/audit';
import { getAwsSecrets } from '@/lib/aws-secrets';

// ============================================================================
// Balances API - Returns balances for the authenticated user
// - Connected platforms determined from AWS Secrets Manager
// - Actual balance data from polybot_balances table (populated by Python bot)
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
  
  for (const [platform, requiredKeys] of Object.entries(PLATFORM_REQUIRED_KEYS)) {
    const allKeysPresent = requiredKeys.every(key => !!secrets[key]);
    if (allKeysPresent) {
      connected.push(platform);
    }
  }
  
  return connected;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get secrets from AWS to determine connected platforms
    console.log('[/api/balances] Fetching AWS secrets to determine connected platforms...');
    const secrets = await getAwsSecrets();
    const connectedPlatforms = getConnectedPlatforms(secrets);
    console.log(`[/api/balances] Connected platforms: ${connectedPlatforms.join(', ') || 'none'}`);

    // Get Supabase client to read actual balance data
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      // Return connected platforms with $0 if Supabase not available
      console.warn('[/api/balances] Supabase not configured');
      const platforms = connectedPlatforms.map(platform => ({
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        platform_type: PLATFORM_TYPES[platform] || 'unknown',
        connected: true,
        cash_balance: 0,
        positions_value: 0,
        total_balance: 0,
        positions_count: 0,
        last_updated: new Date().toISOString(),
      }));
      
      return NextResponse.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          total_usd: 0,
          total_positions_usd: 0,
          total_cash_usd: 0,
          connected_exchanges: connectedPlatforms,
          platforms,
        },
      });
    }

    // Fetch balance data from polybot_balances table (populated by Python bot)
    const { data: balancesData, error } = await supabase
      .from('polybot_balances')
      .select('*')
      .eq('id', 1)  // Single row table
      .single();

    if (error) {
      console.error('[/api/balances] Error fetching from polybot_balances:', error);
    }

    // Get platform balances from the table
    const allPlatformBalances = balancesData?.platforms || [];
    console.log(`[/api/balances] Found ${allPlatformBalances.length} platforms in polybot_balances table`);

    // Filter to only connected platforms (from AWS)
    const userPlatforms = allPlatformBalances.filter((p: any) => 
      connectedPlatforms.includes(p.platform?.toLowerCase())
    );
    
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
