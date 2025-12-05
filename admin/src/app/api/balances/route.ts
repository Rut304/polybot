import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      // Return mock data for development
      return NextResponse.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          total_usd: 15420.50,
          total_positions_usd: 8750.25,
          total_cash_usd: 6670.25,
          platforms: [
            {
              platform: 'Polymarket',
              platform_type: 'prediction_market',
              connected: true,
              cash_balance: 1250.00,
              positions_value: 3500.00,
              total_balance: 4750.00,
              positions_count: 5,
              last_updated: new Date().toISOString(),
            },
            {
              platform: 'Kalshi',
              platform_type: 'prediction_market',
              connected: true,
              cash_balance: 2420.25,
              positions_value: 1250.25,
              total_balance: 3670.50,
              positions_count: 3,
              last_updated: new Date().toISOString(),
            },
            {
              platform: 'Binance',
              platform_type: 'crypto_exchange',
              connected: true,
              cash_balance: 2000.00,
              positions_value: 3000.00,
              total_balance: 5000.00,
              positions_count: 2,
              last_updated: new Date().toISOString(),
            },
            {
              platform: 'Alpaca',
              platform_type: 'stock_broker',
              connected: false,
              cash_balance: 0,
              positions_value: 0,
              total_balance: 0,
              positions_count: 0,
              last_updated: null,
            },
          ],
        },
        mock: true,
      });
    }

    // Try to fetch from database
    const { data: balancesData, error } = await supabase
      .from('polybot_balances')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching balances:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Calculate aggregated totals
    const platforms = balancesData || [];
    const total_cash = platforms.reduce((sum: number, p: any) => sum + (parseFloat(p.cash_balance) || 0), 0);
    const total_positions = platforms.reduce((sum: number, p: any) => sum + (parseFloat(p.positions_value) || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        total_usd: total_cash + total_positions,
        total_positions_usd: total_positions,
        total_cash_usd: total_cash,
        platforms: platforms.map((p: any) => ({
          platform: p.platform,
          platform_type: p.platform_type || 'unknown',
          connected: p.connected ?? true,
          cash_balance: parseFloat(p.cash_balance) || 0,
          positions_value: parseFloat(p.positions_value) || 0,
          total_balance: (parseFloat(p.cash_balance) || 0) + (parseFloat(p.positions_value) || 0),
          positions_count: p.positions_count || 0,
          last_updated: p.updated_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error in balances API:', error);
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
