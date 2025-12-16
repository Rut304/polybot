'use client';

import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Filter,
  Layers,
  CalendarRange,
  Brain,
  Sparkles,
  Timer,
  Gauge,
  Trophy,
  AlertTriangle,
  Shield,
  Flame,
  Rocket,
  CircleDollarSign,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { 
  useSimulationHistory, 
  useSimulatedTrades, 
  useOpportunities,
  useAdvancedAnalytics,
  useSimulationStats,
  useStrategyPerformance,
  useBotConfig,
} from '@/lib/hooks';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { format, subDays, subHours, startOfDay, startOfHour } from 'date-fns';
import { Tooltip, LabelWithTooltip, METRIC_TOOLTIPS } from '@/components/Tooltip';
import { StrategyBreakdown } from '@/components/StrategyBreakdown';

type TimeRange = '24h' | '7d' | '30d' | 'mtd' | 'ytd' | 'all' | 'custom';

const COLORS = {
  green: '#00ff88',
  blue: '#00d4ff',
  purple: '#8b5cf6',
  pink: '#ff0080',
  yellow: '#fbbf24',
  red: '#ef4444',
  polymarket: '#5865F2',
  kalshi: '#00C853',
};

// Custom gradient definitions for charts
const GradientDefs = () => (
  <defs>
    <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4}/>
      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0}/>
    </linearGradient>
    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.4}/>
      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
    </linearGradient>
    <linearGradient id="colorOpps" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.4}/>
      <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0}/>
    </linearGradient>
  </defs>
);

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload) return null;
  
  return (
    <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border rounded-lg p-3 shadow-xl">
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
        </p>
      ))}
    </div>
  );
};

