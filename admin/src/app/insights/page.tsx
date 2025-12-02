'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useSimulatedTrades, 
  useOpportunities,
  useSimulationStats,
  useSimulationHistory,
} from '@/lib/hooks';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'opportunity' | 'info';
  category: 'performance' | 'timing' | 'sizing' | 'platform' | 'risk';
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

export default function InsightsPage() {
  const { data: trades = [] } = useSimulatedTrades(500);
  const { data: opportunities = [] } = useOpportunities(1000);
  const { data: stats } = useSimulationStats();
  const { data: history = [] } = useSimulationHistory(168); // Last 7 days
  
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<Insight['category'] | 'all'>('all');

  // Generate insights from data analysis
  const insights = useMemo<Insight[]>(() => {
    const results: Insight[] = [];
    
    if (!trades.length && !opportunities.length) {
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

    // Analyze platform performance
    const polyTrades = trades.filter(t => t.polymarket_token_id);
    const kalshiTrades = trades.filter(t => t.kalshi_ticker);
    
    const polyProfit = polyTrades.reduce((sum, t) => sum + (t.actual_profit_usd || t.expected_profit_usd || 0), 0);
    const kalshiProfit = kalshiTrades.reduce((sum, t) => sum + (t.actual_profit_usd || t.expected_profit_usd || 0), 0);
    
    if (polyTrades.length >= 5 && kalshiTrades.length >= 5) {
      const betterPlatform = polyProfit > kalshiProfit ? 'Polymarket' : 'Kalshi';
      const difference = Math.abs(polyProfit - kalshiProfit);
      
      if (difference > 10) {
        results.push({
          id: 'platform-perf',
          type: 'opportunity',
          category: 'platform',
          title: `${betterPlatform} Outperforming`,
          description: `${betterPlatform} has generated ${formatCurrency(difference)} more profit. Consider focusing more on this platform.`,
          metric: `Poly: ${formatCurrency(polyProfit)} | Kalshi: ${formatCurrency(kalshiProfit)}`,
          action: `Increase allocation to ${betterPlatform} trades for better returns.`,
          impact: 'medium',
        });
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
    }

    // Diversification insight
    const arbTrades = trades.filter(t => t.polymarket_token_id && t.kalshi_ticker);
    const arbPercent = (arbTrades.length / trades.length) * 100;
    
    if (arbPercent < 30 && trades.length > 10) {
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
  }, [trades, opportunities, stats]);

  const filteredInsights = filter === 'all' 
    ? insights 
    : insights.filter(i => i.category === filter);

  const categories = ['all', 'performance', 'timing', 'sizing', 'platform', 'risk'] as const;

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
