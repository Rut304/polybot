'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Brain,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  Zap,
  BarChart3,
  Clock,
  DollarSign,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Bitcoin,
  LineChart,
  Layers,
  Sliders,
  Settings2,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  PlayCircle,
  Cpu,
  ToggleLeft,
  ToggleRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useSimulatedTrades,
  useOpportunities,
  useSimulationStats,
  useSimulationHistory,
  useStrategyPerformance,
  useBotConfig,
} from '@/lib/hooks';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';

// Strategy tuning recommendation interface
interface TuningRecommendation {
  id: string;
  strategy: string;
  parameter: string;
  currentValue: number | string;
  recommendedValue: number | string;
  reason: string;
  impact: 'increase_trades' | 'increase_profit' | 'reduce_risk' | 'balance';
  confidence: 'high' | 'medium' | 'low';
  priority: number; // 1-10, higher = more important
}

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'opportunity' | 'info';
  category: 'performance' | 'timing' | 'sizing' | 'platform' | 'risk' | 'strategy' | 'crypto' | 'stocks';
  title: string;
  description: string;
  metric?: string;
  action?: string;
  impact: 'high' | 'medium' | 'low';
}

const InsightIcon = ({ type }: { type: Insight['type'] }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-neon-green" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'opportunity':
      return <Lightbulb className="w-5 h-5 text-neon-blue" />;
    case 'info':
      return <Brain className="w-5 h-5 text-neon-purple" />;
  }
};

const ImpactBadge = ({ impact }: { impact: Insight['impact'] }) => {
  const colors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full border text-xs font-medium", colors[impact])}>
      {impact.charAt(0).toUpperCase() + impact.slice(1)} Impact
    </span>
  );
};

