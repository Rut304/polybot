import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Lazy initialization to avoid build-time errors
let supabaseInstance: ReturnType<typeof createClient> | null = null;
// eslint-disable-next-line
function getSupabase(): any {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
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
    const { recommendations, forceApply } = body as {
      recommendations: TuningRecommendation[];
      forceApply?: boolean;
    };

    if (!recommendations || !Array.isArray(recommendations)) {
      return NextResponse.json(
        { error: 'Invalid recommendations array' },
        { status: 400 }
      );
    }

    // Get current config
    const { data: configData, error: configError } = await getSupabase()
      .from('polybot_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (configError || !configData) {
      return NextResponse.json(
        { error: 'Failed to fetch current config' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line
    const config = configData as any;
    const maxAdjustmentPct = config.rsi_max_adjustment_pct || 15.0;
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
        skipped.push({ recommendation: rec, reason: `Column '${columnName}' not found` });
        continue;
      }

      const currentDbValue = config[columnName];
      const recommendedValue = parseNumericValue(rec.recommendedValue);

      // Skip if no change
      if (currentDbValue === recommendedValue) {
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

    // Apply updates if any
    let updateResult = null;
    if (Object.keys(updates).length > 0) {
      const { data, error } = await getSupabase()
        .from('polybot_config')
        .update({
          ...updates,
          // Note: rsi_last_adjustment_at column doesn't exist yet - skip for now
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
        .select();

      if (error) {
        return NextResponse.json(
          { error: `Failed to update config: ${error.message}` },
          { status: 500 }
        );
      }
      updateResult = data;
    }

    // Log the auto-tune action
    const { error: logError } = await getSupabase().from('audit_log').insert({
      action: 'RSI_AUTO_TUNE',
      details: {
        applied: applied.map(r => ({
          parameter: r.parameter,
          from: r.currentValue,
          to: r.recommendedValue,
          reason: r.reason,
        })),
        skipped: skipped.length,
        forceApply,
      },
      created_at: new Date().toISOString(),
    });

    if (logError) {
      console.warn('Failed to log auto-tune action:', logError);
    }

    return NextResponse.json({
      success: true,
      applied: applied.length,
      skipped: skipped.length,
      updates,
      appliedRecommendations: applied,
      skippedRecommendations: skipped,
    });
  } catch (error) {
    console.error('Auto-tune error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check RSI status
export async function GET() {
  try {
    const { data, error } = await getSupabase()
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
      `)
      .eq('id', 1)
      .single();

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
    console.error('RSI status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
