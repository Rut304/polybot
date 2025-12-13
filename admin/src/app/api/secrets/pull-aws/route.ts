import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } from '@aws-sdk/client-secrets-manager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const hasServiceKey = supabaseUrl && supabaseServiceKey;
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// AWS Configuration - us-east-1 is where Lightsail is deployed
const awsRegion = process.env.AWS_REGION || 'us-east-1';
const hasAwsConfig = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const secretsClient = hasAwsConfig ? new SecretsManagerClient({ 
  region: awsRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
}) : null;

// Map secret keys from AWS JSON to our DB structure
interface SecretMapping {
  key_name: string;
  category: string;
  description: string;
}

const KEY_MAPPINGS: Record<string, SecretMapping> = {
  'BINANCE_API_KEY': {
    key_name: 'BINANCE_API_KEY',
    category: 'crypto_exchanges',
    description: 'Binance API key with trading permissions',
  },
  'BINANCE_API_SECRET': {
    key_name: 'BINANCE_API_SECRET',
    category: 'crypto_exchanges',
    description: 'Binance API secret',
  },
  'POLYMARKET_API_KEY': {
    key_name: 'POLYMARKET_API_KEY',
    category: 'prediction_markets',
    description: 'Polymarket API key',
  },
  'POLYMARKET_SECRET': {
    key_name: 'POLYMARKET_SECRET',
    category: 'prediction_markets',
    description: 'Polymarket API secret',
  },
  'KALSHI_API_KEY': {
    key_name: 'KALSHI_API_KEY',
    category: 'prediction_markets',
    description: 'Kalshi API key',
  },
  'KALSHI_PRIVATE_KEY': {
    key_name: 'KALSHI_PRIVATE_KEY',
    category: 'prediction_markets',
    description: 'Kalshi RSA private key',
  },
  'BYBIT_API_KEY': {
    key_name: 'BYBIT_API_KEY',
    category: 'crypto_exchanges',
    description: 'Bybit API key',
  },
  'BYBIT_API_SECRET': {
    key_name: 'BYBIT_API_SECRET',
    category: 'crypto_exchanges',
    description: 'Bybit API secret',
  },
  'OKX_API_KEY': {
    key_name: 'OKX_API_KEY',
    category: 'crypto_exchanges',
    description: 'OKX API key',
  },
  'OKX_API_SECRET': {
    key_name: 'OKX_API_SECRET',
    category: 'crypto_exchanges',
    description: 'OKX API secret',
  },
  'OKX_PASSPHRASE': {
    key_name: 'OKX_PASSPHRASE',
    category: 'crypto_exchanges',
    description: 'OKX API passphrase',
  },
  'KRAKEN_API_KEY': {
    key_name: 'KRAKEN_API_KEY',
    category: 'crypto_exchanges',
    description: 'Kraken API key',
  },
  'KRAKEN_API_SECRET': {
    key_name: 'KRAKEN_API_SECRET',
    category: 'crypto_exchanges',
    description: 'Kraken API secret',
  },
  'COINBASE_API_KEY': {
    key_name: 'COINBASE_API_KEY',
    category: 'crypto_exchanges',
    description: 'Coinbase Advanced Trade API key',
  },
  'COINBASE_API_SECRET': {
    key_name: 'COINBASE_API_SECRET',
    category: 'crypto_exchanges',
    description: 'Coinbase Advanced Trade API secret',
  },
  'KUCOIN_API_KEY': {
    key_name: 'KUCOIN_API_KEY',
    category: 'crypto_exchanges',
    description: 'KuCoin API key',
  },
  'KUCOIN_API_SECRET': {
    key_name: 'KUCOIN_API_SECRET',
    category: 'crypto_exchanges',
    description: 'KuCoin API secret',
  },
  'KUCOIN_PASSPHRASE': {
    key_name: 'KUCOIN_PASSPHRASE',
    category: 'crypto_exchanges',
    description: 'KuCoin API passphrase',
  },
  'ALPACA_API_KEY': {
    key_name: 'ALPACA_LIVE_API_KEY',
    category: 'stock_brokers',
    description: 'Alpaca Live Trading API key',
  },
  'ALPACA_API_SECRET': {
    key_name: 'ALPACA_LIVE_API_SECRET',
    category: 'stock_brokers',
    description: 'Alpaca Live Trading API secret',
  },
  'ALPACA_PAPER_API_KEY': {
    key_name: 'ALPACA_PAPER_API_KEY',
    category: 'stock_brokers',
    description: 'Alpaca Paper Trading API key (simulation)',
  },
  'ALPACA_PAPER_API_SECRET': {
    key_name: 'ALPACA_PAPER_API_SECRET',
    category: 'stock_brokers',
    description: 'Alpaca Paper Trading API secret (simulation)',
  },
  'FINNHUB_API_KEY': {
    key_name: 'FINNHUB_API_KEY',
    category: 'news_sentiment',
    description: 'Finnhub API key for market news & sentiment',
  },
  'NEWSAPI_KEY': {
    key_name: 'NEWSAPI_KEY',
    category: 'news_sentiment',
    description: 'NewsAPI.org API key for news headlines',
  },
  'TWITTER_API_KEY': {
    key_name: 'TWITTER_API_KEY',
    category: 'news_sentiment',
    description: 'Twitter/X API key for social sentiment',
  },
  'TWITTER_API_SECRET': {
    key_name: 'TWITTER_API_SECRET',
    category: 'news_sentiment',
    description: 'Twitter/X API secret',
  },
  'TWITTER_BEARER_TOKEN': {
    key_name: 'TWITTER_BEARER_TOKEN',
    category: 'news_sentiment',
    description: 'Twitter/X Bearer token for API v2',
  },
  'WALLET_ADDRESS': {
    key_name: 'POLYMARKET_WALLET_ADDRESS',
    category: 'prediction_markets',
    description: 'Ethereum wallet address for Polymarket',
  },
  'WALLET_PRIVATE_KEY': {
    key_name: 'POLYMARKET_PRIVATE_KEY',
    category: 'prediction_markets',
    description: 'Wallet private key (keep secure!)',
  },
};

