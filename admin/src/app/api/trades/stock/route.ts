import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

interface StockTradeRequest {
  user_id: string;
  symbol: string;
  action: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  quantity: number;
  price: number;
  source: 'ibkr' | 'alpaca';
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    const body: StockTradeRequest = await request.json();
    const { user_id, symbol, action, order_type, quantity, price, source } = body;
    
    // Validate required fields
    if (!user_id || !symbol || !action || !quantity || !price) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['user_id', 'symbol', 'action', 'quantity', 'price'],
      }, { status: 400 });
    }
    
    // Calculate total value
    const total_value = quantity * price;
    
    // Create trade record for paper trading
    const tradeRecord = {
      user_id,
      strategy: 'manual_stock_trade',
      platform: source === 'ibkr' ? 'ibkr' : 'alpaca',
      market_id: symbol,
      market_title: `${action.toUpperCase()} ${symbol}`,
      position_side: action === 'buy' ? 'long' : 'short',
      position_size_usd: total_value,
      entry_price: price,
      alpaca_symbol: symbol,
      ibkr_symbol: source === 'ibkr' ? symbol : null,
      outcome: 'pending',
      notes: `Manual ${order_type} ${action} order: ${quantity} shares @ $${price.toFixed(2)}`,
      is_live: false,
      is_paper: true,
      order_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const { data: trade, error: tradeError } = await supabase
      .from('polybot_simulated_trades')
      .insert(tradeRecord)
      .select()
      .single();
    
    if (tradeError) {
      console.error('Trade insert error:', tradeError);
      return NextResponse.json({ 
        error: 'Failed to create trade',
        details: tradeError.message,
      }, { status: 500 });
    }
    
    // Create position record
    const positionRecord = {
      user_id,
      position_id: `STOCK-${symbol}-${Date.now()}`,
      platform: source === 'ibkr' ? 'ibkr' : 'alpaca',
      market_id: symbol,
      market_title: symbol,
      side: action === 'buy' ? 'long' : 'short',
      quantity: action === 'buy' ? quantity : -quantity,
      avg_price: price,
      current_price: price,
      cost_basis: total_value,
      current_value: total_value,
      unrealized_pnl: 0,
      is_automated: false,
      is_stock: true,
      alpaca_symbol: symbol,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await supabase
      .from('polybot_positions')
      .upsert(positionRecord, { onConflict: 'user_id,position_id' });
    
    // Log the trade
    console.log(`[Stock Trade] User ${user_id}: ${action.toUpperCase()} ${quantity} ${symbol} @ $${price.toFixed(2)} (${source})`);
    
    return NextResponse.json({
      success: true,
      trade: {
        id: trade.id,
        symbol,
        action,
        quantity,
        price,
        total_value,
        source,
        status: 'filled', // Paper trades are instant
        created_at: trade.created_at,
      },
      message: `Successfully ${action === 'buy' ? 'bought' : 'sold'} ${quantity} shares of ${symbol}`,
    });
    
  } catch (error) {
    console.error('Stock trade API error:', error);
    return NextResponse.json({ 
      error: 'Failed to process trade',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to fetch user's stock trades
export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    
    const { data: trades, error } = await supabase
      .from('polybot_simulated_trades')
      .select('*')
      .eq('user_id', userId)
      .eq('strategy', 'manual_stock_trade')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ trades });
    
  } catch (error) {
    console.error('Stock trades GET error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch trades',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