// Helper component for metric cards with tooltip
function MetricLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
      <span>{label}</span>
      <Tooltip content={tooltip} position="top">
        <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300 cursor-help" />
      </Tooltip>
    </div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showStrategyComparison, setShowStrategyComparison] = useState(false);
  
  // Fetch config for starting balances
  const { data: config } = useBotConfig();
  
  // Calculate total starting balance across all platforms
  const totalStartingBalance = useMemo(() => {
    const polyStarting = config?.polymarket_starting_balance || 20000;
    const kalshiStarting = config?.kalshi_starting_balance || 20000;
    const binanceStarting = config?.binance_starting_balance || 20000;
    const coinbaseStarting = config?.coinbase_starting_balance || 20000;
    const alpacaStarting = config?.alpaca_starting_balance || 20000;
    return polyStarting + kalshiStarting + binanceStarting + coinbaseStarting + alpacaStarting;
  }, [config]);
  
  // Fetch data - calculate hours based on time range
  const hours = useMemo(() => {
    const now = new Date();
    switch (timeRange) {
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      case 'mtd': return Math.ceil((now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) / (1000 * 60 * 60)) || 24;
      case 'ytd': return Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60)) || 24;
      case 'custom': {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60)) || 24;
        }
        return 720;
      }
      default: return 8760; // 1 year
    }
  }, [timeRange, customStartDate, customEndDate]);
  
  const { data: history = [] } = useSimulationHistory(hours);
  const { data: trades = [] } = useSimulatedTrades(2000); // Increased to show all trades
  const { data: opportunities = [] } = useOpportunities(1000);
  const { data: stats } = useSimulationStats();
  const { data: advancedMetrics } = useAdvancedAnalytics(totalStartingBalance);
  const { data: strategies = [] } = useStrategyPerformance();
  
  // All available strategies (complete list from settings)
  const ALL_STRATEGIES = [
    // Prediction Market Strategies
    'poly_single',
    'kalshi_single', 
    'cross_platform',
    'overlapping_arb',
    // Advanced Strategies
    'market_making',
    'news_arbitrage',
    // Twitter-Derived Strategies (2024)
    'btc_bracket_arb',
    'bracket_compression',
    'kalshi_mention_snipe',
    'whale_copy_trading',
    'congressional_tracker',
    'macro_board',
    'fear_premium_contrarian',
    // NEW: High-Performance Strategies (2024)
    'crypto_15min_scalping',
    'ai_superforecasting',
    // Crypto Strategies
    'funding_rate_arb',
    'grid_trading',
    'pairs_trading',
    // Stock Strategies
    'stock_mean_reversion',
    'stock_momentum',
    'sector_rotation',
    'dividend_growth',
    'earnings_momentum',
    // Options Strategies
    'wheel_strategy',
    'iron_condor',
    'covered_calls',
    // Other
    'manual',
  ];
  
  // Get unique strategy names for filter dropdown (include all strategies)
  const strategyOptions = useMemo(() => {
    // Start with strategies that have trades
    const activeStrategies = strategies.map(s => s.strategy).filter(Boolean);
    // Merge with all defined strategies to ensure dropdown is complete
    const allStrategies = new Set([...activeStrategies, ...ALL_STRATEGIES]);
    return ['all', ...Array.from(allStrategies).sort()];
  }, [strategies]);
  
  // Filter trades by selected strategy
  const filteredTrades = useMemo(() => {
    if (selectedStrategy === 'all') return trades;
    return trades.filter(t => {
      const tradeStrategy = t.strategy_type || t.arbitrage_type || t.trade_type;
      return tradeStrategy === selectedStrategy;
    });
  }, [trades, selectedStrategy]);

  // Process P&L trend data
  const pnlTrendData = useMemo(() => {
    if (!history.length) return [];
    
    return history.map(h => ({
      time: format(new Date(h.snapshot_at), timeRange === '24h' ? 'HH:mm' : 'MMM dd'),
      pnl: h.total_pnl || 0,
      balance: h.simulated_balance || totalStartingBalance,
      trades: h.total_trades || 0,
    }));
  }, [history, timeRange, totalStartingBalance]);

  // Process trade performance data (uses filtered trades)
  const tradePerformanceData = useMemo(() => {
    const won = filteredTrades.filter(t => t.outcome === 'won').length;
    const lost = filteredTrades.filter(t => t.outcome === 'lost').length;
    const pending = filteredTrades.filter(t => t.outcome === 'pending').length;
    
    return [
      { name: 'Won', value: won, color: COLORS.green },
      { name: 'Lost', value: lost, color: COLORS.red },
      { name: 'Pending', value: pending, color: COLORS.yellow },
    ];
  }, [filteredTrades]);

  // Process opportunity spread distribution
  const spreadDistribution = useMemo(() => {
    const buckets = [
      { range: '0-1%', min: 0, max: 1, count: 0 },
      { range: '1-2%', min: 1, max: 2, count: 0 },
      { range: '2-3%', min: 2, max: 3, count: 0 },
      { range: '3-5%', min: 3, max: 5, count: 0 },
      { range: '5%+', min: 5, max: 100, count: 0 },
    ];
    
    opportunities.forEach(opp => {
      const spread = opp.profit_percent || 0;
      const bucket = buckets.find(b => spread >= b.min && spread < b.max);
      if (bucket) bucket.count++;
    });
    
    return buckets;
  }, [opportunities]);

  // Platform breakdown (uses filtered trades)
  const platformData = useMemo(() => {
    const polyTrades = filteredTrades.filter(t => t.polymarket_token_id && !t.kalshi_ticker).length;
    const kalshiTrades = filteredTrades.filter(t => t.kalshi_ticker && !t.polymarket_token_id).length;
    const arbTrades = filteredTrades.filter(t => t.polymarket_token_id && t.kalshi_ticker).length;
    
    return [
      { name: 'Polymarket Only', value: polyTrades, color: COLORS.polymarket },
      { name: 'Kalshi Only', value: kalshiTrades, color: COLORS.kalshi },
      { name: 'Arbitrage', value: arbTrades, color: COLORS.purple },
    ];
  }, [filteredTrades]);

  // Hourly activity heatmap data (uses filtered trades)
  const hourlyActivity = useMemo(() => {
    const hourCounts = Array(24).fill(0);
    
    filteredTrades.forEach(trade => {
      const hour = new Date(trade.created_at).getHours();
      hourCounts[hour]++;
    });
    
    return hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      trades: count,
      fill: count > 0 ? `rgba(0, 255, 136, ${Math.min(count / 10, 1)})` : 'rgba(255,255,255,0.05)',
    }));
  }, [filteredTrades]);

  // Trade size distribution (uses filtered trades)
  const tradeSizeData = useMemo(() => {
    return filteredTrades
      .filter(t => t.position_size_usd)
      .map(t => ({
        size: t.position_size_usd,
        profit: t.actual_profit_usd || t.expected_profit_usd || 0,
        outcome: t.outcome,
      }));
  }, [filteredTrades]);

  // Win rate by trade size (uses filtered trades)
  const winRateBySize = useMemo(() => {
    const sizeBuckets = [
      { range: '$0-25', min: 0, max: 25, wins: 0, total: 0 },
      { range: '$25-50', min: 25, max: 50, wins: 0, total: 0 },
      { range: '$50-100', min: 50, max: 100, wins: 0, total: 0 },
      { range: '$100+', min: 100, max: Infinity, wins: 0, total: 0 },
    ];
    
    filteredTrades.forEach(trade => {
      if (trade.outcome === 'pending') return;
      const size = trade.position_size_usd || 0;
      const bucket = sizeBuckets.find(b => size >= b.min && size < b.max);
      if (bucket) {
        bucket.total++;
        if (trade.outcome === 'won') bucket.wins++;
      }
    });
    
    return sizeBuckets.map(b => ({
      ...b,
      winRate: b.total > 0 ? (b.wins / b.total) * 100 : 0,
    }));
  }, [filteredTrades]);

  // Best and worst trades (uses filtered trades)
  const extremeTrades = useMemo(() => {
    const resolved = filteredTrades.filter(t => t.outcome !== 'pending' && t.actual_profit_usd != null);
    const sorted = [...resolved].sort((a, b) => (b.actual_profit_usd || 0) - (a.actual_profit_usd || 0));
    
    return {
      best: sorted.slice(0, 5),
      worst: sorted.slice(-5).reverse(),
    };
  }, [filteredTrades]);

  // Get trade count by strategy for display
  const tradeCountByStrategy = useMemo(() => {
    const counts: Record<string, number> = {};
    trades.forEach(t => {
      const strategy = t.strategy_type || t.arbitrage_type || t.trade_type || 'unknown';
      counts[strategy] = (counts[strategy] || 0) + 1;
    });
    return counts;
  }, [trades]);

  // NEW: Strategy-specific performance metrics
  const strategyMetrics = useMemo(() => {
    const metrics: Record<string, {
      trades: number;
      wins: number;
      losses: number;
      totalPnL: number;
      avgPnL: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      maxWin: number;
      maxLoss: number;
      profitFactor: number;
      lastTradeTime: Date | null;
      streak: number;
      streakType: 'win' | 'loss' | 'none';
    }> = {};

    // Initialize for new strategies
    ['crypto_15min_scalping', 'ai_superforecasting'].forEach(strategy => {
      metrics[strategy] = {
        trades: 0, wins: 0, losses: 0, totalPnL: 0, avgPnL: 0, winRate: 0,
        avgWin: 0, avgLoss: 0, maxWin: 0, maxLoss: -Infinity, profitFactor: 0,
        lastTradeTime: null, streak: 0, streakType: 'none'
      };
    });

    trades.forEach(t => {
      const strategy = t.strategy_type || t.arbitrage_type || t.trade_type;
      if (!strategy || !metrics[strategy]) return;

      const m = metrics[strategy];
      m.trades++;
      const profit = t.actual_profit_usd || t.expected_profit_usd || 0;
      m.totalPnL += profit;

      if (t.outcome === 'won') {
        m.wins++;
        m.avgWin = (m.avgWin * (m.wins - 1) + profit) / m.wins;
        m.maxWin = Math.max(m.maxWin, profit);
      } else if (t.outcome === 'lost') {
        m.losses++;
        m.avgLoss = (m.avgLoss * (m.losses - 1) + Math.abs(profit)) / m.losses;
        m.maxLoss = Math.max(m.maxLoss, Math.abs(profit));
      }

      const tradeTime = new Date(t.created_at);
      if (!m.lastTradeTime || tradeTime > m.lastTradeTime) {
        m.lastTradeTime = tradeTime;
      }
    });

    // Calculate derived metrics
    Object.values(metrics).forEach(m => {
      m.avgPnL = m.trades > 0 ? m.totalPnL / m.trades : 0;
      m.winRate = m.trades > 0 ? (m.wins / m.trades) * 100 : 0;
      const grossWins = m.avgWin * m.wins;
      const grossLosses = m.avgLoss * m.losses;
      m.profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
      if (m.maxLoss === -Infinity) m.maxLoss = 0;
    });

    return metrics;
  }, [trades]);

  // NEW: Performance leaderboard data
  const performanceLeaderboard = useMemo(() => {
    return strategies
      .filter(s => s.total_trades > 0)
      .map(s => ({
        strategy: s.strategy,
        trades: s.total_trades,
        winRate: s.win_rate || 0,
        netPnL: s.net_pnl || 0,
        roi: totalStartingBalance > 0 ? ((s.net_pnl || 0) / totalStartingBalance) * 100 : 0,
        avgTrade: s.total_trades > 0 ? (s.net_pnl || 0) / s.total_trades : 0,
        score: (s.win_rate || 0) * 0.4 + ((s.net_pnl || 0) > 0 ? 30 : 0) + Math.min((s.total_trades || 0), 30),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [strategies, totalStartingBalance]);

  // NEW: Recent trades for live feed (last 10)
  const recentTrades = useMemo(() => {
    return [...trades]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [trades]);

  // NEW: Risk metrics
  const riskMetrics = useMemo(() => {
    if (!advancedMetrics) return null;
    
    // Value at Risk (95% confidence) - simplified calculation
    const sortedDailyReturns = trades
      .filter(t => t.actual_profit_usd != null)
      .map(t => t.actual_profit_usd || 0)
      .sort((a, b) => a - b);
    
    const var95Index = Math.floor(sortedDailyReturns.length * 0.05);
    const var95 = sortedDailyReturns.length > 0 ? Math.abs(sortedDailyReturns[var95Index] || 0) : 0;
    
    // Calmar Ratio (annualized return / max drawdown)
    const annualizedReturn = advancedMetrics.avgDailyReturn * 252;
    const calmarRatio = advancedMetrics.maxDrawdown > 0 
      ? annualizedReturn / advancedMetrics.maxDrawdown 
      : annualizedReturn > 0 ? Infinity : 0;

    // Recovery Factor (net profit / max drawdown)
    const totalProfit = trades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
    const recoveryFactor = advancedMetrics.maxDrawdown > 0 
      ? totalProfit / advancedMetrics.maxDrawdown 
      : totalProfit > 0 ? Infinity : 0;

    // Kelly Criterion estimate
    const avgWin = advancedMetrics.avgWin || 1;
    const avgLoss = advancedMetrics.avgLoss || 1;
    const winProb = (advancedMetrics.profitFactor || 0) > 1 
      ? (trades.filter(t => t.outcome === 'won').length / trades.filter(t => t.outcome !== 'pending').length) || 0.5
      : 0.5;
    const kelly = winProb - ((1 - winProb) / (avgWin / avgLoss));

    return {
      var95,
      calmarRatio: isFinite(calmarRatio) ? calmarRatio : 0,
      recoveryFactor: isFinite(recoveryFactor) ? recoveryFactor : 0,
      kellyFraction: Math.max(0, Math.min(1, kelly)),
      riskAdjustedReturn: advancedMetrics.sharpeRatio * Math.sqrt(252),
    };
  }, [advancedMetrics, trades]);

  return (
    <div className="p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-neon-green" />
              Analytics
            </h1>
            <p className="text-gray-400 mt-2">
              Deep dive into your trading performance
              {selectedStrategy !== 'all' && (
                <span className="ml-2 text-neon-blue">
                  • Filtered by: {selectedStrategy.replace(/_/g, ' ')}
                </span>
              )}
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            {/* Strategy Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                title="Filter by strategy"
                aria-label="Filter by strategy"
                className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neon-green/50"
              >
                {strategyOptions.map((strategy) => {
                  const count = strategy === 'all' ? trades.length : (tradeCountByStrategy[strategy] || 0);
                  const label = strategy === 'all' 
                    ? `All Strategies (${count})` 
                    : `${strategy.replace(/_/g, ' ')} (${count})`;
                  return (
                    <option key={strategy} value={strategy}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
            
            {/* Time range selector */}
            <div className="flex bg-dark-card rounded-lg border border-dark-border p-1">
              {(['24h', '7d', '30d', 'mtd', 'ytd', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm transition-colors",
                    timeRange === range ? 'bg-neon-green/20 text-neon-green' : 'text-gray-400 hover:text-white'
                  )}
                >
                  {range === 'all' ? 'All' : range === 'mtd' ? 'MTD' : range === 'ytd' ? 'YTD' : range}
                </button>
              ))}
              <button
                onClick={() => setTimeRange('custom')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1",
                  timeRange === 'custom' ? 'bg-neon-green/20 text-neon-green' : 'text-gray-400 hover:text-white'
                )}
              >
                <CalendarRange className="w-3 h-3" />
                Custom
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {timeRange === 'custom' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="card mb-4 p-4"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  title="Start date"
                  placeholder="Start date"
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  title="End date"
                  placeholder="End date"
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    setCustomStartDate(firstDay.toISOString().split('T')[0]);
                    setCustomEndDate(today.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                  This Month
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                    setCustomStartDate(lastMonth.toISOString().split('T')[0]);
                    setCustomEndDate(lastMonthEnd.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                  Last Month
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const q1Start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
                    setCustomStartDate(q1Start.toISOString().split('T')[0]);
                    setCustomEndDate(today.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                  This Quarter
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Strategy Comparison Toggle */}
        <div className="card mb-6 p-4">
          <button
            onClick={() => setShowStrategyComparison(!showStrategyComparison)}
            className="w-full flex items-center justify-between hover:bg-gray-800/50 rounded-lg p-2 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-neon-blue" />
              <h2 className="text-lg font-semibold">Strategy Comparison</h2>
              <span className="text-xs text-gray-500">
                ({strategies.filter(s => s.net_pnl !== 0).length} active strategies)
              </span>
            </div>
            <span className="text-gray-400 text-sm">
              {showStrategyComparison ? '▼ Hide' : '▶ Show'}
            </span>
          </button>
          
          {showStrategyComparison && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-400">Strategy</th>
                    <th className="text-right py-2 px-3 text-gray-400">Trades</th>
                    <th className="text-right py-2 px-3 text-gray-400">Win Rate</th>
                    <th className="text-right py-2 px-3 text-gray-400">Net P&L</th>
                    <th className="text-right py-2 px-3 text-gray-400">Avg Trade</th>
                    <th className="text-right py-2 px-3 text-gray-400">Best Trade</th>
                    <th className="text-right py-2 px-3 text-gray-400">Worst Trade</th>
                    <th className="text-center py-2 px-3 text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies
                    .sort((a, b) => ((b.net_pnl ?? b.total_pnl) || 0) - ((a.net_pnl ?? a.total_pnl) || 0))
                    .map((strategy) => {
                      const netPnl = strategy.net_pnl ?? strategy.total_pnl ?? 0;
                      const winRate = strategy.win_rate ?? strategy.win_rate_pct ?? 0;
                      
                      return (
                        <tr key={strategy.strategy} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="py-3 px-3 font-medium">
                            {strategy.strategy?.replace(/_/g, ' ') || 'Unknown'}
                          </td>
                          <td className="text-right py-3 px-3">{strategy.total_trades || 0}</td>
                          <td className="text-right py-3 px-3">
                            <span className={cn(
                              winRate >= 60 ? 'text-green-400' :
                              winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                            )}>
                              {winRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-right py-3 px-3">
                            <span className={cn(
                              netPnl >= 0 ? 'text-green-400' : 'text-red-400'
                            )}>
                              ${netPnl.toFixed(2)}
                            </span>
                          </td>
                          <td className="text-right py-3 px-3">
                            ${strategy.total_trades ? (netPnl / strategy.total_trades).toFixed(2) : '0.00'}
                          </td>
                          <td className="text-right py-3 px-3 text-green-400">
                            +${(strategy.best_trade || 0).toFixed(2)}
                          </td>
                          <td className="text-right py-3 px-3 text-red-400">
                            ${(strategy.worst_trade || 0).toFixed(2)}
                          </td>
                          <td className="text-center py-3 px-3">
                            {netPnl > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                                ✓ Profitable
                              </span>
                            ) : netPnl < 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                                ✗ Loss
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">
                                — No Data
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Strategy Performance Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-neon-purple" />
            <h2 className="text-xl font-semibold">Strategy Performance</h2>
          </div>
          <StrategyBreakdown tradingMode="paper" showTitle={false} />
        </motion.div>

        {/* NEW: High-Performance Strategies Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-6 h-6 text-neon-pink" />
            <h2 className="text-xl font-semibold">High-Performance Strategies</h2>
            <span className="text-xs bg-neon-pink/20 text-neon-pink px-2 py-0.5 rounded-full">NEW</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 15-Min Crypto Scalping Card */}
            <div className="card bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-transparent border-yellow-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <Timer className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">15-Min Crypto Scalping</h3>
                    <p className="text-xs text-gray-400">High-frequency BTC/ETH binary options</p>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium",
                  strategyMetrics['crypto_15min_scalping']?.trades > 0 
                    ? "bg-green-500/20 text-green-400" 
                    : "bg-gray-500/20 text-gray-400"
                )}>
                  {strategyMetrics['crypto_15min_scalping']?.trades > 0 ? '● Active' : '○ Inactive'}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Trades</div>
                  <div className="text-xl font-bold text-white">
                    {strategyMetrics['crypto_15min_scalping']?.trades || 0}
                  </div>
                </div>
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Win Rate</div>
                  <div className={cn(
                    "text-xl font-bold",
                    (strategyMetrics['crypto_15min_scalping']?.winRate || 0) >= 60 ? "text-green-400" : 
                    (strategyMetrics['crypto_15min_scalping']?.winRate || 0) >= 40 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {(strategyMetrics['crypto_15min_scalping']?.winRate || 0).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">P&L</div>
                  <div className={cn(
                    "text-xl font-bold",
                    (strategyMetrics['crypto_15min_scalping']?.totalPnL || 0) >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {formatCurrency(strategyMetrics['crypto_15min_scalping']?.totalPnL || 0)}
                  </div>
                </div>
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Avg Trade</div>
                  <div className={cn(
                    "text-xl font-bold",
                    (strategyMetrics['crypto_15min_scalping']?.avgPnL || 0) >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {formatCurrency(strategyMetrics['crypto_15min_scalping']?.avgPnL || 0)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700/50 pt-3">
                <span>🎯 Target: 90%+ confidence threshold</span>
                <span>
                  {strategyMetrics['crypto_15min_scalping']?.lastTradeTime 
                    ? `Last: ${format(strategyMetrics['crypto_15min_scalping'].lastTradeTime, 'MMM dd HH:mm')}`
                    : 'No trades yet'}
                </span>
              </div>
            </div>

            {/* AI Superforecasting Card */}
            <div className="card bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent border-purple-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Brain className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">AI Superforecasting</h3>
                    <p className="text-xs text-gray-400">Gemini-powered market predictions</p>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium",
                  strategyMetrics['ai_superforecasting']?.trades > 0 
                    ? "bg-green-500/20 text-green-400" 
                    : "bg-gray-500/20 text-gray-400"
                )}>
                  {strategyMetrics['ai_superforecasting']?.trades > 0 ? '● Active' : '○ Inactive'}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Forecasts</div>
                  <div className="text-xl font-bold text-white">
                    {strategyMetrics['ai_superforecasting']?.trades || 0}
                  </div>
                </div>
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Accuracy</div>
                  <div className={cn(
                    "text-xl font-bold",
                    (strategyMetrics['ai_superforecasting']?.winRate || 0) >= 70 ? "text-green-400" : 
                    (strategyMetrics['ai_superforecasting']?.winRate || 0) >= 50 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {(strategyMetrics['ai_superforecasting']?.winRate || 0).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">P&L</div>
                  <div className={cn(
                    "text-xl font-bold",
                    (strategyMetrics['ai_superforecasting']?.totalPnL || 0) >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {formatCurrency(strategyMetrics['ai_superforecasting']?.totalPnL || 0)}
                  </div>
                </div>
                <div className="text-center p-2 bg-black/20 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Profit Factor</div>
                  <div className={cn(
                    "text-xl font-bold",
                    (strategyMetrics['ai_superforecasting']?.profitFactor || 0) >= 1.5 ? "text-green-400" : 
                    (strategyMetrics['ai_superforecasting']?.profitFactor || 0) >= 1 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {(strategyMetrics['ai_superforecasting']?.profitFactor || 0).toFixed(2)}x
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700/50 pt-3">
                <span>🤖 Model: Gemini 1.5 Flash</span>
                <span>
                  {strategyMetrics['ai_superforecasting']?.lastTradeTime 
                    ? `Last: ${format(strategyMetrics['ai_superforecasting'].lastTradeTime, 'MMM dd HH:mm')}`
                    : 'No forecasts yet'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* NEW: Strategy Leaderboard & Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Performance Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card lg:col-span-2"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold">Strategy Leaderboard</h3>
            </div>
            
            {performanceLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {performanceLeaderboard.map((item, index) => (
                  <div 
                    key={item.strategy}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg transition-colors",
                      index === 0 ? "bg-yellow-500/10 border border-yellow-500/30" :
                      index === 1 ? "bg-gray-400/10 border border-gray-400/30" :
                      index === 2 ? "bg-orange-500/10 border border-orange-500/30" :
                      "bg-dark-border/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                        index === 1 ? "bg-gray-400/20 text-gray-300" :
                        index === 2 ? "bg-orange-500/20 text-orange-400" :
                        "bg-gray-600/20 text-gray-400"
                      )}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.strategy?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500">{item.trades} trades</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className={cn(
                          "font-semibold",
                          item.netPnL >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {formatCurrency(item.netPnL)}
                        </p>
                        <p className="text-xs text-gray-500">{item.winRate.toFixed(1)}% win</p>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        item.roi >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {item.roi >= 0 ? '+' : ''}{item.roi.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No strategy data yet</p>
              </div>
            )}
          </motion.div>

          {/* Live Trade Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-neon-green animate-pulse" />
              <h3 className="text-lg font-semibold">Live Trade Feed</h3>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentTrades.length > 0 ? (
                recentTrades.map((trade) => (
                  <div 
                    key={trade.id}
                    className="p-2 bg-dark-border/30 rounded-lg border-l-2 transition-all hover:bg-dark-border/50"
                    style={{ 
                      borderLeftColor: trade.outcome === 'won' ? COLORS.green : 
                                       trade.outcome === 'lost' ? COLORS.red : COLORS.yellow 
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-300 truncate max-w-[150px]">
                        {(trade.strategy_type || trade.arbitrage_type || 'manual').replace(/_/g, ' ')}
                      </span>
                      <span className={cn(
                        "text-xs font-bold",
                        trade.outcome === 'won' ? "text-green-400" :
                        trade.outcome === 'lost' ? "text-red-400" : "text-yellow-400"
                      )}>
                        {trade.outcome === 'won' ? '+' : trade.outcome === 'lost' ? '' : '~'}
                        {formatCurrency(trade.actual_profit_usd || trade.expected_profit_usd || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatCurrency(trade.position_size_usd || 0)} position</span>
                      <span>{format(new Date(trade.created_at), 'HH:mm')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Waiting for trades...</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* NEW: Advanced Risk Metrics */}
        {riskMetrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-neon-blue" />
              <h2 className="text-xl font-semibold">Advanced Risk Metrics</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* VaR 95% */}
              <div className="card bg-gradient-to-br from-red-500/10 to-transparent">
                <div className="flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-gray-400">VaR (95%)</span>
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {formatCurrency(riskMetrics.var95)}
                </div>
                <div className="text-xs text-gray-500">Max loss at 95% conf.</div>
              </div>

              {/* Calmar Ratio */}
              <div className="card bg-gradient-to-br from-blue-500/10 to-transparent">
                <div className="flex items-center gap-1 mb-1">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Calmar Ratio</span>
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  riskMetrics.calmarRatio >= 1 ? "text-green-400" : "text-yellow-400"
                )}>
                  {riskMetrics.calmarRatio.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Return / Drawdown</div>
              </div>

              {/* Recovery Factor */}
              <div className="card bg-gradient-to-br from-green-500/10 to-transparent">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400">Recovery Factor</span>
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  riskMetrics.recoveryFactor >= 1 ? "text-green-400" : "text-yellow-400"
                )}>
                  {riskMetrics.recoveryFactor.toFixed(2)}x
                </div>
                <div className="text-xs text-gray-500">Profit / Max Drawdown</div>
              </div>

              {/* Kelly Fraction */}
              <div className="card bg-gradient-to-br from-purple-500/10 to-transparent">
                <div className="flex items-center gap-1 mb-1">
                  <CircleDollarSign className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-gray-400">Kelly Fraction</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {(riskMetrics.kellyFraction * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">Optimal position size</div>
              </div>

              {/* Risk-Adjusted Return */}
              <div className="card bg-gradient-to-br from-yellow-500/10 to-transparent">
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-gray-400">Ann. Risk-Adj Return</span>
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  riskMetrics.riskAdjustedReturn >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {riskMetrics.riskAdjustedReturn.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Sharpe × √252</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Advanced Risk & Performance Metrics */}
        {advancedMetrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6"
          >
            {/* Sharpe Ratio */}
            <div className="card bg-gradient-to-br from-neon-green/10 to-transparent">
              <MetricLabel label="Sharpe Ratio" tooltip={METRIC_TOOLTIPS.sharpeRatio} />
              <div className={cn(
                "text-2xl font-bold",
                advancedMetrics.sharpeRatio >= 1 ? "text-neon-green" : 
                advancedMetrics.sharpeRatio >= 0 ? "text-yellow-400" : "text-red-400"
              )}>
                {advancedMetrics.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {advancedMetrics.tradingDays < 2 ? '📊 Need 2+ days' :
                 advancedMetrics.sharpeRatio >= 2 ? '🔥 Excellent' : 
                 advancedMetrics.sharpeRatio >= 1 ? '✅ Good' : 
                 advancedMetrics.sharpeRatio >= 0 ? '⚠️ Moderate' : '❌ Poor'}
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="card bg-gradient-to-br from-red-500/10 to-transparent">
              <MetricLabel label="Max Drawdown" tooltip={METRIC_TOOLTIPS.maxDrawdown} />
              <div className="text-2xl font-bold text-red-400">
                {advancedMetrics.maxDrawdownPct.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatCurrency(advancedMetrics.maxDrawdown)}
              </div>
            </div>

            {/* Profit Factor */}
            <div className="card bg-gradient-to-br from-neon-blue/10 to-transparent">
              <MetricLabel label="Profit Factor" tooltip={METRIC_TOOLTIPS.profitFactor} />
              <div className={cn(
                "text-2xl font-bold",
                advancedMetrics.profitFactor >= 1.5 ? "text-neon-green" : 
                advancedMetrics.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"
              )}>
                {advancedMetrics.profitFactor === Infinity ? '∞' : advancedMetrics.profitFactor.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Win$/Loss$
              </div>
            </div>

            {/* Expectancy */}
            <div className="card bg-gradient-to-br from-neon-purple/10 to-transparent">
              <MetricLabel label="Expectancy" tooltip={METRIC_TOOLTIPS.expectancy} />
              <div className={cn(
                "text-2xl font-bold",
                advancedMetrics.expectancy > 0 ? "text-neon-green" : "text-red-400"
              )}>
                {formatCurrency(advancedMetrics.expectancy)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Expected per trade
              </div>
            </div>

            {/* Current Streak */}
            <div className="card bg-gradient-to-br from-yellow-500/10 to-transparent">
              <MetricLabel label="Current Streak" tooltip={METRIC_TOOLTIPS.currentStreak} />
              <div className={cn(
                "text-2xl font-bold flex items-center gap-1",
                advancedMetrics.currentStreakType === 'win' ? "text-neon-green" : 
                advancedMetrics.currentStreakType === 'loss' ? "text-red-400" : "text-gray-400"
              )}>
                {advancedMetrics.currentStreak}
                {advancedMetrics.currentStreakType === 'win' && <TrendingUp className="w-5 h-5" />}
                {advancedMetrics.currentStreakType === 'loss' && <TrendingDown className="w-5 h-5" />}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Best: {advancedMetrics.longestWinStreak}W / Worst: {advancedMetrics.longestLoseStreak}L
              </div>
            </div>

            {/* Volatility */}
            <div className="card bg-gradient-to-br from-pink-500/10 to-transparent">
              <MetricLabel label="Daily Volatility" tooltip={METRIC_TOOLTIPS.dailyVolatility} />
              <div className="text-2xl font-bold text-pink-400">
                {formatCurrency(advancedMetrics.volatility)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Avg {formatCurrency(advancedMetrics.avgDailyReturn)}/day
              </div>
            </div>
          </motion.div>
        )}

        {/* Win/Loss Analysis Cards */}
        {advancedMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">Avg Win</span>
                  <Tooltip content={METRIC_TOOLTIPS.avgWin} position="top">
                    <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>
                <TrendingUp className="w-4 h-4 text-neon-green" />
              </div>
              <div className="text-xl font-bold text-neon-green">
                {formatCurrency(advancedMetrics.avgWin)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">Avg Loss</span>
                  <Tooltip content={METRIC_TOOLTIPS.avgLoss} position="top">
                    <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-xl font-bold text-red-400">
                -{formatCurrency(advancedMetrics.avgLoss)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">Payoff Ratio</span>
                  <Tooltip content={METRIC_TOOLTIPS.payoffRatio} position="top">
                    <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>
                <Activity className="w-4 h-4 text-neon-blue" />
              </div>
              <div className="text-xl font-bold text-neon-blue">
                {advancedMetrics.payoffRatio === Infinity ? '∞' : advancedMetrics.payoffRatio.toFixed(2)}x
              </div>
              <div className="text-xs text-gray-500">Avg Win / Avg Loss</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">Trading Days</span>
                  <Tooltip content={METRIC_TOOLTIPS.tradingDays} position="top">
                    <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>
                <Calendar className="w-4 h-4 text-neon-purple" />
              </div>
              <div className="text-xl font-bold text-white">
                {advancedMetrics.tradingDays}
              </div>
              <div className="text-xs text-gray-500">
                {advancedMetrics.avgTradesPerDay.toFixed(1)} trades/day
              </div>
            </motion.div>
          </div>
        )}

        {/* Main P&L Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-neon-green" />
              P&L Trend
              <Tooltip content={METRIC_TOOLTIPS.pnlTrend} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-green" />
                <span className="text-sm text-gray-400">P&L</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-blue" />
                <span className="text-sm text-gray-400">Balance</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pnlTrendData}>
                <GradientDefs />
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                <XAxis 
                  dataKey="time" 
                  stroke="#6b7280" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#6b7280" 
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#6b7280" 
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="pnl"
                  stroke={COLORS.green}
                  fill="url(#colorPnL)"
                  strokeWidth={2}
                  name="P&L"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="balance"
                  stroke={COLORS.blue}
                  strokeWidth={2}
                  dot={false}
                  name="Balance"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Second Row - Win Rate & Platform Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Win Rate Pie */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-neon-purple" />
              Trade Outcomes
              <Tooltip content={METRIC_TOOLTIPS.tradeOutcomes} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={tradePerformanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {tradePerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Platform Breakdown */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-neon-blue" />
              Platform Distribution
              <Tooltip content={METRIC_TOOLTIPS.platformDistribution} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Spread Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-neon-pink" />
              Opportunity Spreads
              <Tooltip content={METRIC_TOOLTIPS.spreadDistribution} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spreadDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="range" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={COLORS.purple} radius={[4, 4, 0, 0]} name="Opportunities" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Third Row - Activity & Win Rate by Size */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Hourly Activity */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Trading Activity by Hour
              <Tooltip content={METRIC_TOOLTIPS.hourlyActivity} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis 
                    dataKey="hour" 
                    stroke="#6b7280" 
                    fontSize={10}
                    interval={2}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="trades" fill={COLORS.green} radius={[2, 2, 0, 0]} name="Trades" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Win Rate by Size */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-neon-green" />
              Win Rate by Position Size
              <Tooltip content={METRIC_TOOLTIPS.winRateBySize} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={winRateBySize}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="range" stroke="#6b7280" fontSize={12} />
                  <YAxis 
                    stroke="#6b7280" 
                    fontSize={12}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <RechartsTooltip 
                    content={<CustomTooltip />}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
                  />
                  <Bar dataKey="winRate" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="Win Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Best & Worst Trades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best Trades */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-neon-green" />
              Best Trades
              <Tooltip content={METRIC_TOOLTIPS.bestTrades} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="space-y-3">
              {extremeTrades.best.map((trade, i) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-neon-green">#{i + 1}</span>
                    <div>
                      <p className="font-medium line-clamp-1 text-sm">
                        {trade.polymarket_market_title || trade.kalshi_market_title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Position: {formatCurrency(trade.position_size_usd)}
                      </p>
                    </div>
                  </div>
                  <span className="text-neon-green font-bold">
                    +{formatCurrency(trade.actual_profit_usd || 0)}
                  </span>
                </div>
              ))}
              {extremeTrades.best.length === 0 && (
                <p className="text-gray-500 text-center py-4">No completed trades yet</p>
              )}
            </div>
          </motion.div>

          {/* Worst Trades */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-red-400" />
              Worst Trades
              <Tooltip content={METRIC_TOOLTIPS.worstTrades} position="right">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
              </Tooltip>
            </h2>
            <div className="space-y-3">
              {extremeTrades.worst.map((trade, i) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-red-400">#{i + 1}</span>
                    <div>
                      <p className="font-medium line-clamp-1 text-sm">
                        {trade.polymarket_market_title || trade.kalshi_market_title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Position: {formatCurrency(trade.position_size_usd)}
                      </p>
                    </div>
                  </div>
                  <span className="text-red-400 font-bold">
                    {formatCurrency(trade.actual_profit_usd || 0)}
                  </span>
                </div>
              ))}
              {extremeTrades.worst.length === 0 && (
                <p className="text-gray-500 text-center py-4">No completed trades yet</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
