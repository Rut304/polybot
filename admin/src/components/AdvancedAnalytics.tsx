'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Target,
  Zap,
  Calendar,
  Clock,
  Activity,
  BarChart3,
  Flame,
  Award,
  Percent,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ============================================
// TYPES
// ============================================
interface Trade {
  id: string | number;
  created_at: string;
  actual_profit_usd: number;
  position_size_usd: number;
  outcome: 'won' | 'lost' | 'pending' | 'failed_execution';
  strategy?: string;
  platform?: string;
}

interface AdvancedAnalyticsProps {
  trades: Trade[];
  startingBalance: number;
}

// ============================================
// ADVANCED METRICS CALCULATIONS
// ============================================
function calculateAdvancedMetrics(trades: Trade[], startingBalance: number) {
  const completedTrades = trades.filter(t => t.outcome === 'won' || t.outcome === 'lost');
  if (completedTrades.length === 0) return null;

  // Sort by date
  const sortedTrades = [...completedTrades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // === EQUITY CURVE ===
  let runningBalance = startingBalance;
  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let currentDrawdown = 0;
  let drawdownStart: string | null = null;
  let maxDrawdownDuration = 0;
  let currentDrawdownDuration = 0;

  const equityCurve: { date: string; balance: number; drawdown: number; drawdownPct: number }[] = [];
  const dailyReturns: number[] = [];
  let lastDayBalance = startingBalance;
  let lastDay = '';

  sortedTrades.forEach(trade => {
    runningBalance += trade.actual_profit_usd || 0;
    const date = new Date(trade.created_at).toISOString().split('T')[0];
    
    // Track daily returns
    if (date !== lastDay && lastDay) {
      const dailyReturn = (runningBalance - lastDayBalance) / lastDayBalance;
      dailyReturns.push(dailyReturn);
      lastDayBalance = runningBalance;
    }
    lastDay = date;

    // Update peak and drawdown
    if (runningBalance > peak) {
      peak = runningBalance;
      currentDrawdown = 0;
      currentDrawdownDuration = 0;
      drawdownStart = null;
    } else {
      currentDrawdown = peak - runningBalance;
      const currentDrawdownPct = (currentDrawdown / peak) * 100;
      
      if (currentDrawdownPct > maxDrawdownPercent) {
        maxDrawdownPercent = currentDrawdownPct;
        maxDrawdown = currentDrawdown;
      }
      
      if (!drawdownStart) drawdownStart = date;
      currentDrawdownDuration++;
      maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
    }

    equityCurve.push({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: runningBalance,
      drawdown: currentDrawdown,
      drawdownPct: (currentDrawdown / peak) * 100,
    });
  });

  // === RISK METRICS ===
  const totalPnl = runningBalance - startingBalance;
  const returns = dailyReturns.length > 0 ? dailyReturns : sortedTrades.map(t => (t.actual_profit_usd || 0) / startingBalance);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  
  // Sharpe Ratio (assuming 0% risk-free rate for simplicity)
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
  
  // Sortino Ratio (downside deviation)
  const downsideReturns = returns.filter(r => r < 0);
  const downsideDeviation = Math.sqrt(
    downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / (downsideReturns.length || 1)
  );
  const sortinoRatio = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0;
  
  // Calmar Ratio (annual return / max drawdown)
  const annualReturn = avgReturn * 252;
  const calmarRatio = maxDrawdownPercent > 0 ? (annualReturn * 100) / maxDrawdownPercent : 0;

  // === WIN/LOSS ANALYSIS ===
  const wins = sortedTrades.filter(t => t.outcome === 'won');
  const losses = sortedTrades.filter(t => t.outcome === 'lost');
  const winRate = (wins.length / sortedTrades.length) * 100;
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0) / losses.length) : 0;
  
  // Expectancy (expected $ per trade)
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
  
  // Profit Factor
  const grossProfit = wins.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Risk of Ruin (simplified Kelly-based estimate)
  const kellyCriterion = winRate > 0 && avgLoss > 0 
    ? ((winRate / 100) - ((100 - winRate) / 100) / (avgWin / avgLoss)) 
    : 0;
  const riskOfRuin = kellyCriterion <= 0 ? 100 : Math.max(0, (1 - kellyCriterion) * 100);

  // === TIME-BASED ANALYSIS ===
  // Day of week performance
  const dayOfWeekStats: Record<number, { pnl: number; trades: number; wins: number }> = {};
  for (let i = 0; i < 7; i++) dayOfWeekStats[i] = { pnl: 0, trades: 0, wins: 0 };
  
  // Hour of day performance
  const hourStats: Record<number, { pnl: number; trades: number; wins: number }> = {};
  for (let i = 0; i < 24; i++) hourStats[i] = { pnl: 0, trades: 0, wins: 0 };

  sortedTrades.forEach(trade => {
    const date = new Date(trade.created_at);
    const day = date.getDay();
    const hour = date.getHours();
    
    dayOfWeekStats[day].pnl += trade.actual_profit_usd || 0;
    dayOfWeekStats[day].trades += 1;
    if (trade.outcome === 'won') dayOfWeekStats[day].wins += 1;
    
    hourStats[hour].pnl += trade.actual_profit_usd || 0;
    hourStats[hour].trades += 1;
    if (trade.outcome === 'won') hourStats[hour].wins += 1;
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeekData = Object.entries(dayOfWeekStats).map(([day, stats]) => ({
    day: dayNames[parseInt(day)],
    pnl: stats.pnl,
    trades: stats.trades,
    winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
  }));

  const hourData = Object.entries(hourStats)
    .filter(([_, stats]) => stats.trades > 0)
    .map(([hour, stats]) => ({
      hour: `${hour}:00`,
      pnl: stats.pnl,
      trades: stats.trades,
      winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
    }));

  // === MONTHLY RETURNS GRID ===
  const monthlyReturns: Record<string, number> = {};
  sortedTrades.forEach(trade => {
    const date = new Date(trade.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyReturns[monthKey] = (monthlyReturns[monthKey] || 0) + (trade.actual_profit_usd || 0);
  });

  const monthlyData = Object.entries(monthlyReturns)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => {
      const [year, m] = month.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return {
        month: `${monthNames[parseInt(m) - 1]} ${year.slice(2)}`,
        pnl,
        pct: (pnl / startingBalance) * 100,
      };
    });

  // === CONSECUTIVE WINS/LOSSES ===
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentStreak = 0;
  let lastOutcome: string | null = null;

  sortedTrades.forEach(trade => {
    if (trade.outcome === lastOutcome) {
      currentStreak++;
    } else {
      currentStreak = 1;
      lastOutcome = trade.outcome;
    }
    
    if (trade.outcome === 'won') {
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentStreak);
    } else {
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
    }
  });

  // === R-MULTIPLE ANALYSIS ===
  // Assuming 1R = avg position size for simplicity
  const avgPositionSize = sortedTrades.reduce((sum, t) => sum + (t.position_size_usd || 0), 0) / sortedTrades.length || 1;
  const rMultiples = sortedTrades.map(t => (t.actual_profit_usd || 0) / (avgPositionSize * 0.02)); // 2% risk per trade
  const avgR = rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length;
  const totalR = rMultiples.reduce((a, b) => a + b, 0);

  return {
    // Core metrics
    totalPnl,
    currentBalance: runningBalance,
    roi: (totalPnl / startingBalance) * 100,
    
    // Risk metrics
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown,
    maxDrawdownPercent,
    currentDrawdownPct: (currentDrawdown / peak) * 100,
    maxDrawdownDuration,
    riskOfRuin,
    
    // Trade metrics
    totalTrades: sortedTrades.length,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    
    // R-Multiple
    avgR,
    totalR,
    
    // Kelly
    kellyCriterion: Math.max(0, kellyCriterion * 100),
    
    // Charts
    equityCurve,
    dayOfWeekData,
    hourData,
    monthlyData,
  };
}

