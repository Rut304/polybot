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
  Bitcoin,
  LineChart,
  Layers,
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

export default function InsightsPage() {
  const { data: trades = [] } = useSimulatedTrades(500);
  const { data: opportunities = [] } = useOpportunities(1000);
  const { data: stats } = useSimulationStats();
  const { data: history = [] } = useSimulationHistory(168); // Last 7 days
  const { data: strategyPerf = [] } = useStrategyPerformance();
  const { data: config } = useBotConfig();
  
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<Insight['category'] | 'all'>('all');

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