// Fetch secrets from AWS and sync to Supabase
async function fetchAwsSecrets(): Promise<Record<string, string>> {
  if (!secretsClient) {
    throw new Error('AWS not configured');
  }
  
  const secrets: Record<string, string> = {};
  
  try {
    // First, list all polybot secrets
    const listCommand = new ListSecretsCommand({
      Filters: [{ Key: 'name', Values: ['polybot/'] }],
    });
    const listResult = await secretsClient.send(listCommand);
    
    // Fetch each secret's value
    for (const secret of listResult.SecretList || []) {
      if (!secret.Name) continue;
      
      try {
        const getCommand = new GetSecretValueCommand({ SecretId: secret.Name });
        const getResult = await secretsClient.send(getCommand);
        
        if (getResult.SecretString) {
          // Try to parse as JSON (our polybot/trading-keys format)
          try {
            const parsed = JSON.parse(getResult.SecretString);
            Object.assign(secrets, parsed);
          } catch {
            // If not JSON, treat as single value
            // Extract key name from secret name (e.g., polybot/binance-api-key -> BINANCE_API_KEY)
            const keyName = secret.Name.replace('polybot/', '').toUpperCase().replace(/-/g, '_');
            secrets[keyName] = getResult.SecretString;
          }
        }
      } catch (err) {
        console.error(`Failed to get secret ${secret.Name}:`, err);
      }
    }
  } catch (err) {
    console.error('Failed to list secrets:', err);
    throw err;
  }
  
  return secrets;
}

// POST - Pull secrets from AWS and sync to Supabase
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }

  if (!secretsClient) {
    return NextResponse.json(
      { error: 'AWS not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.' },
      { status: 500 }
    );
  }

  try {
    // Fetch secrets from AWS
    const awsSecrets = await fetchAwsSecrets();
    
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [keyName, value] of Object.entries(awsSecrets)) {
      const mapping = KEY_MAPPINGS[keyName];
      
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
          }, {
            onConflict: 'key_name',
          });

        if (upsertError) throw upsertError;
        imported++;
      } catch (err: any) {
        errors.push(`${keyName}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      found_in_aws: Object.keys(awsSecrets).length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${imported} secrets from AWS to Supabase`,
    });
  } catch (err: any) {
    console.error('Error syncing from AWS:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to sync secrets from AWS' },
      { status: 500 }
    );
  }
}

// GET - List expected secrets and their current status
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
      .select('key_name, is_configured, last_updated');

    const existingMap = new Map(
      (existingSecrets || []).map(s => [s.key_name, s])
    );

    // Build status for all expected secrets
    const secretStatus = Object.entries(KEY_MAPPINGS).map(([awsKey, mapping]) => {
      const existing = existingMap.get(mapping.key_name);
      return {
        aws_key: awsKey,
        key_name: mapping.key_name,
        category: mapping.category,
        description: mapping.description,
        is_configured: existing?.is_configured || false,
        last_updated: existing?.last_updated || null,
      };
    });

    return NextResponse.json({
      secrets: secretStatus,
      configured: secretStatus.filter(s => s.is_configured).length,
      total: secretStatus.length,
      aws_configured: hasAwsConfig,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to get secret status' },
      { status: 500 }
    );
  }
}
