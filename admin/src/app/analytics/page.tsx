'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  PieChart,
  Trees,
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Fish,
  Landmark,
  Brain,
  DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

import { useSimulatedTrades, useOpportunities, useStrategyPerformance, useBotStatus, useBotConfig } from '@/lib/hooks';
import { useTier } from '@/lib/useTier';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { StrategyPerformanceTable } from '@/components/StrategyPerformanceTable';
import { TradingModeToggle } from '@/components/TradingModeToggle';

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState(168); // 7 days default
  
  // Get current trading mode from user context
  const { isSimulation: isUserSimMode } = useTier();
  const tradingMode = isUserSimMode ? 'paper' : 'live';
  
  const { data: serverStats, isLoading: statsLoading } = useStrategyPerformance(tradingMode);
  const { data: botStatus } = useBotStatus();
  const { data: config } = useBotConfig();
  const { data: trades } = useSimulatedTrades(2000, tradingMode);

  const isSimulation = botStatus?.mode !== 'live';

  // === DATA PROCESSING ENGINE (Server-Side Sourced) ===
  const analytics = useMemo(() => {
    if (!serverStats) return null;

    // Group raw strategy names into Display Categories
    const strategies: Record<string, {
      name: string;
      pnl: number;
      wins: number;
      losses: number;
      total: number;
      volume: number;
    }> = {};

    serverStats.forEach(stat => {
      // Improved Strategy Categorization Logic (Same as before, but on aggregated clumps)
      let stratName = 'Arbitrage';
      const s = (stat.strategy || '').toLowerCase();

      if (s.includes('whale')) stratName = 'Whale Copy';
      else if (s.includes('congress')) stratName = 'Congress Copy';
      else if (s.includes('news')) stratName = 'News Trading';
      else if (s.includes('single')) stratName = 'Scalping';
      else if (s.includes('sentiment')) stratName = 'AI Sentiment';

      if (!strategies[stratName]) {
        strategies[stratName] = { name: stratName, pnl: 0, wins: 0, losses: 0, total: 0, volume: 0 };
      }

      // Aggregate the pre-aggregated chunks
      strategies[stratName].pnl += Number(stat.total_pnl || 0);
      strategies[stratName].total += Number(stat.total_trades || 0);
      strategies[stratName].volume += Number(stat.total_volume || 0);
      strategies[stratName].wins += Number(stat.winning_trades || 0);
      strategies[stratName].losses += Number(stat.losing_trades || 0);
    });

    // Convert back to array
    const strategyData = Object.values(strategies)
      .sort((a, b) => b.pnl - a.pnl);

    const winningStrats = strategyData.filter(s => s.pnl > 0);
    const losingStrats = strategyData.filter(s => s.pnl < 0);

    return { strategyData, winningStrats, losingStrats };
  }, [serverStats]);

  // Chart Colors (Neon Palette)
  const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#eab308'];

  if (statsLoading || !analytics) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Analytics Engine...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg bg-dark-card border border-dark-border hover:bg-dark-border transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-neon-blue" />
              Performance Analytics
            </h1>
            <p className="text-gray-400">Deep dive into strategy effectiveness</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[24, 168, 720].map((h) => (
            <button
              key={h}
              onClick={() => setTimeframe(h)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                timeframe === h
                  ? "bg-neon-blue/20 text-neon-blue border border-neon-blue/30"
                  : "bg-dark-card text-gray-400 border border-dark-border hover:text-white"
              )}
            >
              {h === 24 ? '24H' : h === 168 ? '7D' : '30D'}
            </button>
          ))}
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-dark-card to-green-900/10 border-green-500/20">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Top Performer</h3>
          <div className="text-2xl font-bold text-green-400 flex items-center gap-2">
            {analytics.strategyData[0]?.name || 'N/A'}
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Generated {formatCurrency(analytics.strategyData[0]?.pnl || 0)} profit
          </p>
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Total Volume</h3>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(analytics.strategyData.reduce((acc, s) => acc + s.volume, 0))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Across {trades?.length} trades
          </p>
        </div>

        <div className="card bg-gradient-to-br from-dark-card to-red-900/10 border-red-500/20">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Worst Performer</h3>
          <div className="text-2xl font-bold text-red-400 flex items-center gap-2">
            {analytics.strategyData[analytics.strategyData.length - 1]?.name || 'N/A'}
            <TrendingDown className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Lost {formatCurrency(analytics.strategyData[analytics.strategyData.length - 1]?.pnl || 0)}
          </p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* PnL by Strategy Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card min-h-[400px]"
        >
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-neon-green" />
            Profit by Strategy
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.strategyData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#666" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" stroke="#999" width={100} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                  formatter={(value: number) => [formatCurrency(value), 'Profit']}
                />
                <Bar dataKey="pnl" fill="#22c55e" radius={[0, 4, 4, 0]}>
                  {analytics.strategyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Win Rate Radar/Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card min-h-[400px]"
        >
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-neon-purple" />
            Win Rate Efficiency
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.strategyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{ fontSize: 10 }} />
                <YAxis stroke="#666" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                  formatter={(value: any, name: any, props: any) => {
                    const winRate = Math.round((props.payload.wins / props.payload.total) * 100);
                    return [`${winRate}% (${props.payload.wins}/${props.payload.total})`, 'Win Rate'];
                  }}
                />
                <Bar dataKey="total" fill="#3b82f6" fillOpacity={0.2} radius={[4, 4, 0, 0]} name="Total Trades" />
                <Bar dataKey="wins" fill="#a855f7" radius={[4, 4, 0, 0]} name="Wins" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Strategy Leaderboard - The Single Source of Truth */}
      {/* Strategy Leaderboard - The Single Source of Truth */}
      <div className="card border-t-4 border-t-neon-blue">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-neon-blue" />
              Strategy Leaderboard
            </h2>
            <p className="text-gray-400 text-sm mt-1">Real-time performance ranking of all active strategies</p>
          </div>
        </div>
        <StrategyPerformanceTable tradingMode={isSimulation ? 'paper' : 'live'} />
      </div>
    </div>
  );
}

function DollarSignIcon(props: any) {
  return <DollarSign {...props} />
}
