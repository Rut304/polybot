import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const hasServiceKey = supabaseUrl && supabaseServiceKey;
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// All secrets that should exist in the database
const SECRETS_TO_SEED = [
  // Prediction Markets
  { key_name: 'POLYMARKET_API_KEY', description: 'Polymarket CLOB API Key for authenticated trading', category: 'prediction_markets' },
  { key_name: 'POLYMARKET_SECRET', description: 'Polymarket CLOB API Secret', category: 'prediction_markets' },
  { key_name: 'POLYMARKET_PRIVATE_KEY', description: 'Ethereum wallet private key for on-chain Polymarket trades (0x...)', category: 'prediction_markets' },
  { key_name: 'WALLET_ADDRESS', description: 'Ethereum wallet address (0x...) for Polymarket', category: 'prediction_markets' },
  { key_name: 'KALSHI_API_KEY', description: 'Kalshi API Key ID from dashboard', category: 'prediction_markets' },
  { key_name: 'KALSHI_PRIVATE_KEY', description: 'Kalshi RSA Private Key (PEM format) for signing requests', category: 'prediction_markets' },
  
  // Stock Brokers - Alpaca (PAPER + LIVE)
  { key_name: 'ALPACA_PAPER_API_KEY', description: 'Alpaca Paper Trading API Key (simulation mode)', category: 'stock_brokers' },
  { key_name: 'ALPACA_PAPER_API_SECRET', description: 'Alpaca Paper Trading API Secret', category: 'stock_brokers' },
  { key_name: 'ALPACA_LIVE_API_KEY', description: 'Alpaca Live Trading API Key (real money)', category: 'stock_brokers' },
  { key_name: 'ALPACA_LIVE_API_SECRET', description: 'Alpaca Live Trading API Secret', category: 'stock_brokers' },
  
  // Stock Brokers - IBKR
  { key_name: 'IBKR_HOST', description: 'Interactive Brokers TWS/Gateway Host (usually 127.0.0.1)', category: 'stock_brokers' },
  { key_name: 'IBKR_PORT', description: 'IBKR TWS Port (7497 for paper, 7496 for live)', category: 'stock_brokers' },
  { key_name: 'IBKR_CLIENT_ID', description: 'IBKR Client ID (any unique integer)', category: 'stock_brokers' },
  
  // Crypto Exchanges
  { key_name: 'BINANCE_API_KEY', description: 'Binance API Key', category: 'crypto_exchanges' },
  { key_name: 'BINANCE_API_SECRET', description: 'Binance API Secret', category: 'crypto_exchanges' },
  { key_name: 'COINBASE_API_KEY', description: 'Coinbase Pro/Advanced API Key', category: 'crypto_exchanges' },
  { key_name: 'COINBASE_API_SECRET', description: 'Coinbase API Secret', category: 'crypto_exchanges' },
  { key_name: 'BYBIT_API_KEY', description: 'Bybit Unified V5 API Key', category: 'crypto_exchanges' },
  { key_name: 'BYBIT_API_SECRET', description: 'Bybit API Secret', category: 'crypto_exchanges' },
  { key_name: 'OKX_API_KEY', description: 'OKX API Key', category: 'crypto_exchanges' },
  { key_name: 'OKX_API_SECRET', description: 'OKX API Secret', category: 'crypto_exchanges' },
  { key_name: 'OKX_PASSPHRASE', description: 'OKX API Passphrase (required by OKX)', category: 'crypto_exchanges' },
  { key_name: 'KRAKEN_API_KEY', description: 'Kraken API Key', category: 'crypto_exchanges' },
  { key_name: 'KRAKEN_API_SECRET', description: 'Kraken Private Key', category: 'crypto_exchanges' },
  { key_name: 'KUCOIN_API_KEY', description: 'KuCoin API Key', category: 'crypto_exchanges' },
  { key_name: 'KUCOIN_API_SECRET', description: 'KuCoin API Secret', category: 'crypto_exchanges' },
  { key_name: 'KUCOIN_PASSPHRASE', description: 'KuCoin API Passphrase', category: 'crypto_exchanges' },
  
  // Hyperliquid DEX (Zero gas fees, sub-second latency)
  { key_name: 'HYPERLIQUID_WALLET_ADDRESS', description: 'Ethereum wallet address (0x...) for Hyperliquid', category: 'crypto_exchanges' },
  { key_name: 'HYPERLIQUID_PRIVATE_KEY', description: 'Ethereum private key for signing orders (never shared)', category: 'crypto_exchanges' },
  { key_name: 'HYPERLIQUID_API_WALLET_ADDRESS', description: 'Optional: Dedicated API wallet for bot trading', category: 'crypto_exchanges' },
  { key_name: 'HYPERLIQUID_API_WALLET_KEY', description: 'Optional: API wallet key (can trade but not withdraw)', category: 'crypto_exchanges' },
  
  // Data Feeds / News
  { key_name: 'FINNHUB_API_KEY', description: 'Finnhub API key for stock/crypto market data', category: 'data_feeds' },
  { key_name: 'NEWS_API_KEY', description: 'NewsAPI.org API key for news sentiment', category: 'data_feeds' },
  { key_name: 'TWITTER_BEARER_TOKEN', description: 'Twitter/X Bearer token for API v2', category: 'data_feeds' },
  
  // Notifications
  { key_name: 'DISCORD_WEBHOOK', description: 'Discord webhook URL for trade notifications', category: 'notifications' },
  { key_name: 'TELEGRAM_BOT_TOKEN', description: 'Telegram bot token from @BotFather', category: 'notifications' },
  { key_name: 'TELEGRAM_CHAT_ID', description: 'Telegram chat/channel ID for notifications', category: 'notifications' },
  
  // Infrastructure  
  { key_name: 'SUPABASE_URL', description: 'Supabase project URL', category: 'infrastructure' },
  { key_name: 'SUPABASE_KEY', description: 'Supabase anon/public key', category: 'infrastructure' },
  { key_name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key (for backend)', category: 'infrastructure' },
];

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }

  try {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const secret of SECRETS_TO_SEED) {
      try {
        // Check if exists first
        const { data: existing } = await supabaseAdmin
          .from('polybot_secrets')
          .select('key_name')
          .eq('key_name', secret.key_name)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert new secret placeholder
        const { error: insertError } = await supabaseAdmin
          .from('polybot_secrets')
          .insert({
            key_name: secret.key_name,
            description: secret.description,
            category: secret.category,
            is_configured: false,
            key_value: null,
          });

        if (insertError) {
          errors.push(`${secret.key_name}: ${insertError.message}`);
        } else {
          created++;
        }
      } catch (err: any) {
        errors.push(`${secret.key_name}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: SECRETS_TO_SEED.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Seeded ${created} secrets (${skipped} already existed)`,
    });

  } catch (error: any) {
    console.error('Seed secrets error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to seed secrets' },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('polybot_secrets')
      .select('key_name, category, is_configured')
      .order('category')
      .order('key_name');

    if (error) throw error;

    const configured = (data || []).filter(s => s.is_configured).length;
    const total = data?.length || 0;

    return NextResponse.json({
      total,
      configured,
      missing: SECRETS_TO_SEED.length - total,
      secrets: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
