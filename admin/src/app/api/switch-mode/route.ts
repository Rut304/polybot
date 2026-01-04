import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/audit';

// ============================================================================
// Switch Trading Mode API
// ============================================================================
// This endpoint handles switching between paper and live trading modes.
// It saves the current session stats and creates a new session.
// ============================================================================

export const dynamic = 'force-dynamic';

interface SwitchModeRequest {
  newMode: 'paper' | 'live';
  currentStats?: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    opportunitiesDetected: number;
    opportunitiesExecuted: number;
    currentBalance: number;
  };
}

export async function POST(request: NextRequest) {
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

    const userId = authResult.user_id;
    const body: SwitchModeRequest = await request.json();
    const { newMode, currentStats } = body;

    if (!newMode || !['paper', 'live'].includes(newMode)) {
      return NextResponse.json({ error: 'Invalid mode. Must be "paper" or "live"' }, { status: 400 });
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('polybot_profiles')
      .select('is_simulation, subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Can't switch to live on free tier
    if (newMode === 'live' && profile.subscription_tier === 'free') {
      return NextResponse.json({ 
        error: 'Upgrade to Pro or Elite for live trading',
        code: 'TIER_REQUIRED'
      }, { status: 403 });
    }

    const isCurrentlySimulation = profile.is_simulation ?? true;
    const requestedSimulation = newMode === 'paper';

    // If already in requested mode, no-op
    if (isCurrentlySimulation === requestedSimulation) {
      return NextResponse.json({
        success: true,
        message: `Already in ${newMode} mode`,
        mode: newMode,
      });
    }

    // Try to save session (if table exists)
    try {
      // End current session and start new one
      if (currentStats) {
        // End current session with stats
        await supabaseAdmin
          .from('polybot_trading_sessions')
          .update({
            ended_at: new Date().toISOString(),
            ending_balance: currentStats.currentBalance,
            total_trades: currentStats.totalTrades,
            winning_trades: currentStats.winningTrades,
            losing_trades: currentStats.losingTrades,
            total_pnl: currentStats.totalPnl,
            opportunities_detected: currentStats.opportunitiesDetected,
            opportunities_executed: currentStats.opportunitiesExecuted,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .is('ended_at', null);
      }

      // Create new session
      await supabaseAdmin
        .from('polybot_trading_sessions')
        .insert({
          user_id: userId,
          session_mode: newMode,
          starting_balance: currentStats?.currentBalance || 0,
          started_at: new Date().toISOString(),
        });
    } catch (sessionError) {
      // Session table might not exist yet - that's OK, continue with mode switch
      console.log('Session tracking skipped (table may not exist):', sessionError);
    }

    // Update profile with new mode
    const { error: updateError } = await supabaseAdmin
      .from('polybot_profiles')
      .update({
        is_simulation: requestedSimulation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating trading mode:', updateError);
      return NextResponse.json({ error: 'Failed to update trading mode' }, { status: 500 });
    }

    // Also update polybot_config for consistency
    await supabaseAdmin
      .from('polybot_config')
      .update({
        trading_mode: newMode,
        dry_run_mode: requestedSimulation,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      message: `Switched to ${newMode} mode`,
      mode: newMode,
      sessionSaved: true,
    });

  } catch (error) {
    console.error('Error in switch-mode API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Get current mode from profile (source of truth)
    const { data: profile, error } = await supabaseAdmin
      .from('polybot_profiles')
      .select('is_simulation')
      .eq('id', authResult.user_id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      mode: profile.is_simulation ? 'paper' : 'live',
      is_simulation: profile.is_simulation ?? true,
    });

  } catch (error) {
    console.error('Error in switch-mode GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
