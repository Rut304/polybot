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
} from '@/lib/hooks';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { format, subDays, subHours, startOfDay, startOfHour } from 'date-fns';
import { Tooltip, LabelWithTooltip, METRIC_TOOLTIPS } from '@/components/Tooltip';

type TimeRange = '24h' | '7d' | '30d' | 'all';

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
  
  // Fetch data
  const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 2160;
  const { data: history = [] } = useSimulationHistory(hours);
  const { data: trades = [] } = useSimulatedTrades(500);
  const { data: opportunities = [] } = useOpportunities(1000);
  const { data: stats } = useSimulationStats();
  const { data: advancedMetrics } = useAdvancedAnalytics();

  // Process P&L trend data
  const pnlTrendData = useMemo(() => {
    if (!history.length) return [];
    
    return history.map(h => ({
      time: format(new Date(h.snapshot_at), timeRange === '24h' ? 'HH:mm' : 'MMM dd'),
      pnl: h.total_pnl || 0,
      balance: h.simulated_balance || 5000,
      trades: h.total_trades || 0,
    }));
  }, [history, timeRange]);

  // Process trade performance data
  const tradePerformanceData = useMemo(() => {
    const won = trades.filter(t => t.outcome === 'won').length;
    const lost = trades.filter(t => t.outcome === 'lost').length;
    const pending = trades.filter(t => t.outcome === 'pending').length;
    
    return [
      { name: 'Won', value: won, color: COLORS.green },
      { name: 'Lost', value: lost, color: COLORS.red },
      { name: 'Pending', value: pending, color: COLORS.yellow },
    ];
  }, [trades]);

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

  // Platform breakdown
  const platformData = useMemo(() => {
    const polyTrades = trades.filter(t => t.polymarket_token_id && !t.kalshi_ticker).length;
    const kalshiTrades = trades.filter(t => t.kalshi_ticker && !t.polymarket_token_id).length;
    const arbTrades = trades.filter(t => t.polymarket_token_id && t.kalshi_ticker).length;
    
    return [
      { name: 'Polymarket Only', value: polyTrades, color: COLORS.polymarket },
      { name: 'Kalshi Only', value: kalshiTrades, color: COLORS.kalshi },
      { name: 'Arbitrage', value: arbTrades, color: COLORS.purple },
    ];
  }, [trades]);

  // Hourly activity heatmap data
  const hourlyActivity = useMemo(() => {
    const hourCounts = Array(24).fill(0);
    
    trades.forEach(trade => {
      const hour = new Date(trade.created_at).getHours();
      hourCounts[hour]++;
    });
    
    return hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      trades: count,
      fill: count > 0 ? `rgba(0, 255, 136, ${Math.min(count / 10, 1)})` : 'rgba(255,255,255,0.05)',
    }));
  }, [trades]);

  // Trade size distribution
  const tradeSizeData = useMemo(() => {
    return trades
      .filter(t => t.position_size_usd)
      .map(t => ({
        size: t.position_size_usd,
        profit: t.actual_profit_usd || t.expected_profit_usd || 0,
        outcome: t.outcome,
      }));
  }, [trades]);

  // Win rate by trade size
  const winRateBySize = useMemo(() => {
    const sizeBuckets = [
      { range: '$0-25', min: 0, max: 25, wins: 0, total: 0 },
      { range: '$25-50', min: 25, max: 50, wins: 0, total: 0 },
      { range: '$50-100', min: 50, max: 100, wins: 0, total: 0 },
      { range: '$100+', min: 100, max: Infinity, wins: 0, total: 0 },
    ];
    
    trades.forEach(trade => {
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
  }, [trades]);

  // Best and worst trades
  const extremeTrades = useMemo(() => {
    const resolved = trades.filter(t => t.outcome !== 'pending' && t.actual_profit_usd != null);
    const sorted = [...resolved].sort((a, b) => (b.actual_profit_usd || 0) - (a.actual_profit_usd || 0));
    
    return {
      best: sorted.slice(0, 5),
      worst: sorted.slice(-5).reverse(),
    };
  }, [trades]);

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
            <p className="text-gray-400 mt-2">Deep dive into your trading performance</p>
          </div>

          {/* Time range selector */}
          <div className="flex bg-dark-card rounded-lg border border-dark-border p-1">
            {(['24h', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm transition-colors",
                  timeRange === range ? 'bg-neon-green/20 text-neon-green' : 'text-gray-400 hover:text-white'
                )}
              >
                {range === 'all' ? 'All Time' : range}
              </button>
            ))}
          </div>
        </div>

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
                {advancedMetrics.sharpeRatio >= 2 ? '🔥 Excellent' : 
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
