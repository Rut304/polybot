import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Lazy initialization to avoid build-time errors
let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
      // Fallback to anon key (will likely fail RLS, but better than crashing)
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      supabaseInstance = createClient(supabaseUrl, anonKey);
    } else {
      supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
    }
  }
  return supabaseInstance;
}

// Types for tuning recommendations
interface TuningRecommendation {
  id: string;
  strategy: string;
  parameter: string;
  currentValue: number | string;
  recommendedValue: number | string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  priority: number;
}

// Mapping from recommendation parameter names to database column names
const PARAM_TO_COLUMN: Record<string, string> = {
  // Kalshi
  'kalshi_min_profit_pct': 'kalshi_single_min_profit_pct',
  'kalshi_max_position_usd': 'kalshi_single_max_position_usd',
  
  // Polymarket
  'poly_min_profit_pct': 'poly_single_min_profit_pct',
  'poly_max_position_usd': 'poly_single_max_position_usd',
  
  // Cross-platform
  'min_similarity_threshold': 'cross_plat_min_similarity',
  'cross_plat_max_position': 'cross_plat_max_position_usd',
  'enable_cross_exchange_arb': 'enable_cross_exchange_arb', 
  
  // Funding rate
  'funding_min_rate': 'funding_min_rate_pct',
  'funding_min_apy': 'funding_min_apy',
  
  // Grid trading
  'grid_range_pct': 'grid_default_range_pct',
  'grid_levels': 'grid_default_levels',
  
  // Stock strategies
  'stock_mr_zscore': 'stock_mr_entry_zscore',
  'stock_mom_threshold': 'stock_mom_entry_threshold',
  'pairs_zscore': 'pairs_entry_zscore',
  
  // Global settings
  'max_position_usd': 'max_position_usd',
  'min_profit_threshold': 'min_profit_threshold_pct',
};

// Parse numeric value from recommendation (handles strings like "4%" or "$50")
function parseNumericValue(value: number | string): number {
  if (typeof value === 'number') return value;
  // Remove $, %, and other non-numeric chars except decimal point
  const cleaned = value.toString().replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned);
}

