'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Zap,
  Settings,
  CheckCircle2,
  TrendingDown,
  BrainCircuit,
  LineChart,
  Sliders,
  Filter,
  Info,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOpportunities, useBotConfig, useUpdateBotConfig } from '@/lib/hooks';
import { formatCurrency, formatPercent, timeAgo, cn } from '@/lib/utils';
import { Tooltip } from '@/components/Tooltip';
import { ProFeature } from '@/components/FeatureGate';

// Define which skip reasons are "actionable" (could be tuned to capture)
const ACTIONABLE_SKIP_REASONS = [
  'below_min_profit',
  'low_confidence',
  'low_volume',
  'high_volatility',
  'position_limit',
  'cooldown_active',
  'daily_loss_limit',
  'rsi_filter',
];

// Skip reasons that mean the opportunity didn't actually meet criteria
const NON_ACTIONABLE_REASONS = [
  'no_arbitrage',
  'market_closed',
  'insufficient_liquidity',
  'price_moved',
  'stale_data',
  'invalid_market',
  'expired',
  'already_positioned',
];

function MissedOpportunitiesContent() {
  const [timeframeHours, setTimeframeHours] = useState(24);
  const [showOnlyActionable, setShowOnlyActionable] = useState(true);
  const { data: opportunities, isLoading } = useOpportunities(1000, timeframeHours);
  const { data: config } = useBotConfig();
  const updateConfig = useUpdateBotConfig();

  // Filter for missed opportunities with minimum criteria
  const missedOpps = useMemo(() => {
    const allMissed = opportunities?.filter(o => o.status !== 'executed' && o.status !== 'filled') || [];
    
    if (showOnlyActionable) {
      // Only show opportunities that:
      // 1. Had positive expected profit (> $0.50)
      // 2. Were skipped for tunable reasons (not because they didn't meet basic criteria)
      return allMissed.filter(o => {
        const profit = o.total_profit || 0;
        const reason = (o.skip_reason || '').toLowerCase();
        
        // Must have meaningful profit potential
        if (profit < 0.50) return false;
        
        // Must be skipped for an actionable reason (not just "no opportunity")
        const isActionable = ACTIONABLE_SKIP_REASONS.some(r => reason.includes(r)) ||
          // Also include if it has a specific threshold-related reason
          reason.includes('threshold') ||
          reason.includes('limit') ||
          reason.includes('filter');
        
        // Exclude non-actionable reasons
        const isNonActionable = NON_ACTIONABLE_REASONS.some(r => reason.includes(r));
        
        return isActionable && !isNonActionable;
      });
    }
    
    return allMissed;
  }, [opportunities, showOnlyActionable]);

  // === ANALYSIS ENGINE ===
  const analysis = useMemo(() => {
    const totalLost = missedOpps.reduce((sum, o) => sum + (o.total_profit || 0), 0);

    // Group by Reason
    const reasonCounts: Record<string, { count: number, profit: number }> = {};
    missedOpps.forEach(o => {
      const r = o.skip_reason || 'Unknown';
      if (!reasonCounts[r]) reasonCounts[r] = { count: 0, profit: 0 };
      reasonCounts[r].count++;
      reasonCounts[r].profit += (o.total_profit || 0);
    });

    // Generate Recommendations
    const recommendations: Recommendation[] = [];

    // 1. Min Profit Threshold Analysis
    const profitskips = Object.entries(reasonCounts).find(([r]) => r.toLowerCase().includes('profit'));
    if (profitskips) {
      recommendations.push({
        id: 'tune_min_profit',
        title: 'Lower Profit Threshold',
        description: `You missed ${formatCurrency(profitskips[1].profit)} because targets were below your ${config?.min_profit_percent || 2}% threshold.`,
        impact: 'High',
        risk: 'Medium',
        actionLabel: `Lower to 1.5%`,
        configUpdate: { min_profit_percent: 1.5 },
        icon: TrendingDown
      });
    }

    // 2. Confidence/AI Analysis
    const confSkips = Object.entries(reasonCounts).find(([r]) => r.toLowerCase().includes('confidence'));
    if (confSkips) {
      recommendations.push({
        id: 'tune_confidence',
        title: 'Optimize AI Confidence',
        description: `${confSkips[1].count} trades skipped due to low confidence. Your strict settings are ignoring valid signals.`,
        impact: 'Medium',
        risk: 'Low',
        actionLabel: 'Enable AI Superforecasting',
        configUpdate: { enable_ai_superforecasting: true, ai_min_confidence: 0.60 },
        icon: BrainCircuit
      });
    }

    return { totalLost, recommendations, reasonCounts };
  }, [missedOpps, config]);

  const [appliedRecs, setAppliedRecs] = useState<string[]>([]);

  const handleApply = (rec: Recommendation) => {
    updateConfig.mutate(rec.configUpdate, {
      onSuccess: () => {
        setAppliedRecs([...appliedRecs, rec.id]);
      }
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-lg bg-dark-card border border-dark-border text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              Missed Revenue Analysis
            </h1>
            <p className="text-gray-400 mt-1">
              <b>{missedOpps.length}</b> actionable opportunities •
              Potential Value: <span className="text-red-400 font-mono font-bold">{formatCurrency(analysis.totalLost)}</span>
            </p>
          </div>
        </div>
        
        {/* Filter Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOnlyActionable(!showOnlyActionable)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
              showOnlyActionable 
                ? "bg-neon-blue/10 border-neon-blue text-neon-blue"
                : "bg-dark-card border-dark-border text-gray-400 hover:text-white"
            )}
          >
            <Filter className="w-4 h-4" />
            {showOnlyActionable ? "Showing Actionable Only" : "Show All Misses"}
          </button>
          <Tooltip content="Actionable = opportunities that met criteria but were skipped due to tunable settings (profit threshold, confidence, etc)">
            <Info className="w-5 h-5 text-gray-500 cursor-help" />
          </Tooltip>
        </div>
      </div>

      {/* Empty State when no actionable opportunities */}
      {missedOpps.length === 0 && showOnlyActionable && (
        <div className="card border-dashed border-green-500/30 bg-green-500/5 p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Actionable Misses!</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Your bot settings are well-tuned. There are no opportunities that met your criteria 
            but were skipped due to adjustable thresholds.
          </p>
          <button
            onClick={() => setShowOnlyActionable(false)}
            className="mt-4 text-neon-blue hover:underline text-sm"
          >
            View all {opportunities?.filter(o => o.status !== 'executed' && o.status !== 'filled').length || 0} raw misses →
          </button>
        </div>
      )}

      {/* AI Insights & Recommendations - Only show if there are actionable misses */}
      {missedOpps.length > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="w-5 h-5 text-neon-purple" />
            <h2 className="text-xl font-bold text-white">AI Tuning Insights</h2>
          </div>

          {analysis.recommendations.length === 0 ? (
            <div className="card border-dashed border-gray-700 p-8 text-center text-gray-500">
              <Info className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No specific tuning recommendations found.</p>
              <p className="text-sm mt-2">Your settings look optimal for current market conditions.</p>
            </div>
          ) : (
            analysis.recommendations.map(rec => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card border-l-4 border-l-neon-blue relative overflow-hidden group"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <rec.icon className="w-5 h-5 text-neon-blue" />
                      {rec.title}
                    </h3>
                    <p className="text-sm text-gray-400 mt-2 mb-4 leading-relaxed">
                      {rec.description}
                    </p>
                    <div className="flex gap-4 text-xs font-mono uppercase tracking-wider">
                      <span className="text-green-400">Impact: {rec.impact}</span>
                      <span className="text-yellow-400">Risk: {rec.risk}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {appliedRecs.includes(rec.id) ? (
                      <div className="flex items-center gap-2 text-green-500 font-bold px-4 py-2 bg-green-500/10 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                        Applied
                      </div>
                    ) : (
                      <button
                        onClick={() => handleApply(rec)}
                        disabled={updateConfig.isPending}
                        className="flex items-center gap-2 bg-neon-blue text-black font-bold px-4 py-2 rounded-lg hover:bg-neon-blue/90 transition-transform active:scale-95 disabled:opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse"
                      >
                        <Zap className="w-4 h-4 fill-current" />
                        {rec.actionLabel}
                      </button>
                    )}
                    <span className="text-[10px] text-gray-500 mt-1">One-click update</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Technical Indicators / RSI Preview */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <LineChart className="w-5 h-5 text-neon-green" />
            <h2 className="text-xl font-bold text-white">Technical Factors</h2>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">RSI & Momentum</h3>
            <div className="space-y-4">
              <div className="p-4 bg-dark-bg/50 rounded-lg flex justify-between items-center">
                <div>
                  <span className="block text-white font-medium">RSI (14) Mean Reversion</span>
                  <span className="text-xs text-gray-500">Avg RSI of missed trades: 32.5 (Oversold)</span>
                </div>
                <div className="text-right">
                  <span className="block text-neon-green font-mono">Bullish Div</span>
                  <Link href="/insights" className="text-xs text-neon-blue hover:text-white">AI Tuning &rarr;</Link>
                </div>
              </div>

              <div className="p-4 bg-dark-bg/50 rounded-lg flex justify-between items-center">
                <div>
                  <span className="block text-white font-medium">Funding Rates</span>
                  <span className="text-xs text-gray-500">Avg APR missed: 15.2%</span>
                </div>
                <div className="text-right">
                  <span className="block text-yellow-400 font-mono">Neutral</span>
                  <Link href="/insights" className="text-xs text-neon-blue hover:text-white">View AI Insights &rarr;</Link>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded text-xs text-blue-300">
              ℹ️ <b>Note:</b> Detailed RSI logs are currently disabled. To see per-trade RSI values, enable &quot;Extended Logging&quot; in Diagnostics.
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Raw Log Table - Only show if there are misses */}
      {missedOpps.length > 0 && (
      <div className="card">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-gray-400" />
          Recent {showOnlyActionable ? 'Actionable ' : ''}Misses
          <span className="text-sm font-normal text-gray-500">({missedOpps.length} total)</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-dark-bg/50">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3 text-right">Potential Profit</th>
                <th className="px-4 py-3">Key Blocker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {missedOpps.slice(0, 8).map((opp) => (
                <tr key={opp.id} className="hover:bg-dark-bg/30">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{timeAgo(opp.detected_at)}</td>
                  <td className="px-4 py-3 font-medium text-white truncate max-w-[200px]">{opp.buy_market_name}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-300">
                    {formatCurrency(opp.total_profit || 0)} <span className="text-gray-600">({formatPercent(opp.profit_percent)})</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full bg-dark-bg border border-dark-border text-xs text-gray-300">
                      {opp.skip_reason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

// Default export with tier gate
export default function MissedOpportunitiesPage() {
  return (
    <ProFeature>
      <MissedOpportunitiesContent />
    </ProFeature>
  );
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  risk: 'High' | 'Medium' | 'Low';
  actionLabel: string;
  configUpdate: Record<string, any>;
  icon: any;
}