// ============================================
// COMPONENTS
// ============================================

// Risk Metrics Card
function RiskMetricCard({ 
  label, 
  value, 
  icon: Icon, 
  color, 
  subtext,
  tooltip 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType;
  color: string;
  subtext?: string;
  tooltip?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-dark-card rounded-xl p-4 border border-dark-border relative group"
      title={tooltip}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </motion.div>
  );
}

// Equity Curve Chart
export function EquityCurveChart({ data, startingBalance }: { data: any[]; startingBalance: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card rounded-xl p-6 border border-dark-border"
    >
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-neon-green" />
        Equity Curve
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} />
            <YAxis 
              stroke="#666" 
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              domain={['dataMin - 1000', 'dataMax + 1000']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
              formatter={(value: number, name: string) => [
                name === 'balance' ? formatCurrency(value) : `${value.toFixed(2)}%`,
                name === 'balance' ? 'Balance' : 'Drawdown'
              ]}
            />
            <ReferenceLine y={startingBalance} stroke="#666" strokeDasharray="5 5" />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#22c55e"
              fill="url(#equityGradient)"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// Drawdown Chart
export function DrawdownChart({ data }: { data: any[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card rounded-xl p-6 border border-dark-border"
    >
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-red-500" />
        Drawdown Analysis
      </h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} />
            <YAxis 
              stroke="#666" 
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              domain={[0, 'dataMax + 5']}
              reversed
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
            />
            <Area
              type="monotone"
              dataKey="drawdownPct"
              stroke="#ef4444"
              fill="url(#drawdownGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// Day of Week Heatmap
export function DayOfWeekChart({ data }: { data: any[] }) {
  const maxPnl = Math.max(...data.map(d => Math.abs(d.pnl)));
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card rounded-xl p-6 border border-dark-border"
    >
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-neon-blue" />
        Performance by Day
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {data.map((day) => {
          const intensity = maxPnl > 0 ? Math.abs(day.pnl) / maxPnl : 0;
          const isPositive = day.pnl >= 0;
          
          return (
            <div
              key={day.day}
              className={cn(
                "rounded-lg p-3 text-center transition-all hover:scale-105",
                isPositive 
                  ? `bg-green-500/${Math.round(10 + intensity * 40)}` 
                  : `bg-red-500/${Math.round(10 + intensity * 40)}`
              )}
              style={{
                backgroundColor: isPositive 
                  ? `rgba(34, 197, 94, ${0.1 + intensity * 0.4})`
                  : `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`
              }}
            >
              <div className="text-xs text-gray-400 mb-1">{day.day}</div>
              <div className={cn(
                "text-sm font-bold",
                isPositive ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(day.pnl)}
              </div>
              <div className="text-xs text-gray-500">{day.trades} trades</div>
              <div className="text-xs text-gray-500">{day.winRate.toFixed(0)}% WR</div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Hour of Day Chart
export function HourOfDayChart({ data }: { data: any[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card rounded-xl p-6 border border-dark-border"
    >
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-neon-yellow" />
        Performance by Hour
      </h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="hour" stroke="#666" tick={{ fontSize: 9 }} />
            <YAxis stroke="#666" tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
              formatter={(value: number) => [formatCurrency(value), 'P&L']}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// Monthly Returns Grid
export function MonthlyReturnsGrid({ data }: { data: any[] }) {
  const maxPct = Math.max(...data.map(d => Math.abs(d.pct)));
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card rounded-xl p-6 border border-dark-border"
    >
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-neon-purple" />
        Monthly Returns
      </h3>
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
        {data.map((month) => {
          const intensity = maxPct > 0 ? Math.abs(month.pct) / maxPct : 0;
          const isPositive = month.pnl >= 0;
          
          return (
            <div
              key={month.month}
              className="rounded-lg p-2 text-center transition-all hover:scale-105"
              style={{
                backgroundColor: isPositive 
                  ? `rgba(34, 197, 94, ${0.15 + intensity * 0.5})`
                  : `rgba(239, 68, 68, ${0.15 + intensity * 0.5})`
              }}
            >
              <div className="text-xs text-gray-400">{month.month}</div>
              <div className={cn(
                "text-sm font-bold",
                isPositive ? "text-green-400" : "text-red-400"
              )}>
                {month.pct >= 0 ? '+' : ''}{month.pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export function AdvancedAnalytics({ trades, startingBalance }: AdvancedAnalyticsProps) {
  const metrics = useMemo(() => 
    calculateAdvancedMetrics(trades, startingBalance),
    [trades, startingBalance]
  );

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Not enough trade data for advanced analytics</p>
        <p className="text-sm text-gray-500">Complete more trades to unlock these insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* === INSTITUTIONAL-GRADE RISK METRICS === */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-6"
      >
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-neon-blue" />
          Risk-Adjusted Performance
          <span className="text-xs text-gray-500 font-normal ml-2">(Institutional Grade)</span>
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RiskMetricCard
            label="Sharpe Ratio"
            value={metrics.sharpeRatio.toFixed(2)}
            icon={Target}
            color={metrics.sharpeRatio >= 1 ? "text-green-400" : metrics.sharpeRatio >= 0 ? "text-yellow-400" : "text-red-400"}
            subtext={metrics.sharpeRatio >= 2 ? "Excellent" : metrics.sharpeRatio >= 1 ? "Good" : "Needs work"}
            tooltip="Risk-adjusted return. >1 is good, >2 is excellent"
          />
          
          <RiskMetricCard
            label="Sortino Ratio"
            value={metrics.sortinoRatio.toFixed(2)}
            icon={Shield}
            color={metrics.sortinoRatio >= 1.5 ? "text-green-400" : metrics.sortinoRatio >= 0.5 ? "text-yellow-400" : "text-red-400"}
            subtext="Downside risk focus"
            tooltip="Like Sharpe but only considers downside volatility"
          />
          
          <RiskMetricCard
            label="Calmar Ratio"
            value={metrics.calmarRatio.toFixed(2)}
            icon={TrendingUp}
            color={metrics.calmarRatio >= 1 ? "text-green-400" : "text-yellow-400"}
            subtext="Return vs drawdown"
            tooltip="Annual return divided by max drawdown"
          />
          
          <RiskMetricCard
            label="Max Drawdown"
            value={`${metrics.maxDrawdownPercent.toFixed(1)}%`}
            icon={TrendingDown}
            color={metrics.maxDrawdownPercent < 10 ? "text-green-400" : metrics.maxDrawdownPercent < 25 ? "text-yellow-400" : "text-red-400"}
            subtext={formatCurrency(metrics.maxDrawdown)}
            tooltip="Largest peak-to-trough decline"
          />
          
          <RiskMetricCard
            label="Expectancy"
            value={formatCurrency(metrics.expectancy)}
            icon={Zap}
            color={metrics.expectancy > 0 ? "text-green-400" : "text-red-400"}
            subtext="Expected $/trade"
            tooltip="Average expected profit per trade"
          />
          
          <RiskMetricCard
            label="Risk of Ruin"
            value={`${metrics.riskOfRuin.toFixed(1)}%`}
            icon={AlertTriangle}
            color={metrics.riskOfRuin < 5 ? "text-green-400" : metrics.riskOfRuin < 20 ? "text-yellow-400" : "text-red-400"}
            subtext={metrics.riskOfRuin < 5 ? "Very low" : metrics.riskOfRuin < 20 ? "Moderate" : "High risk!"}
            tooltip="Probability of catastrophic loss"
          />
        </div>
      </motion.div>

      {/* === ADDITIONAL METRICS ROW === */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Profit Factor</div>
          <div className={cn(
            "text-lg font-bold",
            metrics.profitFactor >= 1.5 ? "text-green-400" : metrics.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"
          )}>
            {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
          </div>
        </div>
        
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Kelly %</div>
          <div className="text-lg font-bold text-neon-blue">
            {metrics.kellyCriterion.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Avg R-Multiple</div>
          <div className={cn(
            "text-lg font-bold",
            metrics.avgR >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {metrics.avgR >= 0 ? '+' : ''}{metrics.avgR.toFixed(2)}R
          </div>
        </div>
        
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Total R</div>
          <div className={cn(
            "text-lg font-bold",
            metrics.totalR >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {metrics.totalR >= 0 ? '+' : ''}{metrics.totalR.toFixed(1)}R
          </div>
        </div>
        
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Win Streak</div>
          <div className="text-lg font-bold text-green-400">
            {metrics.maxConsecutiveWins}
          </div>
        </div>
        
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Loss Streak</div>
          <div className="text-lg font-bold text-red-400">
            {metrics.maxConsecutiveLosses}
          </div>
        </div>
        
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Avg Win</div>
          <div className="text-lg font-bold text-green-400">
            {formatCurrency(metrics.avgWin)}
          </div>
        </div>
        
        <div className="bg-dark-card rounded-lg p-3 border border-dark-border">
          <div className="text-xs text-gray-500 mb-1">Avg Loss</div>
          <div className="text-lg font-bold text-red-400">
            {formatCurrency(metrics.avgLoss)}
          </div>
        </div>
      </div>

      {/* === EQUITY & DRAWDOWN CHARTS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EquityCurveChart data={metrics.equityCurve} startingBalance={startingBalance} />
        <DrawdownChart data={metrics.equityCurve} />
      </div>

      {/* === TIME-BASED ANALYSIS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DayOfWeekChart data={metrics.dayOfWeekData} />
        <HourOfDayChart data={metrics.hourData} />
      </div>

      {/* === MONTHLY RETURNS === */}
      <MonthlyReturnsGrid data={metrics.monthlyData} />
    </div>
  );
}

export { STRATEGY_COLORS } from './TradingViewChart';
