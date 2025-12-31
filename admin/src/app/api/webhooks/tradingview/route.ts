import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialize Supabase client (only when needed)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.warn('Supabase not configured for TradingView webhook');
    return null;
  }
  
  supabase = createClient(url, key);
  return supabase;
}

// Optional webhook secret for verification
const TRADINGVIEW_WEBHOOK_SECRET = process.env.TRADINGVIEW_WEBHOOK_SECRET;

// ============================================================================
// TradingView Webhook Handler
// 
// This endpoint receives alerts from TradingView and can:
// 1. Log the signal for analysis
// 2. Forward to the bot for automated trading
// 3. Store in database for strategy backtesting
//
// TradingView Alert Message Format (JSON):
// {
//   "symbol": "{{ticker}}",
//   "action": "buy" | "sell",
//   "price": "{{close}}",
//   "time": "{{timenow}}",
//   "exchange": "{{exchange}}",
//   "strategy": "your_strategy_name",
//   "interval": "{{interval}}",
//   "secret": "your_webhook_secret"  // optional for verification
// }
// ============================================================================

interface TradingViewAlert {
  symbol: string;
  action: 'buy' | 'sell' | 'long' | 'short' | 'close';
  price?: string | number;
  time?: string;
  exchange?: string;
  strategy?: string;
  interval?: string;
  secret?: string;
  // Additional optional fields
  quantity?: number;
  position_size?: number;
  take_profit?: number;
  stop_loss?: number;
  comment?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse the incoming alert
    let alert: TradingViewAlert;
    
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      alert = await request.json();
    } else {
      // TradingView can send plain text, try to parse as JSON anyway
      const text = await request.text();
      try {
        alert = JSON.parse(text);
      } catch {
        // If it's truly plain text, try to extract basic info
        return NextResponse.json({
          success: false,
          error: 'Invalid format. Please send JSON.',
          received: text.substring(0, 100)
        }, { status: 400 });
      }
    }

    console.log('[TradingView Webhook] Received alert:', {
      symbol: alert.symbol,
      action: alert.action,
      strategy: alert.strategy,
      timestamp: new Date().toISOString()
    });

    // Verify webhook secret if configured
    if (TRADINGVIEW_WEBHOOK_SECRET && alert.secret !== TRADINGVIEW_WEBHOOK_SECRET) {
      console.error('[TradingView Webhook] Invalid secret');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid webhook secret' 
      }, { status: 401 });
    }

    // Validate required fields
    if (!alert.symbol || !alert.action) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: symbol, action'
      }, { status: 400 });
    }

    // Normalize the action
    const normalizedAction = normalizeAction(alert.action);
    
    // Store the signal in the database (if configured)
    let signal: { id: string } | null = null;
    const db = getSupabase();
    
    if (db) {
      const { data, error: dbError } = await db
        .from('polybot_tradingview_signals')
        .insert({
          symbol: alert.symbol.toUpperCase(),
          action: normalizedAction,
          price: parseFloat(String(alert.price || 0)) || null,
          exchange: alert.exchange || null,
          strategy: alert.strategy || 'unknown',
          interval: alert.interval || null,
          quantity: alert.quantity || null,
          take_profit: alert.take_profit || null,
          stop_loss: alert.stop_loss || null,
          comment: alert.comment || null,
          raw_payload: alert,
          processed: false,
          received_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        // If table doesn't exist, just log it and continue
        console.warn('[TradingView Webhook] DB insert warning:', dbError.message);
      } else {
        signal = data;
      }
    }

    // Determine if this is a stock, crypto, or prediction market signal
    const assetType = detectAssetType(alert.symbol, alert.exchange);
    
    // Forward to appropriate bot endpoint if needed
    let forwardResult = null;
    if (process.env.BOT_WEBHOOK_URL) {
      try {
        const botResponse = await fetch(process.env.BOT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'tradingview',
            signal_id: signal?.id,
            ...alert,
            asset_type: assetType,
            normalized_action: normalizedAction
          })
        });
        forwardResult = await botResponse.json();
      } catch (forwardError) {
        console.warn('[TradingView Webhook] Forward to bot failed:', forwardError);
      }
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Signal received and logged',
      data: {
        signal_id: signal?.id,
        symbol: alert.symbol,
        action: normalizedAction,
        asset_type: assetType,
        processing_time_ms: processingTime,
        forwarded: !!forwardResult
      }
    });

  } catch (error) {
    console.error('[TradingView Webhook] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

// Also support GET for webhook testing
export async function GET() {
  return NextResponse.json({
    status: 'TradingView webhook endpoint is active',
    usage: {
      method: 'POST',
      content_type: 'application/json',
      required_fields: ['symbol', 'action'],
      optional_fields: [
        'price', 'time', 'exchange', 'strategy', 
        'interval', 'quantity', 'take_profit', 'stop_loss', 'comment'
      ],
      actions: ['buy', 'sell', 'long', 'short', 'close'],
      example: {
        symbol: 'AAPL',
        action: 'buy',
        price: '{{close}}',
        strategy: 'RSI_Oversold',
        interval: '1H'
      }
    }
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeAction(action: string): 'buy' | 'sell' | 'close' {
  const a = action.toLowerCase();
  if (a === 'buy' || a === 'long') return 'buy';
  if (a === 'sell' || a === 'short') return 'sell';
  if (a === 'close') return 'close';
  return 'buy'; // default
}

function detectAssetType(symbol: string, exchange?: string): 'stock' | 'crypto' | 'prediction' | 'unknown' {
  const s = symbol.toUpperCase();
  const e = (exchange || '').toUpperCase();
  
  // Crypto exchanges
  const cryptoExchanges = ['BINANCE', 'COINBASE', 'KRAKEN', 'BYBIT', 'OKX', 'KUCOIN'];
  if (cryptoExchanges.some(ex => e.includes(ex))) return 'crypto';
  
  // Crypto suffixes
  if (s.endsWith('USDT') || s.endsWith('USD') || s.endsWith('BTC') || s.endsWith('ETH')) {
    return 'crypto';
  }
  
  // Common crypto symbols
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK'];
  if (cryptoSymbols.includes(s) || cryptoSymbols.some(c => s.startsWith(c))) {
    return 'crypto';
  }
  
  // Stock exchanges
  const stockExchanges = ['NYSE', 'NASDAQ', 'AMEX', 'ARCA'];
  if (stockExchanges.some(ex => e.includes(ex))) return 'stock';
  
  // Prediction markets (Polymarket, Kalshi)
  if (s.includes('POLY') || s.includes('KALSHI') || e.includes('POLY') || e.includes('KALSHI')) {
    return 'prediction';
  }
  
  // Default to stock for standard ticker formats
  if (/^[A-Z]{1,5}$/.test(s)) return 'stock';
  
  return 'unknown';
}
