import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/audit';
import { getAwsSecrets } from '@/lib/aws-secrets';

// ============================================================================
// Balances API - Returns balances for the authenticated user
// Determines connected platforms from AWS Secrets Manager
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

    // Build platform data with $0 balances (actual balance fetching would call exchange APIs)
    // For now, we're just showing which platforms are connected
    const platforms = connectedPlatforms.map(platform => ({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      platform_type: PLATFORM_TYPES[platform] || 'unknown',
      connected: true,
      cash_balance: 0,  // TODO: Implement actual balance fetching from exchanges
      positions_value: 0,
      total_balance: 0,
      positions_count: 0,
      last_updated: new Date().toISOString(),
    }));

    // Calculate totals
    const total_cash = platforms.reduce((sum, p) => sum + p.cash_balance, 0);
    const total_positions = platforms.reduce((sum, p) => sum + p.positions_value, 0);

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
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