// Format strategy name for display
const formatStrategyName = (name?: string): string => {
  if (!name) return 'Unknown';
  return name
    .replace(/_/g, ' ')
    .replace(/arb/gi, 'Arbitrage')
    .replace(/\b\w/g, c => c.toUpperCase());
};

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const bgColors = {
    success: 'from-neon-green/10 to-transparent border-neon-green/30',
    warning: 'from-yellow-500/10 to-transparent border-yellow-500/30',
    opportunity: 'from-neon-blue/10 to-transparent border-neon-blue/30',
    info: 'from-neon-purple/10 to-transparent border-neon-purple/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "relative p-4 rounded-xl border bg-gradient-to-r cursor-pointer transition-all hover:scale-[1.02]",
        bgColors[insight.type]
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-dark-bg/50 rounded-lg">
          <InsightIcon type={insight.type} />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{insight.title}</h3>
            <ImpactBadge impact={insight.impact} />
          </div>

          <p className="text-sm text-gray-400 mb-2">{insight.description}</p>

          {insight.metric && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-dark-bg/50 rounded-lg text-sm">
              <BarChart3 className="w-4 h-4 text-neon-green" />
              <span className="font-mono">{insight.metric}</span>
            </div>
          )}

          <AnimatePresence>
            {expanded && insight.action && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-dark-border">
                  <div className="flex items-center gap-2 text-neon-green">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Suggested Action</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2">{insight.action}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// Tuning Recommendation Card Component
function TuningCard({ recommendation, index, onApply }: {
  recommendation: TuningRecommendation;
  index: number;
  onApply?: (rec: TuningRecommendation) => void;
}) {
  const [copied, setCopied] = useState(false);

  const impactColors = {
    increase_trades: 'from-neon-blue/20 to-transparent border-neon-blue/40',
    increase_profit: 'from-neon-green/20 to-transparent border-neon-green/40',
    reduce_risk: 'from-yellow-500/20 to-transparent border-yellow-500/40',
    balance: 'from-neon-purple/20 to-transparent border-neon-purple/40',
  };

  const impactIcons = {
    increase_trades: <TrendingUp className="w-5 h-5 text-neon-blue" />,
    increase_profit: <DollarSign className="w-5 h-5 text-neon-green" />,
    reduce_risk: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    balance: <Sliders className="w-5 h-5 text-neon-purple" />,
  };

  const impactLabels = {
    increase_trades: 'Find More Opportunities',
    increase_profit: 'Maximize Profit',
    reduce_risk: 'Reduce Risk',
    balance: 'Optimize Balance',
  };

  const confidenceColors = {
    high: 'bg-neon-green/20 text-neon-green border-neon-green/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${recommendation.parameter}: ${recommendation.recommendedValue}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "relative p-4 rounded-xl border bg-gradient-to-r",
        impactColors[recommendation.impact]
      )}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-dark-bg/50 rounded-lg">
          {impactIcons[recommendation.impact]}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{recommendation.strategy}</span>
              <h3 className="font-semibold">{recommendation.parameter}</h3>
            </div>
            <span className={cn("px-2 py-0.5 rounded-full border text-xs font-medium", confidenceColors[recommendation.confidence])}>
              {recommendation.confidence} confidence
            </span>
          </div>

          <p className="text-sm text-gray-400 mb-3">{recommendation.reason}</p>

          {/* Value Change Display */}
          <div className="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-lg">
            <div className="text-center">
              <span className="text-xs text-gray-500 block">Current</span>
              <span className="font-mono text-red-400">{recommendation.currentValue}</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-500" />
            <div className="text-center">
              <span className="text-xs text-gray-500 block">Recommended</span>
              <span className="font-mono text-neon-green font-bold">{recommendation.recommendedValue}</span>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleCopy}
                className="p-2 hover:bg-dark-card rounded-lg transition-colors"
                title="Copy value"
              >
                {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <Target className="w-3 h-3" />
            <span>{impactLabels[recommendation.impact]}</span>
            <span className="text-gray-600">•</span>
            <span>Priority: {recommendation.priority}/10</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Interface for suggestion history
interface SuggestionHistoryEntry {
  id: string;
  timestamp: string;
  recommendations: TuningRecommendation[];
  appliedCount: number;
}

export default function InsightsPage() {
  const { data: trades = [] } = useSimulatedTrades(500);
  const { data: opportunities = [] } = useOpportunities(1000);
  const { data: stats } = useSimulationStats();
  const { data: history = [] } = useSimulationHistory(168); // Last 7 days
  const { data: strategyPerf = [] } = useStrategyPerformance();
  const { data: config, refetch: refetchConfig } = useBotConfig();

  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<Insight['category'] | 'all'>('all');
  const [showTuning, setShowTuning] = useState(true);
  const [applyingRecommendations, setApplyingRecommendations] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [rsiEnabled, setRsiEnabled] = useState(true); // Default ON - Apply All always works
  const [showHistory, setShowHistory] = useState(false);
  const [suggestionHistory, setSuggestionHistory] = useState<SuggestionHistoryEntry[]>([]);

  // Load suggestion history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('suggestionHistory');
      if (stored) {
        setSuggestionHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load suggestion history:', e);
    }
  }, []);

  // Apply all recommendations automatically
  const handleApplyAllRecommendations = useCallback(async (recommendations: TuningRecommendation[]) => {
    if (recommendations.length === 0) {
      setApplyResult({ success: false, message: 'No recommendations to apply' });
      return;
    }

    setApplyingRecommendations(true);
    setApplyResult(null);

    try {
      const response = await fetch('/api/config/auto-tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          forceApply: true, // Apply all regardless of RSI setting
          user_id: config?.user_id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply recommendations');
      }

      setApplyResult({
        success: true,
        message: `Applied ${data.applied} recommendations (${data.skipped} skipped)`,
      });

      // Save to history
      const historyEntry: SuggestionHistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        recommendations,
        appliedCount: data.applied || 0,
      };

      setSuggestionHistory(prev => {
        const newHistory = [historyEntry, ...prev].slice(0, 20); // Keep last 20 entries
        try {
          localStorage.setItem('suggestionHistory', JSON.stringify(newHistory));
        } catch (e) {
          console.error('Failed to save suggestion history:', e);
        }
        return newHistory;
      });

      // Refresh config
      refetchConfig?.();
    } catch (error) {
      setApplyResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setApplyingRecommendations(false);
    }
  }, [refetchConfig]);

  // Toggle RSI auto-tuning (local state only - DB column doesn't exist yet)
  const handleToggleRSI = useCallback(() => {
    setRsiEnabled(prev => !prev);
    // Note: This is a visual toggle only. Apply All always works regardless of this setting.
  }, []);

  // Generate insights from data analysis
  const insights = useMemo<Insight[]>(() => {
    const results: Insight[] = [];

    if (!trades.length && !opportunities.length && !strategyPerf.length) {
      return [{
        id: 'no-data',
        type: 'info',
        category: 'performance',
        title: 'Gathering Data',
        description: 'The AI needs more trading data to generate insights. Keep the bot running to collect more information.',
        impact: 'low',
      }];
    }

    // Analyze win rate
    const completedTrades = trades.filter(t => t.outcome !== 'pending');
    const wonTrades = completedTrades.filter(t => t.outcome === 'won');
    const winRate = completedTrades.length > 0 ? (wonTrades.length / completedTrades.length) * 100 : 0;

    if (winRate >= 60) {
      results.push({
        id: 'high-win-rate',
        type: 'success',
        category: 'performance',
        title: 'Excellent Win Rate',
        description: `Your bot is performing exceptionally well with a ${winRate.toFixed(1)}% win rate. The current strategy is working.`,
        metric: `${winRate.toFixed(1)}% Win Rate`,
        impact: 'high',
      });
    } else if (winRate < 45 && completedTrades.length > 10) {
      results.push({
        id: 'low-win-rate',
        type: 'warning',
        category: 'performance',
        title: 'Win Rate Below Target',
        description: `Current win rate of ${winRate.toFixed(1)}% is below the recommended 50% threshold.`,
        metric: `${winRate.toFixed(1)}% Win Rate`,
        action: 'Consider increasing the minimum profit threshold to only take higher-confidence trades.',
        impact: 'high',
      });
    }

    // Analyze timing
    const hourCounts = Array(24).fill(0);
    const hourProfits = Array(24).fill(0);

    trades.forEach(trade => {
      const hour = new Date(trade.created_at).getHours();
      hourCounts[hour]++;
      hourProfits[hour] += trade.actual_profit_usd || trade.expected_profit_usd || 0;
    });

    const bestHour = hourProfits.reduce((best, profit, hour) =>
      profit > hourProfits[best] ? hour : best, 0);
    const worstHour = hourProfits.reduce((worst, profit, hour) =>
      profit < hourProfits[worst] ? hour : worst, 0);

    if (hourCounts[bestHour] >= 3) {
      results.push({
        id: 'best-time',
        type: 'opportunity',
        category: 'timing',
        title: 'Peak Trading Hour Identified',
        description: `Your most profitable hour is ${bestHour}:00 UTC. Markets tend to have the best spreads during this time.`,
        metric: `${bestHour}:00 UTC - ${formatCurrency(hourProfits[bestHour])} profit`,
        action: 'Consider increasing trade size during this hour for maximum returns.',
        impact: 'medium',
      });
    }

    if (hourProfits[worstHour] < 0 && hourCounts[worstHour] >= 3) {
      results.push({
        id: 'worst-time',
        type: 'warning',
        category: 'timing',
        title: 'Unprofitable Trading Hour',
        description: `${worstHour}:00 UTC has been consistently unprofitable. Consider reducing activity during this time.`,
        metric: `${worstHour}:00 UTC - ${formatCurrency(hourProfits[worstHour])} loss`,
        action: 'Add this hour to your trading blacklist to avoid losses.',
        impact: 'medium',
      });
    }

    // Analyze position sizing
    const avgPositionSize = trades.reduce((sum, t) => sum + (t.position_size_usd || 0), 0) / trades.length;
    const smallTrades = trades.filter(t => (t.position_size_usd || 0) < avgPositionSize * 0.5);
    const largeTrades = trades.filter(t => (t.position_size_usd || 0) > avgPositionSize * 1.5);

    const smallTradeWinRate = smallTrades.filter(t => t.outcome === 'won').length /
      smallTrades.filter(t => t.outcome !== 'pending').length * 100 || 0;
    const largeTradeWinRate = largeTrades.filter(t => t.outcome === 'won').length /
      largeTrades.filter(t => t.outcome !== 'pending').length * 100 || 0;

    if (smallTradeWinRate > largeTradeWinRate + 10 && largeTrades.length >= 5) {
      results.push({
        id: 'size-correlation',
        type: 'warning',
        category: 'sizing',
        title: 'Large Trades Underperforming',
        description: 'Smaller position sizes have a significantly higher win rate than larger positions.',
        metric: `Small: ${smallTradeWinRate.toFixed(0)}% vs Large: ${largeTradeWinRate.toFixed(0)}%`,
        action: 'Consider reducing maximum trade size to improve overall performance.',
        impact: 'high',
      });
    }

    // ========== PLATFORM ANALYSIS (ALL 5 PLATFORMS) ==========

    // Categorize trades by platform
    const polyTrades = trades.filter(t => t.polymarket_token_id && !t.kalshi_ticker);
    const kalshiTrades = trades.filter(t => t.kalshi_ticker && !t.polymarket_token_id);
    const binanceTrades = trades.filter(t =>
      t.arbitrage_type?.includes('binance') ||
      t.trade_type?.includes('binance') ||
      t.strategy_type?.includes('binance') ||
      (t as any).exchange?.toLowerCase()?.includes('binance')
    );
    const coinbaseTrades = trades.filter(t =>
      t.arbitrage_type?.includes('coinbase') ||
      t.trade_type?.includes('coinbase') ||
      t.strategy_type?.includes('coinbase') ||
      (t as any).exchange?.toLowerCase()?.includes('coinbase')
    );
    const alpacaTrades = trades.filter(t =>
      t.arbitrage_type?.includes('alpaca') ||
      t.trade_type?.includes('stock') ||
      t.strategy_type?.includes('stock') ||
      (t as any).exchange?.toLowerCase()?.includes('alpaca')
    );

    // Calculate profit by platform
    const platformProfits: Record<string, { profit: number; trades: number; winRate: number }> = {
      Polymarket: {
        profit: polyTrades.reduce((sum, t) => sum + (t.actual_profit_usd || t.expected_profit_usd || 0), 0),
        trades: polyTrades.length,
        winRate: polyTrades.filter(t => t.outcome === 'won').length / Math.max(1, polyTrades.filter(t => t.outcome !== 'pending').length) * 100,
      },
      Kalshi: {
        profit: kalshiTrades.reduce((sum, t) => sum + (t.actual_profit_usd || t.expected_profit_usd || 0), 0),
        trades: kalshiTrades.length,
        winRate: kalshiTrades.filter(t => t.outcome === 'won').length / Math.max(1, kalshiTrades.filter(t => t.outcome !== 'pending').length) * 100,
      },
      Binance: {
        profit: binanceTrades.reduce((sum, t) => sum + (t.actual_profit_usd || t.expected_profit_usd || 0), 0),
        trades: binanceTrades.length,
        winRate: binanceTrades.filter(t => t.outcome === 'won').length / Math.max(1, binanceTrades.filter(t => t.outcome !== 'pending').length) * 100,
      },
      Coinbase: {
        profit: coinbaseTrades.reduce((sum, t) => sum + (t.actual_profit_usd || t.expected_profit_usd || 0), 0),
        trades: coinbaseTrades.length,
        winRate: coinbaseTrades.filter(t => t.outcome === 'won').length / Math.max(1, coinbaseTrades.filter(t => t.outcome !== 'pending').length) * 100,
      },
      Alpaca: {
        profit: alpacaTrades.reduce((sum, t) => sum + (t.actual_profit_usd || t.expected_profit_usd || 0), 0),
        trades: alpacaTrades.length,
        winRate: alpacaTrades.filter(t => t.outcome === 'won').length / Math.max(1, alpacaTrades.filter(t => t.outcome !== 'pending').length) * 100,
      },
    };

    // Find best and worst performing platforms
    const activePlatforms = Object.entries(platformProfits).filter(([_, data]) => data.trades >= 3);
    if (activePlatforms.length >= 2) {
      const sortedPlatforms = activePlatforms.sort((a, b) => b[1].profit - a[1].profit);
      const [bestPlatform, bestData] = sortedPlatforms[0];
      const [worstPlatform, worstData] = sortedPlatforms[sortedPlatforms.length - 1];

      if (bestData.profit > 0) {
        results.push({
          id: 'best-platform',
          type: 'success',
          category: 'platform',
          title: `${bestPlatform} Leading Profits`,
          description: `${bestPlatform} is your top performer with ${formatCurrency(bestData.profit)} profit across ${bestData.trades} trades.`,
          metric: `${bestData.winRate.toFixed(1)}% Win Rate | ${formatCurrency(bestData.profit)} P&L`,
          action: `Consider increasing allocation to ${bestPlatform} for maximum returns.`,
          impact: 'high',
        });
      }

      if (worstData.profit < -10) {
        results.push({
          id: 'worst-platform',
          type: 'warning',
          category: 'platform',
          title: `${worstPlatform} Underperforming`,
          description: `${worstPlatform} has lost ${formatCurrency(Math.abs(worstData.profit))} across ${worstData.trades} trades.`,
          metric: `${worstData.winRate.toFixed(1)}% Win Rate | ${formatCurrency(worstData.profit)} P&L`,
          action: `Review your ${worstPlatform} strategy or reduce allocation.`,
          impact: 'high',
        });
      }
    }

    // Crypto-specific insights
    const cryptoTrades = [...binanceTrades, ...coinbaseTrades];
    if (cryptoTrades.length >= 5) {
      const cryptoProfit = cryptoTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
      const cryptoWinRate = cryptoTrades.filter(t => t.outcome === 'won').length /
        Math.max(1, cryptoTrades.filter(t => t.outcome !== 'pending').length) * 100;

      results.push({
        id: 'crypto-performance',
        type: cryptoProfit > 0 ? 'success' : 'warning',
        category: 'crypto',
        title: 'Crypto Trading Performance',
        description: `Crypto strategies have generated ${formatCurrency(cryptoProfit)} across Binance and Coinbase.`,
        metric: `${cryptoTrades.length} trades | ${cryptoWinRate.toFixed(1)}% win rate`,
        action: cryptoProfit > 0
          ? 'Crypto is profitable - consider enabling more crypto strategies.'
          : 'Review crypto strategy settings or reduce position sizes.',
        impact: 'medium',
      });
    }

    // Stock trading insights
    if (alpacaTrades.length >= 3) {
      const stockProfit = alpacaTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
      const stockWinRate = alpacaTrades.filter(t => t.outcome === 'won').length /
        Math.max(1, alpacaTrades.filter(t => t.outcome !== 'pending').length) * 100;

      results.push({
        id: 'stock-performance',
        type: stockProfit > 0 ? 'success' : 'info',
        category: 'stocks',
        title: 'Stock Trading Performance',
        description: `Alpaca stock trades have generated ${formatCurrency(stockProfit)} P&L.`,
        metric: `${alpacaTrades.length} trades | ${stockWinRate.toFixed(1)}% win rate`,
        action: stockProfit > 0
          ? 'Stock strategies are working well. Consider enabling more stock strategies.'
          : 'Stock trading is in early stages. Continue monitoring performance.',
        impact: 'medium',
      });
    }

    // ========== STRATEGY-SPECIFIC ANALYSIS ==========

    // Use strategy performance data if available
    if (strategyPerf.length > 0) {
      // Find best performing strategy
      const sortedStrategies = [...strategyPerf].sort((a, b) => b.total_pnl - a.total_pnl);
      const bestStrategy = sortedStrategies[0];
      const worstStrategy = sortedStrategies[sortedStrategies.length - 1];

      if (bestStrategy && bestStrategy.total_pnl > 0 && bestStrategy.total_trades >= 3) {
        results.push({
          id: 'best-strategy',
          type: 'success',
          category: 'strategy',
          title: `${formatStrategyName(bestStrategy.strategy)} Excelling`,
          description: `Your best strategy has generated ${formatCurrency(bestStrategy.total_pnl)} with a ${bestStrategy.win_rate_pct?.toFixed(1) || 0}% win rate.`,
          metric: `${bestStrategy.total_trades} trades | ${formatCurrency(bestStrategy.avg_trade_pnl || 0)} avg/trade`,
          action: 'This strategy is working well. Consider increasing its allocation.',
          impact: 'high',
        });
      }

      if (worstStrategy && worstStrategy.total_pnl < -10 && worstStrategy.total_trades >= 3) {
        results.push({
          id: 'worst-strategy',
          type: 'warning',
          category: 'strategy',
          title: `${formatStrategyName(worstStrategy.strategy)} Struggling`,
          description: `This strategy has lost ${formatCurrency(Math.abs(worstStrategy.total_pnl))} with a ${worstStrategy.win_rate_pct?.toFixed(1) || 0}% win rate.`,
          metric: `${worstStrategy.total_trades} trades | Worst: ${formatCurrency(worstStrategy.worst_trade || 0)}`,
          action: 'Consider disabling or adjusting this strategy\'s parameters.',
          impact: 'high',
        });
      }

      // Strategy diversification insight
      const enabledStrategies = strategyPerf.filter(s => s.total_trades > 0).length;
      if (enabledStrategies === 1 && strategyPerf[0]?.total_trades >= 10) {
        results.push({
          id: 'single-strategy',
          type: 'info',
          category: 'strategy',
          title: 'Consider Diversifying Strategies',
          description: `You're only using ${formatStrategyName(strategyPerf[0].strategy)}. Diversifying across multiple strategies can reduce risk.`,
          action: 'Enable additional strategies like funding rate arb, grid trading, or stock mean reversion.',
          impact: 'medium',
        });
      }

      // Analyze specific strategy types
      const fundingRateStrat = strategyPerf.find(s => s.strategy?.includes('funding'));
      if (fundingRateStrat && fundingRateStrat.total_trades >= 3) {
        results.push({
          id: 'funding-rate',
          type: fundingRateStrat.total_pnl > 0 ? 'success' : 'info',
          category: 'crypto',
          title: 'Funding Rate Arbitrage',
          description: `Funding rate strategy: ${formatCurrency(fundingRateStrat.total_pnl)} P&L from ${fundingRateStrat.total_trades} trades.`,
          metric: `${fundingRateStrat.win_rate_pct?.toFixed(1) || 0}% win rate`,
          impact: 'medium',
        });
      }

      const gridStrat = strategyPerf.find(s => s.strategy?.includes('grid'));
      if (gridStrat && gridStrat.total_trades >= 3) {
        results.push({
          id: 'grid-trading',
          type: gridStrat.total_pnl > 0 ? 'success' : 'info',
          category: 'crypto',
          title: 'Grid Trading Performance',
          description: `Grid trading: ${formatCurrency(gridStrat.total_pnl)} P&L from ${gridStrat.total_trades} trades.`,
          metric: `${gridStrat.win_rate_pct?.toFixed(1) || 0}% win rate`,
          impact: 'medium',
        });
      }

      const pairsStrat = strategyPerf.find(s => s.strategy?.includes('pair'));
      if (pairsStrat && pairsStrat.total_trades >= 3) {
        results.push({
          id: 'pairs-trading',
          type: pairsStrat.total_pnl > 0 ? 'success' : 'info',
          category: 'crypto',
          title: 'Pairs Trading Performance',
          description: `Pairs trading: ${formatCurrency(pairsStrat.total_pnl)} P&L from ${pairsStrat.total_trades} trades.`,
          metric: `${pairsStrat.win_rate_pct?.toFixed(1) || 0}% win rate`,
          impact: 'medium',
        });
      }

      // Stock strategies
      const stockStrategies = strategyPerf.filter(s =>
        s.strategy?.includes('stock') ||
        s.strategy?.includes('momentum') ||
        s.strategy?.includes('mean_reversion') ||
        s.strategy?.includes('sector') ||
        s.strategy?.includes('dividend') ||
        s.strategy?.includes('earnings')
      );

      if (stockStrategies.length > 0) {
        const totalStockPnl = stockStrategies.reduce((sum, s) => sum + s.total_pnl, 0);
        const totalStockTrades = stockStrategies.reduce((sum, s) => sum + s.total_trades, 0);

        if (totalStockTrades >= 5) {
          results.push({
            id: 'stock-strategies',
            type: totalStockPnl > 0 ? 'success' : 'info',
            category: 'stocks',
            title: 'Stock Strategy Overview',
            description: `${stockStrategies.length} stock strategies active: ${formatCurrency(totalStockPnl)} total P&L.`,
            metric: `${totalStockTrades} trades across ${stockStrategies.map(s => formatStrategyName(s.strategy)).join(', ')}`,
            impact: 'medium',
          });
        }
      }
    }

    // Analyze spread opportunities
    const avgSpread = opportunities.reduce((sum, o) => sum + (o.profit_percent || 0), 0) / opportunities.length;
    const highSpreadOpps = opportunities.filter(o => (o.profit_percent || 0) > avgSpread * 1.5);

    if (highSpreadOpps.length > opportunities.length * 0.1) {
      results.push({
        id: 'spread-opportunities',
        type: 'opportunity',
        category: 'performance',
        title: 'High-Spread Opportunities Available',
        description: `${((highSpreadOpps.length / opportunities.length) * 100).toFixed(0)}% of opportunities have spreads above average. Consider being more aggressive.`,
        metric: `Average Spread: ${avgSpread.toFixed(2)}%`,
        action: 'Lower the minimum profit threshold slightly to capture more opportunities.',
        impact: 'medium',
      });
    }

    // Risk analysis
    const consecutiveLosses = trades.reduce((max, trade, i) => {
      if (trade.outcome !== 'lost') return { current: 0, max: max.max };
      const newCurrent = max.current + 1;
      return { current: newCurrent, max: Math.max(max.max, newCurrent) };
    }, { current: 0, max: 0 }).max;

    if (consecutiveLosses >= 3) {
      results.push({
        id: 'consecutive-losses',
        type: 'warning',
        category: 'risk',
        title: 'Losing Streak Detected',
        description: `You experienced ${consecutiveLosses} consecutive losses. This may indicate changing market conditions.`,
        metric: `${consecutiveLosses} consecutive losses`,
        action: 'Consider pausing trading temporarily to reassess market conditions.',
        impact: 'high',
      });
    }

    // Add general performance insight
    const totalPnL = stats?.total_pnl || 0;
    const roi = stats?.stats_json?.roi_pct || 0;

    if (totalPnL > 0) {
      results.push({
        id: 'positive-pnl',
        type: 'success',
        category: 'performance',
        title: 'Profitable Overall',
        description: `Your total P&L is positive at ${formatCurrency(totalPnL)}. The strategy is generating returns.`,
        metric: `${roi.toFixed(1)}% ROI`,
        impact: 'high',
      });
    } else if (totalPnL < -50) {
      results.push({
        id: 'negative-pnl',
        type: 'warning',
        category: 'risk',
        title: 'Overall Loss',
        description: `Your total P&L is ${formatCurrency(totalPnL)}. Review your strategy settings.`,
        metric: `${roi.toFixed(1)}% ROI`,
        action: 'Consider reducing position sizes or enabling only profitable strategies.',
        impact: 'high',
      });
    }

    // Diversification insight - updated to check all platforms
    const arbTrades = trades.filter(t => t.polymarket_token_id && t.kalshi_ticker);
    const arbPercent = (arbTrades.length / Math.max(1, trades.length)) * 100;

    // Platform diversity check
    const platformsWithTrades = Object.values(platformProfits).filter(p => p.trades > 0).length;
    if (platformsWithTrades === 1 && trades.length > 20) {
      results.push({
        id: 'single-platform',
        type: 'info',
        category: 'platform',
        title: 'Single Platform Trading',
        description: 'All trades are on one platform. Consider enabling additional platforms for diversification.',
        action: 'Enable Binance for crypto, Alpaca for stocks, or both prediction markets.',
        impact: 'medium',
      });
    } else if (platformsWithTrades >= 3) {
      results.push({
        id: 'well-diversified',
        type: 'success',
        category: 'platform',
        title: 'Well Diversified',
        description: `You're trading on ${platformsWithTrades} platforms. Good diversification reduces risk.`,
        impact: 'low',
      });
    }

    if (arbPercent < 30 && trades.length > 10 && polyTrades.length > 0 && kalshiTrades.length > 0) {
      results.push({
        id: 'low-arb',
        type: 'info',
        category: 'platform',
        title: 'Low Arbitrage Activity',
        description: `Only ${arbPercent.toFixed(0)}% of trades are cross-platform arbitrage. More arb opportunities may be available.`,
        action: 'Ensure both platforms are enabled and API connections are stable.',
        impact: 'low',
      });
    }

    return results;
  }, [trades, opportunities, stats, strategyPerf]);

  // Generate Strategy Tuning Recommendations
  const tuningRecommendations = useMemo<TuningRecommendation[]>(() => {
    const recommendations: TuningRecommendation[] = [];
    if (!config) return recommendations;

    // Get opportunity stats (cast to any for dynamic properties)
    const kalshiOpps = opportunities.filter((o: any) => o.platform === 'kalshi' || o.kalshi_ticker);
    const polyOpps = opportunities.filter((o: any) => o.platform === 'polymarket' || o.polymarket_token_id);
    const avgKalshiProfit = kalshiOpps.length > 0
      ? kalshiOpps.reduce((sum, o: any) => sum + (o.profit_percent || 0), 0) / kalshiOpps.length
      : 0;
    const avgPolyProfit = polyOpps.length > 0
      ? polyOpps.reduce((sum, o: any) => sum + (o.profit_percent || 0), 0) / polyOpps.length
      : 0;

    // Analyze trade performance by strategy
    const kalshiTrades = trades.filter(t => t.kalshi_ticker);
    const polyTrades = trades.filter(t => t.polymarket_token_id && !t.kalshi_ticker);
    const kalshiWinRate = kalshiTrades.filter(t => t.outcome === 'won').length / Math.max(1, kalshiTrades.filter(t => t.outcome !== 'pending').length) * 100;
    const polyWinRate = polyTrades.filter(t => t.outcome === 'won').length / Math.max(1, polyTrades.filter(t => t.outcome !== 'pending').length) * 100;

    // ============ KALSHI TUNING ============
    const kalshiMinProfit = config.kalshi_single_min_profit_pct || 3;

    // If few Kalshi trades but many opportunities with lower spreads
    if (kalshiTrades.length < 5 && kalshiOpps.length > 20) {
      const oppsAboveThreshold = kalshiOpps.filter(o => (o.profit_percent || 0) >= kalshiMinProfit).length;
      const oppsBelowThreshold = kalshiOpps.filter(o => (o.profit_percent || 0) >= kalshiMinProfit * 0.5 && (o.profit_percent || 0) < kalshiMinProfit).length;

      if (oppsBelowThreshold > oppsAboveThreshold * 0.5) {
        const suggestedMin = Math.max(1, kalshiMinProfit * 0.6);
        recommendations.push({
          id: 'kalshi-lower-threshold',
          strategy: 'Kalshi Single-Platform Arb',
          parameter: 'kalshi_single_min_profit_pct',
          currentValue: `${kalshiMinProfit}%`,
          recommendedValue: `${suggestedMin.toFixed(1)}%`,
          reason: `${oppsBelowThreshold} opportunities exist below your ${kalshiMinProfit}% threshold. Lowering it could capture ${Math.round(oppsBelowThreshold * 0.7)} more trades.`,
          impact: 'increase_trades',
          confidence: 'high',
          priority: 9,
        });
      }
    }

    // If Kalshi has high win rate, increase position size
    if (kalshiWinRate > 65 && kalshiTrades.length >= 10) {
      const currentPos = config.kalshi_single_max_position_usd || 50;
      recommendations.push({
        id: 'kalshi-increase-position',
        strategy: 'Kalshi Single-Platform Arb',
        parameter: 'kalshi_single_max_position_usd',
        currentValue: `$${currentPos}`,
        recommendedValue: `$${Math.round(currentPos * 1.5)}`,
        reason: `${kalshiWinRate.toFixed(0)}% win rate is excellent. Increase position size to maximize returns on high-confidence trades.`,
        impact: 'increase_profit',
        confidence: 'high',
        priority: 8,
      });
    }

    // If Kalshi has low win rate, increase threshold
    if (kalshiWinRate < 45 && kalshiTrades.length >= 5) {
      recommendations.push({
        id: 'kalshi-increase-threshold',
        strategy: 'Kalshi Single-Platform Arb',
        parameter: 'kalshi_single_min_profit_pct',
        currentValue: `${kalshiMinProfit}%`,
        recommendedValue: `${(kalshiMinProfit * 1.5).toFixed(1)}%`,
        reason: `${kalshiWinRate.toFixed(0)}% win rate is below target. Higher threshold will select only stronger opportunities.`,
        impact: 'reduce_risk',
        confidence: 'high',
        priority: 9,
      });
    }

    // ============ POLYMARKET TUNING ============
    const polyMinProfit = config.poly_single_min_profit_pct || 0.5;

    if (polyTrades.length < 5 && polyOpps.length > 20) {
      recommendations.push({
        id: 'poly-lower-threshold',
        strategy: 'Polymarket Single-Platform Arb',
        parameter: 'poly_single_min_profit_pct',
        currentValue: `${polyMinProfit}%`,
        recommendedValue: `${Math.max(0.3, polyMinProfit * 0.7).toFixed(1)}%`,
        reason: `Only ${polyTrades.length} Polymarket trades executed. ${polyOpps.length} opportunities available - lower threshold to capture more.`,
        impact: 'increase_trades',
        confidence: 'medium',
        priority: 7,
      });
    }

    // ============ CROSS-PLATFORM ARB TUNING ============
    const crossPlatMinProfit = config.cross_plat_min_profit_buy_poly_pct || 3;
    const crossPlatSimilarity = config.cross_plat_min_similarity || 0.3;

    // If not finding cross-platform opportunities
    if (!trades.some(t => t.polymarket_token_id && t.kalshi_ticker)) {
      recommendations.push({
        id: 'cross-plat-similarity',
        strategy: 'Cross-Platform Arbitrage',
        parameter: 'cross_plat_min_similarity',
        currentValue: crossPlatSimilarity,
        recommendedValue: Math.max(0.2, crossPlatSimilarity - 0.1).toFixed(2),
        reason: 'No cross-platform arbitrage trades found. Lowering similarity threshold may find more matching markets.',
        impact: 'increase_trades',
        confidence: 'medium',
        priority: 7,
      });

      recommendations.push({
        id: 'cross-plat-profit',
        strategy: 'Cross-Platform Arbitrage',
        parameter: 'cross_plat_min_profit_buy_poly_pct',
        currentValue: `${crossPlatMinProfit}%`,
        recommendedValue: `${Math.max(1.5, crossPlatMinProfit * 0.6).toFixed(1)}%`,
        reason: 'Consider lowering profit threshold to find more cross-platform arbitrage opportunities.',
        impact: 'increase_trades',
        confidence: 'medium',
        priority: 6,
      });
    }

    // ============ CRYPTO STRATEGY TUNING ============
    if (config.enable_funding_rate_arb) {
      const fundingMinRate = config.funding_min_rate_pct || 0.03;
      const fundingMinApy = config.funding_min_apy || 30;

      // Check if funding rate strategy is finding trades
      const fundingTrades = trades.filter(t =>
        t.strategy_type?.includes('funding') || t.arbitrage_type?.includes('funding')
      );

      if (fundingTrades.length === 0 && trades.length > 10) {
        recommendations.push({
          id: 'funding-lower-rate',
          strategy: 'Funding Rate Arbitrage',
          parameter: 'funding_min_rate_pct',
          currentValue: `${fundingMinRate}%`,
          recommendedValue: `${Math.max(0.01, fundingMinRate * 0.5).toFixed(3)}%`,
          reason: 'No funding rate trades executed. Current threshold may be too restrictive for current market conditions.',
          impact: 'increase_trades',
          confidence: 'medium',
          priority: 6,
        });

        recommendations.push({
          id: 'funding-lower-apy',
          strategy: 'Funding Rate Arbitrage',
          parameter: 'funding_min_apy',
          currentValue: `${fundingMinApy}%`,
          recommendedValue: `${Math.max(15, fundingMinApy * 0.6).toFixed(0)}%`,
          reason: 'Lower minimum APY target to capture more funding rate opportunities in quieter markets.',
          impact: 'increase_trades',
          confidence: 'medium',
          priority: 5,
        });
      }
    }

    // ============ GRID TRADING TUNING ============
    if (config.enable_grid_trading) {
      const gridRange = config.grid_default_range_pct || 10;
      const gridLevels = config.grid_default_levels || 20;

      const gridTrades = trades.filter(t => t.strategy_type?.includes('grid'));

      if (gridTrades.length === 0 && trades.length > 10) {
        recommendations.push({
          id: 'grid-increase-range',
          strategy: 'Grid Trading',
          parameter: 'grid_default_range_pct',
          currentValue: `${gridRange}%`,
          recommendedValue: `${Math.min(20, gridRange * 1.5).toFixed(0)}%`,
          reason: 'No grid trades executed. Wider range captures more price movements in volatile markets.',
          impact: 'increase_trades',
          confidence: 'medium',
          priority: 5,
        });
      }
    }

    // ============ STOCK STRATEGY TUNING ============
    if (config.enable_stock_mean_reversion) {
      const mrZscore = config.stock_mr_entry_zscore || 2;
      const mrStopLoss = config.stock_mr_stop_loss_pct || 5;

      const stockTrades = trades.filter(t =>
        t.strategy_type?.includes('stock') || t.strategy_type?.includes('mean_reversion')
      );

      if (stockTrades.length === 0 && trades.length > 10) {
        recommendations.push({
          id: 'stock-mr-zscore',
          strategy: 'Stock Mean Reversion',
          parameter: 'stock_mr_entry_zscore',
          currentValue: mrZscore,
          recommendedValue: Math.max(1.5, mrZscore - 0.5).toFixed(1),
          reason: 'No mean reversion trades found. Lower Z-score threshold to capture more reversion opportunities.',
          impact: 'increase_trades',
          confidence: 'medium',
          priority: 6,
        });
      }
    }

    if (config.enable_stock_momentum) {
      const momThreshold = config.stock_mom_entry_threshold || 5;

      const momTrades = trades.filter(t => t.strategy_type?.includes('momentum'));

      if (momTrades.length === 0 && trades.length > 10) {
        recommendations.push({
          id: 'stock-mom-threshold',
          strategy: 'Stock Momentum',
          parameter: 'stock_mom_entry_threshold',
          currentValue: `${momThreshold}%`,
          recommendedValue: `${Math.max(3, momThreshold - 1.5).toFixed(1)}%`,
          reason: 'No momentum trades found. Lower entry threshold to catch earlier momentum signals.',
          impact: 'increase_trades',
          confidence: 'medium',
          priority: 5,
        });
      }
    }

    // ============ PAIRS TRADING TUNING ============
    if (config.enable_pairs_trading) {
      const pairsZscore = config.pairs_entry_zscore || 2;

      const pairsTrades = trades.filter(t => t.strategy_type?.includes('pair'));

      if (pairsTrades.length === 0 && trades.length > 10) {
        recommendations.push({
          id: 'pairs-zscore',
          strategy: 'Pairs Trading',
          parameter: 'pairs_entry_zscore',
          currentValue: pairsZscore,
          recommendedValue: Math.max(1.5, pairsZscore - 0.3).toFixed(1),
          reason: 'No pairs trades found. Lower Z-score entry to capture more mean reversion opportunities between correlated pairs.',
          impact: 'increase_trades',
          confidence: 'medium',
          priority: 5,
        });
      }
    }

    // ============ GENERAL TUNING ============
    // If overall win rate is high, suggest increasing position sizes
    const completedTrades = trades.filter(t => t.outcome !== 'pending');
    const overallWinRate = completedTrades.filter(t => t.outcome === 'won').length / Math.max(1, completedTrades.length) * 100;

    if (overallWinRate > 60 && completedTrades.length >= 20) {
      const currentMaxPos = config.max_position_usd || 100;
      recommendations.push({
        id: 'overall-increase-position',
        strategy: 'Global Settings',
        parameter: 'max_position_usd',
        currentValue: `$${currentMaxPos}`,
        recommendedValue: `$${Math.round(currentMaxPos * 1.25)}`,
        reason: `${overallWinRate.toFixed(0)}% overall win rate is strong. Consider slightly larger positions to maximize returns.`,
        impact: 'increase_profit',
        confidence: 'high',
        priority: 7,
      });
    }

    // If overall win rate is low, suggest tighter thresholds
    if (overallWinRate < 45 && completedTrades.length >= 10) {
      const currentMinProfit = config.min_profit_percent || 5;
      recommendations.push({
        id: 'overall-increase-min-profit',
        strategy: 'Global Settings',
        parameter: 'min_profit_percent',
        currentValue: `${currentMinProfit}%`,
        recommendedValue: `${(currentMinProfit * 1.3).toFixed(1)}%`,
        reason: `${overallWinRate.toFixed(0)}% win rate needs improvement. Higher profit threshold filters out weaker opportunities.`,
        impact: 'reduce_risk',
        confidence: 'high',
        priority: 8,
      });
    }

    // Filter out recommendations where current value already matches recommended value
    const filteredRecommendations = recommendations.filter(rec => {
      // Normalize values for comparison
      const normalizeValue = (val: string | number): number => {
        if (typeof val === 'number') return val;
        // Remove $ and % symbols and parse
        const cleaned = val.replace(/[$%]/g, '').trim();
        return parseFloat(cleaned) || 0;
      };

      const currentNum = normalizeValue(rec.currentValue);
      const recommendedNum = normalizeValue(rec.recommendedValue);

      // Consider values "matching" if they're within 5% of each other
      if (currentNum === 0 && recommendedNum === 0) return false;
      const tolerance = Math.abs(recommendedNum) * 0.05 || 0.01;
      const isAlreadyApplied = Math.abs(currentNum - recommendedNum) <= tolerance;

      return !isAlreadyApplied;
    });

    // Sort by priority
    return filteredRecommendations.sort((a, b) => b.priority - a.priority);
  }, [trades, opportunities, config]);

  const filteredInsights = filter === 'all'
    ? insights
    : insights.filter(i => i.category === filter);

  const categories = ['all', 'performance', 'timing', 'sizing', 'platform', 'strategy', 'crypto', 'stocks', 'risk'] as const;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-neon-purple" />
            AI Insights
          </h1>
          <p className="text-gray-400 mt-2">
            Machine learning analysis of your trading patterns and actionable recommendations
          </p>
        </div>

        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="card py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-neon-purple" />
            </div>
            <p className="text-2xl font-bold">{insights.length}</p>
            <p className="text-xs text-gray-500">Active Insights</p>
          </div>
          <div className="card py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-neon-green" />
            </div>
            <p className="text-2xl font-bold">{insights.filter(i => i.type === 'success').length}</p>
            <p className="text-xs text-gray-500">Positive Signals</p>
          </div>
          <div className="card py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold">{insights.filter(i => i.type === 'warning').length}</p>
            <p className="text-xs text-gray-500">Warnings</p>
          </div>
          <div className="card py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-neon-blue" />
            </div>
            <p className="text-2xl font-bold">{insights.filter(i => i.type === 'opportunity').length}</p>
            <p className="text-xs text-gray-500">Opportunities</p>
          </div>
        </motion.div>

        {/* Strategy Tuning Recommendations Section */}
        {tuningRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => setShowTuning(!showTuning)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-neon-green/20 to-neon-blue/20 rounded-lg">
                  <Settings2 className="w-6 h-6 text-neon-green" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Strategy Tuning</h2>
                  <p className="text-sm text-gray-400">AI-powered parameter recommendations to optimize your strategies</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-neon-green/20 text-neon-green rounded-full text-sm font-medium">
                  {tuningRecommendations.length} suggestions
                </span>
                <motion.div
                  animate={{ rotate: showTuning ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TrendingDown className="w-5 h-5 text-gray-400" />
                </motion.div>
              </div>
            </div>

            <AnimatePresence>
              {showTuning && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {/* RSI Controls Panel */}
                  <div className="mb-4 p-4 bg-gradient-to-r from-neon-purple/10 to-neon-blue/10 rounded-xl border border-neon-purple/30">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-neon-purple" />
                        <div>
                          <h4 className="font-semibold">RSI (Recursive Self-Improvement)</h4>
                          <p className="text-xs text-gray-400">Auto-tune parameters based on performance</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* RSI Toggle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleRSI(); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dark-border hover:border-neon-purple/50 transition-colors"
                        >
                          {rsiEnabled ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-neon-green" />
                              <span className="text-sm text-neon-green">Auto-Tune ON</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-gray-500" />
                              <span className="text-sm text-gray-400">Auto-Tune OFF</span>
                            </>
                          )}
                        </button>

                        {/* Apply All Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyAllRecommendations(tuningRecommendations);
                          }}
                          disabled={applyingRecommendations}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-neon-green to-neon-blue text-dark-bg font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {applyingRecommendations ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4" />
                              Apply All ({tuningRecommendations.length})
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Apply Result Message */}
                    {applyResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "mt-3 px-4 py-2 rounded-lg text-sm",
                          applyResult.success
                            ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        )}
                      >
                        {applyResult.success ? (
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                        )}
                        {applyResult.message}
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {tuningRecommendations.slice(0, 6).map((rec, index) => (
                      <TuningCard key={rec.id} recommendation={rec} index={index} />
                    ))}

                    {tuningRecommendations.length > 6 && (
                      <div className="text-center py-2">
                        <p className="text-sm text-gray-500">
                          +{tuningRecommendations.length - 6} more recommendations available
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quick Summary */}
                  <div className="mt-4 p-4 bg-dark-card rounded-xl border border-dark-border">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Quick Summary
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Find More Trades</p>
                        <p className="font-mono text-neon-blue">
                          {tuningRecommendations.filter(r => r.impact === 'increase_trades').length} suggestions
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Maximize Profit</p>
                        <p className="font-mono text-neon-green">
                          {tuningRecommendations.filter(r => r.impact === 'increase_profit').length} suggestions
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Reduce Risk</p>
                        <p className="font-mono text-yellow-500">
                          {tuningRecommendations.filter(r => r.impact === 'reduce_risk').length} suggestions
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Avg Confidence</p>
                        <p className="font-mono text-neon-purple">
                          {tuningRecommendations.filter(r => r.confidence === 'high').length > tuningRecommendations.length / 2 ? 'High' : 'Medium'}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm transition-colors capitalize",
                filter === cat
                  ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                  : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
              )}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => setGenerating(true)}
            className="ml-auto px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-neon-green to-neon-blue text-dark-bg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
            Refresh Analysis
          </button>
        </div>

        {/* Insights List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredInsights.map((insight, index) => (
              <InsightCard key={insight.id} insight={insight} index={index} />
            ))}
          </AnimatePresence>

          {filteredInsights.length === 0 && (
            <div className="text-center py-16">
              <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No insights for this category</h3>
              <p className="text-gray-500">Try selecting a different category or wait for more data</p>
            </div>
          )}
        </div>

        {/* Suggestion History Dropdown */}
        {suggestionHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8"
          >
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-4 bg-dark-card rounded-xl border border-dark-border hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="font-medium">Suggestion History</span>
                <span className="text-sm text-gray-500">({suggestionHistory.length} entries)</span>
              </div>
              {showHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
                    {suggestionHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 bg-dark-card/50 rounded-lg border border-dark-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {new Date(entry.timestamp).toLocaleDateString()} at {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                              Applied {entry.appliedCount}/{entry.recommendations.length}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {entry.recommendations.slice(0, 3).map((rec) => (
                            <div key={rec.id} className="text-sm text-gray-400 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-600"></span>
                              <span className="font-mono text-xs">{rec.parameter}</span>
                              <span className="text-gray-600">→</span>
                              <span className="text-gray-300">{rec.recommendedValue}</span>
                            </div>
                          ))}
                          {entry.recommendations.length > 3 && (
                            <p className="text-xs text-gray-500 pl-4">
                              +{entry.recommendations.length - 3} more changes
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* AI Recommendations Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-6 bg-gradient-to-r from-neon-purple/10 to-neon-blue/10 rounded-xl border border-neon-purple/30"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-neon-purple/20 rounded-xl">
              <Zap className="w-6 h-6 text-neon-purple" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">How AI Insights Work</h3>
              <p className="text-sm text-gray-400 mb-4">
                Our AI continuously analyzes your trading patterns, market conditions, and performance metrics
                to provide personalized recommendations. Insights are updated in real-time as new data comes in.
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Target className="w-4 h-4 text-neon-green" />
                  Win rate optimization
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4 text-neon-blue" />
                  Timing analysis
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <DollarSign className="w-4 h-4 text-yellow-500" />
                  Position sizing
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <BarChart3 className="w-4 h-4 text-neon-purple" />
                  Risk assessment
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
