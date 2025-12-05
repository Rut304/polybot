import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const hasServiceKey = supabaseUrl && supabaseServiceKey;
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Map AWS secret names to our key structure
const AWS_SECRET_MAPPING: Record<string, { key_name: string; category: string; description: string }> = {
  'polybot/polymarket-api-key': {
    key_name: 'polymarket_api_key',
    category: 'prediction_markets',
    description: 'Polymarket API key from your developer account',
  },
  'polybot/polymarket-secret': {
    key_name: 'polymarket_secret',
    category: 'prediction_markets',
    description: 'Polymarket API secret',
  },
  'polybot/kalshi-api-key': {
    key_name: 'kalshi_api_key',
    category: 'prediction_markets',
    description: 'Kalshi API key from your developer settings',
  },
  'polybot/kalshi-private-key': {
    key_name: 'kalshi_private_key',
    category: 'prediction_markets',
    description: 'Kalshi RSA private key for signing requests',
  },
  'polybot/binance-api-key': {
    key_name: 'binance_api_key',
    category: 'crypto_exchanges',
    description: 'Binance API key with trading permissions',
  },
  'polybot/binance-api-secret': {
    key_name: 'binance_api_secret',
    category: 'crypto_exchanges',
    description: 'Binance API secret',
  },
  'polybot/bybit-api-key': {
    key_name: 'bybit_api_key',
    category: 'crypto_exchanges',
    description: 'Bybit API key',
  },
  'polybot/bybit-api-secret': {
    key_name: 'bybit_api_secret',
    category: 'crypto_exchanges',
    description: 'Bybit API secret',
  },
  'polybot/okx-api-key': {
    key_name: 'okx_api_key',
    category: 'crypto_exchanges',
    description: 'OKX API key',
  },
  'polybot/okx-api-secret': {
    key_name: 'okx_api_secret',
    category: 'crypto_exchanges',
    description: 'OKX API secret',
  },
  'polybot/okx-passphrase': {
    key_name: 'okx_passphrase',
    category: 'crypto_exchanges',
    description: 'OKX API passphrase',
  },
  'polybot/kraken-api-key': {
    key_name: 'kraken_api_key',
    category: 'crypto_exchanges',
    description: 'Kraken API key',
  },
  'polybot/kraken-api-secret': {
    key_name: 'kraken_api_secret',
    category: 'crypto_exchanges',
    description: 'Kraken API secret',
  },
  'polybot/coinbase-api-key': {
    key_name: 'coinbase_api_key',
    category: 'crypto_exchanges',
    description: 'Coinbase Advanced Trade API key',
  },
  'polybot/coinbase-api-secret': {
    key_name: 'coinbase_api_secret',
    category: 'crypto_exchanges',
    description: 'Coinbase Advanced Trade API secret',
  },
  'polybot/kucoin-api-key': {
    key_name: 'kucoin_api_key',
    category: 'crypto_exchanges',
    description: 'KuCoin API key',
  },
  'polybot/kucoin-api-secret': {
    key_name: 'kucoin_api_secret',
    category: 'crypto_exchanges',
    description: 'KuCoin API secret',
  },
  'polybot/kucoin-passphrase': {
    key_name: 'kucoin_passphrase',
    category: 'crypto_exchanges',
    description: 'KuCoin API passphrase',
  },
  'polybot/alpaca-api-key': {
    key_name: 'alpaca_api_key',
    category: 'stock_brokers',
    description: 'Alpaca API key',
  },
  'polybot/alpaca-api-secret': {
    key_name: 'alpaca_api_secret',
    category: 'stock_brokers',
    description: 'Alpaca API secret',
  },
  'polybot/wallet-address': {
    key_name: 'wallet_address',
    category: 'prediction_markets',
    description: 'Ethereum wallet address for Polymarket',
  },
  'polybot/private-key': {
    key_name: 'wallet_private_key',
    category: 'prediction_markets',
    description: 'Wallet private key (keep secure!)',
  },
  'polybot/supabase-url': {
    key_name: 'supabase_url',
    category: 'infrastructure',
    description: 'Supabase project URL',
  },
  'polybot/supabase-key': {
    key_name: 'supabase_anon_key',
    category: 'infrastructure',
    description: 'Supabase anon/public key',
  },
};

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const awsSecrets = body.secrets as Record<string, string>;
    
    if (!awsSecrets || typeof awsSecrets !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request. Expected { secrets: { name: value, ... } }' },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [awsName, value] of Object.entries(awsSecrets)) {
      const mapping = AWS_SECRET_MAPPING[awsName];
      
      if (!mapping) {
        skipped++;
        continue;
      }

      try {
        // Upsert the secret
        const { error: upsertError } = await supabaseAdmin
          .from('polybot_secrets')
          .upsert({
            key_name: mapping.key_name,
            key_value: value,
            category: mapping.category,
            description: mapping.description,
            is_configured: !!value,
            last_updated: new Date().toISOString(),
            synced_aws: true,
          }, {
            onConflict: 'key_name',
          });

        if (upsertError) throw upsertError;
        imported++;
      } catch (err: any) {
        errors.push(`${awsName}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Imported ${imported} secrets from AWS`,
    });
  } catch (err: any) {
    console.error('Error importing from AWS:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to import secrets' },
      { status: 500 }
    );
  }
}

// GET - List expected secrets and their status
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  try {
    // Get all secrets from database
    const { data: existingSecrets } = await supabaseAdmin
      .from('polybot_secrets')
      .select('key_name, is_configured');

    const existingMap = new Map(
      (existingSecrets || []).map(s => [s.key_name, s.is_configured])
    );

    // Build status for all expected secrets
    const secretStatus = Object.entries(AWS_SECRET_MAPPING).map(([awsName, mapping]) => ({
      aws_name: awsName,
      key_name: mapping.key_name,
      category: mapping.category,
      description: mapping.description,
      is_configured: existingMap.get(mapping.key_name) || false,
    }));

    return NextResponse.json({
      secrets: secretStatus,
      configured: secretStatus.filter(s => s.is_configured).length,
      total: secretStatus.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to get secret status' },
      { status: 500 }
    );
  }
}