// Validate that adjustment is within allowed range
function validateAdjustment(
  currentValue: number,
  newValue: number,
  maxAdjustmentPct: number
): boolean {
  if (currentValue === 0) return newValue <= maxAdjustmentPct;
  const changePct = Math.abs((newValue - currentValue) / currentValue) * 100;
  return changePct <= maxAdjustmentPct;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recommendations, forceApply, user_id } = body as {
      recommendations: TuningRecommendation[];
      forceApply?: boolean;
      user_id?: string;
    };

    console.log('[AutoTune] Received request:', { 
      recCount: recommendations?.length, 
      forceApply, 
      user_id 
    });

    if (!recommendations || !Array.isArray(recommendations)) {
      return NextResponse.json(
        { error: 'Invalid recommendations array' },
        { status: 400 }
      );
    }

    const supabase = getSupabase() as any;
    let query = supabase.from('polybot_config').select('*');
    
    // If user_id provided, use it. Otherwise default to id=1 (legacy)
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      query = query.eq('id', 1);
    }

    const { data: configData, error: configError } = await query.single();

    if (configError || !configData) {
      console.error('[AutoTune] Config fetch error:', configError);
      return NextResponse.json(
        { error: `Failed to fetch current config: ${configError?.message || 'Not found'}` },
        { status: 500 }
      );
    }

    // eslint-disable-next-line
    const config = configData as any;
    const maxAdjustmentPct = config.rsi_max_adjustment_pct || 25.0; // Increased default to 25%
    const rsiEnabled = config.rsi_auto_tuning_enabled !== false;

    if (!rsiEnabled && !forceApply) {
      return NextResponse.json(
        { error: 'RSI auto-tuning is disabled. Enable it in settings or use forceApply.' },
        { status: 400 }
      );
    }

    // Process recommendations
    const updates: Record<string, number> = {};
    const applied: TuningRecommendation[] = [];
    const skipped: Array<{ recommendation: TuningRecommendation; reason: string }> = [];

    for (const rec of recommendations) {
      const columnName = PARAM_TO_COLUMN[rec.parameter] || rec.parameter;
      
      // Check if column exists in config
      if (!(columnName in config)) {
        console.warn(`[AutoTune] Column not found: ${columnName}`);
        skipped.push({ recommendation: rec, reason: `Column '${columnName}' not found` });
        continue;
      }

      const currentDbValue = config[columnName];
      const recommendedValue = parseNumericValue(rec.recommendedValue);

      // Skip if no change (fuzzy comparison)
      if (Math.abs(currentDbValue - recommendedValue) < 0.0001) {
        skipped.push({ recommendation: rec, reason: 'No change needed' });
        continue;
      }

      // Validate adjustment is within allowed range
      if (!forceApply && !validateAdjustment(currentDbValue, recommendedValue, maxAdjustmentPct)) {
        skipped.push({
          recommendation: rec,
          reason: `Change exceeds max adjustment of ${maxAdjustmentPct}%`,
        });
        continue;
      }

      // Only apply high confidence recommendations unless forced
      if (!forceApply && rec.confidence < 0.6) {
        skipped.push({ recommendation: rec, reason: 'Low confidence (< 60%)' });
        continue;
      }

      updates[columnName] = recommendedValue;
      applied.push(rec);
    }

    console.log('[AutoTune] Updates to apply:', updates);

    // Apply updates if any
    let updateResult = null;
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from('polybot_config')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', config.id) // Use the ID we found
        .select();

      if (error) {
        console.error('[AutoTune] Update error:', error);
        return NextResponse.json(
          { error: `Failed to update config: ${error.message}` },
          { status: 500 }
        );
      }
      updateResult = data;
    }

    // Log the auto-tune action
    await supabase.from('audit_log').insert({
      action: 'RSI_AUTO_TUNE',
      details: {
        applied: applied.map(r => ({
          parameter: r.parameter,
          from: r.currentValue,
          to: r.recommendedValue,
          reason: r.reason,
        })),
        skipped: skipped,
        forceApply,
        user_id: config.user_id 
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      applied: applied.length,
      skipped: skipped.length,
      updates,
      skippedReasons: skipped, // detailed feedback
    });
  } catch (error) {
    console.error('[AutoTune] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    const supabase = getSupabase() as any;
    let query = supabase
      .from('polybot_config')
      .select(`
        rsi_auto_tuning_enabled,
        rsi_min_trades_before_adjust,
        rsi_max_adjustment_pct,
        rsi_adjustment_interval_hours,
        rsi_last_adjustment_at,
        kelly_sizing_enabled,
        regime_detection_enabled,
        circuit_breaker_enabled,
        time_decay_enabled,
        depeg_detection_enabled,
        correlation_limits_enabled
      `);
      
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      query = query.eq('id', 1);
    }

    const { data, error } = await query.single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rsiEnabled: data.rsi_auto_tuning_enabled ?? false,
      minTradesBeforeAdjust: data.rsi_min_trades_before_adjust ?? 20,
      maxAdjustmentPct: data.rsi_max_adjustment_pct ?? 15,
      adjustmentIntervalHours: data.rsi_adjustment_interval_hours ?? 24,
      lastAdjustmentAt: data.rsi_last_adjustment_at,
      modules: {
        kelly: data.kelly_sizing_enabled ?? true,
        regime: data.regime_detection_enabled ?? true,
        circuitBreaker: data.circuit_breaker_enabled ?? true,
        timeDecay: data.time_decay_enabled ?? true,
        depeg: data.depeg_detection_enabled ?? true,
        correlation: data.correlation_limits_enabled ?? true,
      },
    });
  } catch (error) {
    console.error('[AutoTune] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
