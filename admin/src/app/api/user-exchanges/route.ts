import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/audit';
import { getAwsSecrets } from '@/lib/aws-secrets';

// ============================================================================
// User Exchanges API - Discovery endpoint for user's connected exchanges
// Returns which exchanges user has connected and their status
// Used by UI to know what data to show (markets, charts, opportunities)
//
// CONNECTION DETECTION:
// 1. OAuth tokens in user_exchange_credentials table (IBKR, etc.)
// 2. API keys in AWS Secrets Manager (Kalshi, Polymarket, Binance, etc.)
// ============================================================================

export const dynamic = 'force-dynamic';

// Exchange metadata for display
const EXCHANGE_METADATA: Record<string, {
  name: string;
  type: 'crypto_exchange' | 'stock_broker' | 'prediction_market' | 'options_broker';
  supports: string[];
}> = {
  alpaca: {
    name: 'Alpaca',
    type: 'stock_broker',
    supports: ['stocks', 'crypto'],
  },
  binance: {
    name: 'Binance',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures'],
  },
  bybit: {
    name: 'Bybit',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures', 'options'],
  },
  okx: {
    name: 'OKX',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures', 'options'],
  },
  kraken: {
    name: 'Kraken',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures'],
  },
  coinbase: {
    name: 'Coinbase',
    type: 'crypto_exchange',
    supports: ['crypto'],
  },
  kucoin: {
    name: 'KuCoin',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures'],
  },
  ibkr: {
    name: 'Interactive Brokers',
    type: 'options_broker',
    supports: ['stocks', 'options', 'futures', 'forex'],
  },
  polymarket: {
    name: 'Polymarket',
    type: 'prediction_market',
    supports: ['prediction_markets'],
  },
  kalshi: {
    name: 'Kalshi',
    type: 'prediction_market',
    supports: ['prediction_markets'],
  },
  webull: {
    name: 'Webull',
    type: 'stock_broker',
    supports: ['stocks', 'crypto', 'options'],
  },
  hyperliquid: {
    name: 'Hyperliquid',
    type: 'crypto_exchange',
    supports: ['crypto', 'perpetuals'],
  },
};

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's connected exchanges from credentials table
    const { data: credentials, error: credError } = await supabaseAdmin
      .from('user_exchange_credentials')
      .select('exchange, account_id, is_paper, last_authenticated, created_at')
      .eq('user_id', authResult.user_id);

    if (credError) {
      console.error('Error fetching user exchanges:', credError);
      return NextResponse.json({ error: credError.message }, { status: 500 });
    }

    // Get user's config to see which exchanges are enabled
    const { data: config } = await supabaseAdmin
      .from('polybot_config')
      .select('trading_mode, enable_polymarket, enable_kalshi, enable_binance, enable_bybit, enable_okx, enable_kraken, enable_coinbase, enable_kucoin, enable_alpaca, enable_ibkr')
      .eq('user_id', authResult.user_id)
      .single();

    // Get user's profile for the SOURCE OF TRUTH on simulation mode
    const { data: profile } = await supabaseAdmin
      .from('polybot_profiles')
      .select('is_simulation')
      .eq('id', authResult.user_id)
      .single();

    // Use polybot_profiles.is_simulation as the SINGLE SOURCE OF TRUTH
    // Default to simulation (paper) if not set - safer for users
    const isSimulation = profile?.is_simulation ?? true;

    // ========================================================================
    // DETECT CONNECTED PLATFORMS FROM MULTIPLE SOURCES
    // ========================================================================
    
    // Source 1: OAuth tokens from user_exchange_credentials table
    const oauthConnected = new Set((credentials || []).map(c => c.exchange.toLowerCase()));
    
    // Source 2: API keys from AWS Secrets Manager
    // Map platform ID -> required keys
    const PLATFORM_REQUIRED_KEYS: Record<string, { primary: string[]; alternate?: string[] }> = {
      kalshi: { primary: ['KALSHI_API_KEY', 'KALSHI_PRIVATE_KEY'] },
      polymarket: { primary: ['POLYMARKET_API_KEY', 'POLYMARKET_SECRET'] },
      binance: { primary: ['BINANCE_API_KEY', 'BINANCE_API_SECRET'] },
      bybit: { primary: ['BYBIT_API_KEY', 'BYBIT_API_SECRET'] },
      okx: { primary: ['OKX_API_KEY', 'OKX_API_SECRET', 'OKX_PASSPHRASE'] },
      kraken: { primary: ['KRAKEN_API_KEY', 'KRAKEN_API_SECRET'] },
      coinbase: { primary: ['COINBASE_API_KEY', 'COINBASE_API_SECRET'] },
      kucoin: { primary: ['KUCOIN_API_KEY', 'KUCOIN_API_SECRET', 'KUCOIN_PASSPHRASE'] },
      hyperliquid: { 
        primary: ['HYPERLIQUID_WALLET_ADDRESS', 'HYPERLIQUID_PRIVATE_KEY'],
        alternate: ['HYPERLIQUID_API_WALLET_ADDRESS', 'HYPERLIQUID_API_WALLET_KEY'],
      },
      alpaca: { 
        primary: ['ALPACA_PAPER_API_KEY', 'ALPACA_PAPER_API_SECRET'],
        alternate: ['ALPACA_LIVE_API_KEY', 'ALPACA_LIVE_API_SECRET'],
      },
      ibkr: { primary: ['IBKR_HOST', 'IBKR_PORT'] },
    };
    
    // Fetch AWS secrets and check which platforms have all required keys
    const awsConnected = new Set<string>();
    try {
      const awsSecrets = await getAwsSecrets();
      
      for (const [platformId, keys] of Object.entries(PLATFORM_REQUIRED_KEYS)) {
        // Check primary keys
        const primaryConfigured = keys.primary.every(k => !!awsSecrets[k]);
        if (primaryConfigured) {
          awsConnected.add(platformId);
          continue;
        }
        // Check alternate keys if primary not satisfied
        if (keys.alternate) {
          const altConfigured = keys.alternate.every(k => !!awsSecrets[k]);
          if (altConfigured) {
            awsConnected.add(platformId);
          }
        }
      }
      
      console.log('[user-exchanges] AWS secrets check:', {
        secretsFound: Object.keys(awsSecrets).length,
        platformsConnected: Array.from(awsConnected),
      });
    } catch (error) {
      console.error('[user-exchanges] Error checking AWS secrets:', error);
      // Continue without AWS secrets - will only show OAuth-connected platforms
    }
    
    // Merge both sources: OAuth tokens OR AWS API keys
    const connectedExchanges = new Set([...oauthConnected, ...awsConnected]);
    
    // Create exchange status list
    const exchanges = Object.entries(EXCHANGE_METADATA).map(([key, meta]) => {
      const cred = credentials?.find(c => c.exchange.toLowerCase() === key);
      const configKey = `enable_${key}` as keyof typeof config;
      const isEnabled = config ? config[configKey] : false;
      
      return {
        id: key,
        name: meta.name,
        type: meta.type,
        supports: meta.supports,
        connected: connectedExchanges.has(key),
        enabled: isEnabled,
        is_paper: cred?.is_paper ?? true,
        account_id: cred?.account_id || null,
        last_authenticated: cred?.last_authenticated || null,
        connected_at: cred?.created_at || null,
      };
    });

    // Summary stats
    const connectedCount = exchanges.filter(e => e.connected).length;
    const enabledCount = exchanges.filter(e => e.enabled).length;
    
    // What asset types can this user trade?
    const supportedAssets = new Set<string>();
    exchanges.filter(e => e.connected).forEach(e => {
      e.supports.forEach(s => supportedAssets.add(s));
    });

    return NextResponse.json({
      success: true,
      data: {
        exchanges,
        summary: {
          connected_count: connectedCount,
          enabled_count: enabledCount,
          supported_assets: Array.from(supportedAssets),
        },
        // Quick lookups for UI
        connected_exchange_ids: Array.from(connectedExchanges),
        has_crypto: supportedAssets.has('crypto'),
        has_stocks: supportedAssets.has('stocks'),
        has_options: supportedAssets.has('options'),
        has_prediction_markets: supportedAssets.has('prediction_markets'),
        // Trading mode - critical for filtering logic
        is_simulation: isSimulation,
        trading_mode: config?.trading_mode || 'paper',
      },
    });
  } catch (error) {
    console.error('Error in user-exchanges API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
