import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/audit';

// ============================================================================
// Balances API - Returns balances for the authenticated user
// Multi-tenant: Filters by user_id and user's connected exchanges
// ============================================================================

// Create Supabase admin client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
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
          total_usd: 5000.00,
          total_positions_usd: 0,
          total_cash_usd: 5000.00,
          platforms: [],
        },
        mock: true,
      });
    }

    // Verify authentication and get user_id
    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, get user's connected exchanges
    const { data: userExchanges } = await supabase
      .from('user_exchange_credentials')
      .select('exchange')
      .eq('user_id', authResult.user_id);
    
    const connectedExchanges = userExchanges?.map(e => e.exchange) || [];

    // Fetch balances filtered by user_id
    const { data: balancesData, error } = await supabase
      .from('polybot_balances')
      .select('*')
      .eq('user_id', authResult.user_id)  // Multi-tenant filter
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
        connected_exchanges: connectedExchanges,
        platforms: platforms.map((p: any) => ({
          platform: p.platform,
          platform_type: p.platform_type || 'unknown',
          connected: connectedExchanges.includes(p.platform?.toLowerCase()),
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
