'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Activity,
  Zap,
  Award,
  PieChart,
  LineChart as LineChartIcon,
  RefreshCw,
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
  Cell,
  Line,
  Area,
  ComposedChart,
  LineChart,
  Legend,
} from 'recharts';

import { useSimulatedTrades, useStrategyPerformance, useBotConfig, usePnLHistory, useConnectedPlatforms } from '@/lib/hooks';
import { useTier } from '@/lib/useTier';
import { formatCurrency, cn } from '@/lib/utils';
import { StrategyPerformanceTable } from '@/components/StrategyPerformanceTable';
import { PageCTA } from '@/components/QuickStartGuide';
import { CumulativePnLChart, DailyPnLChart, STRATEGY_COLORS } from '@/components/TradingViewChart';
import { PlatformFilter, TimeRangeFilter, TIME_RANGES } from '@/components/PlatformFilter';
import { usePlatforms } from '@/lib/PlatformContext';
import { AdvancedAnalytics } from '@/components/AdvancedAnalytics';

// Platform colors - comprehensive list supporting all potential platforms
const PLATFORM_COLORS: Record<string, string> = {
  polymarket: '#8b5cf6',  // Purple
  kalshi: '#22c55e',      // Green
  alpaca: '#f59e0b',      // Amber
  binance: '#f0b90b',     // Binance yellow
  coinbase: '#0052ff',    // Coinbase blue
  ibkr: '#dc2626',        // Red
  kraken: '#5741d9',      // Kraken purple
  kucoin: '#23af91',      // KuCoin teal
  bybit: '#f7a600',       // Bybit orange
  okx: '#121212',         // OKX dark
  other: '#6b7280',       // Gray for unknown
};

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<number>(168); // 7 days default
  
  // Get user context - use profile setting as source of truth
  const { isAdmin, isSimulation: isUserSimMode } = useTier();
  
  // Default view mode based on user's profile setting (is_simulation flag)
  // If user has live trading enabled (is_simulation=false), show live data only
  const [viewMode, setViewMode] = useState<'all' | 'paper' | 'live'>(() => isUserSimMode ? 'paper' : 'live');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]); // Empty = all platforms
  
  // Update view mode when user profile loads
  const [hasUserSelectedMode, setHasUserSelectedMode] = useState(false);
  
  useEffect(() => {
    if (!hasUserSelectedMode) {
      const profileMode = isUserSimMode ? 'paper' : 'live';
      if (viewMode !== profileMode) {
        setViewMode(profileMode);
      }
    }
  }, [isUserSimMode, hasUserSelectedMode, viewMode]);
  
  // Get platform context for filtering
  const { filterByPlatform, isSimulationMode, connectedIds } = usePlatforms();
  
  // Get connected platforms dynamically from user's secrets
  const { data: connectedPlatforms = [] } = useConnectedPlatforms();
  
  // For data fetching, use viewMode instead of user's current mode
  const tradingModeFilter = viewMode === 'all' ? undefined : viewMode;
  
  const { data: serverStats, isLoading: statsLoading, refetch: refetchStats } = useStrategyPerformance(tradingModeFilter);
  const { data: config } = useBotConfig();
  const { data: rawTrades = [] } = useSimulatedTrades(5000, tradingModeFilter);
  
  // Apply platform filtering to trades
  const trades = useMemo(() => {
    // First filter by platform context (simulation shows all, live shows connected)
    let filtered = filterByPlatform(rawTrades, 'platform');
    
    // Then apply user-selected platform filter if any
    if (selectedPlatforms.length > 0) {
      filtered = filtered.filter(t => {
        const platform = (t.platform || '').toLowerCase();
        return selectedPlatforms.some(p => platform.includes(p.toLowerCase()));
      });
    }
    
    return filtered;
  }, [rawTrades, filterByPlatform, selectedPlatforms]);

  // Starting balance calculation - dynamically include all connected platforms
  const startingBalance = useMemo(() => {
    let total = 0;
    
    // Get starting balance for each connected platform
    const platformBalances: Record<string, number> = {
      polymarket: config?.polymarket_starting_balance || 5000,
      kalshi: config?.kalshi_starting_balance || 5000,
      binance: config?.binance_starting_balance || 5000,
      coinbase: config?.coinbase_starting_balance || 5000,
      alpaca: config?.alpaca_starting_balance || 5000,
      ibkr: config?.ibkr_starting_balance || 5000,
      kraken: config?.kraken_starting_balance || 5000,
      kucoin: config?.kucoin_starting_balance || 5000,
      bybit: config?.bybit_starting_balance || 5000,
      okx: config?.okx_starting_balance || 5000,
    };
    
    // Only count platforms that are connected
    connectedPlatforms.forEach(platform => {
      const platformName = platform.name.toLowerCase();
      if (platform.connected && platformBalances[platformName]) {
        total += platformBalances[platformName];
      }
    });
    
    // If no platforms connected yet, use a default total
    return total > 0 ? total : 30000;
  }, [config, connectedPlatforms]);

  // === COMPREHENSIVE ANALYTICS ENGINE ===
  const analytics = useMemo(() => {
    if (!serverStats || serverStats.length === 0) {
      return null;
    }

    // Filter trades by timeframe
    const since = new Date();
    since.setHours(since.getHours() - (timeframe || 8760));
    const filteredTrades = trades.filter(t => 
      t.outcome !== 'failed_execution' && 
      new Date(t.created_at) >= since
    );

    // === OVERALL ACCOUNT METRICS ===
    // Compute from filtered trades when timeframe is set, otherwise from serverStats
    const useFilteredMetrics = timeframe > 0 && timeframe < 8760; // Use filtered for anything less than 1 year
    
    // Compute metrics from filtered trades
    const filteredPnl = filteredTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
    const filteredWins = filteredTrades.filter(t => t.outcome === 'won').length;
    const filteredLosses = filteredTrades.filter(t => t.outcome === 'lost').length;
    const filteredResolved = filteredWins + filteredLosses;
    
    // Use appropriate source based on timeframe
    const totalPnl = useFilteredMetrics ? filteredPnl : serverStats.reduce((sum, s) => sum + (s.total_pnl || 0), 0);
    const totalTrades = useFilteredMetrics ? filteredTrades.length : serverStats.reduce((sum, s) => sum + (s.total_trades || 0), 0);
    const totalWins = useFilteredMetrics ? filteredWins : serverStats.reduce((sum, s) => sum + (s.winning_trades || 0), 0);
    const totalLosses = useFilteredMetrics ? filteredLosses : serverStats.reduce((sum, s) => sum + (s.losing_trades || 0), 0);
    const totalVolume = filteredTrades.reduce((sum, t) => sum + (t.position_size_usd || 0), 0);
    const resolvedTrades = useFilteredMetrics ? filteredResolved : totalWins + totalLosses;
    const overallWinRate = resolvedTrades > 0 ? (totalWins / resolvedTrades) * 100 : 0;
    
    // All-time totals (always from serverStats) for balance calculation
    const allTimePnl = serverStats.reduce((sum, s) => sum + (s.total_pnl || 0), 0);
    const roi = (allTimePnl / startingBalance) * 100;
    const currentBalance = startingBalance + allTimePnl;
    
    // Best and worst trades
    const bestTrade = serverStats.reduce((best, s) => Math.max(best, s.best_trade || 0), 0);
    const worstTrade = serverStats.reduce((worst, s) => Math.min(worst, s.worst_trade || 0), 0);
    
    // Average trade metrics
    const avgTradeSize = totalVolume / (totalTrades || 1);
    const avgProfit = totalPnl / (totalTrades || 1);
    const avgWin = filteredTrades.filter(t => t.outcome === 'won').reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0) / (totalWins || 1);
    const avgLoss = Math.abs(filteredTrades.filter(t => t.outcome === 'lost').reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0)) / (totalLosses || 1);
    const profitFactor = avgLoss > 0 ? (avgWin * totalWins) / (avgLoss * totalLosses) : avgWin > 0 ? Infinity : 0;

    // === STRATEGY BREAKDOWN ===
    const strategyData = serverStats.map(stat => ({
      name: formatStrategyName(stat.strategy || 'Unknown'),
      rawName: stat.strategy,
      pnl: stat.total_pnl || 0,
      trades: stat.total_trades || 0,
      wins: stat.winning_trades || 0,
      losses: stat.losing_trades || 0,
      winRate: stat.total_trades > 0 ? ((stat.winning_trades || 0) / stat.total_trades) * 100 : 0,
      avgTrade: stat.total_trades > 0 ? (stat.total_pnl || 0) / stat.total_trades : 0,
      bestTrade: stat.best_trade || 0,
      worstTrade: stat.worst_trade || 0,
    })).sort((a, b) => b.pnl - a.pnl);

    // === DYNAMIC PLATFORM DETECTION FROM TRADES ===
    // Detect platform from trade data - supports any platform that trades on
    const detectPlatform = (trade: any): string => {
      // Check for explicit platform field first (if available in trade schema)
      if (trade.platform) return trade.platform.toLowerCase();
      
      // Detect from token/ticker identifiers
      if (trade.polymarket_token_id) return 'polymarket';
      if (trade.kalshi_ticker) return 'kalshi';
      if (trade.alpaca_symbol) return 'alpaca';
      
      // Detect from crypto symbols/exchanges
      if (trade.binance_symbol || trade.exchange === 'binance') return 'binance';
      if (trade.coinbase_symbol || trade.exchange === 'coinbase') return 'coinbase';
      if (trade.kraken_symbol || trade.exchange === 'kraken') return 'kraken';
      if (trade.kucoin_symbol || trade.exchange === 'kucoin') return 'kucoin';
      if (trade.bybit_symbol || trade.exchange === 'bybit') return 'bybit';
      if (trade.okx_symbol || trade.exchange === 'okx') return 'okx';
      
      // Detect from IBKR
      if (trade.ibkr_contract_id || trade.ibkr_symbol) return 'ibkr';
      
      // Detect from strategy name pattern
      const strategy = (trade.strategy || '').toLowerCase();
      if (strategy.includes('polymarket')) return 'polymarket';
      if (strategy.includes('kalshi')) return 'kalshi';
      if (strategy.includes('binance')) return 'binance';
      if (strategy.includes('coinbase')) return 'coinbase';
      if (strategy.includes('alpaca')) return 'alpaca';
      if (strategy.includes('ibkr') || strategy.includes('interactive')) return 'ibkr';
      if (strategy.includes('kraken')) return 'kraken';
      if (strategy.includes('kucoin')) return 'kucoin';
      
      return 'other';
    };

    // === PLATFORM BREAKDOWN ===
    const platformStats: Record<string, { pnl: number; trades: number; wins: number; losses: number }> = {};
    filteredTrades.forEach(trade => {
      const platform = detectPlatform(trade);
      
      if (!platformStats[platform]) {
        platformStats[platform] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
      }
      platformStats[platform].pnl += trade.actual_profit_usd || 0;
      platformStats[platform].trades += 1;
      if (trade.outcome === 'won') platformStats[platform].wins += 1;
      if (trade.outcome === 'lost') platformStats[platform].losses += 1;
    });

    const platformData = Object.entries(platformStats).map(([platform, stats]) => ({
      name: platform.charAt(0).toUpperCase() + platform.slice(1),
      pnl: stats.pnl,
      trades: stats.trades,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
      color: PLATFORM_COLORS[platform] || '#666',
    })).sort((a, b) => b.pnl - a.pnl);

    // === TIME-BASED ANALYSIS ===
    const dailyPnl: Record<string, { pnl: number; trades: number }> = {};
    
    filteredTrades.forEach(trade => {
      const date = new Date(trade.created_at);
      const day = date.toISOString().split('T')[0];
      
      if (!dailyPnl[day]) dailyPnl[day] = { pnl: 0, trades: 0 };
      dailyPnl[day].pnl += trade.actual_profit_usd || 0;
      dailyPnl[day].trades += 1;
    });

    const dailyData = Object.entries(dailyPnl)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, stats]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl: stats.pnl,
        trades: stats.trades,
      }));

    // === WIN/LOSS DISTRIBUTION ===
    const pnlRanges = [
      { range: '< -$50', count: 0 },
      { range: '-$50 to -$20', count: 0 },
      { range: '-$20 to -$5', count: 0 },
      { range: '-$5 to $0', count: 0 },
      { range: '$0 to $5', count: 0 },
      { range: '$5 to $20', count: 0 },
      { range: '$20 to $50', count: 0 },
      { range: '> $50', count: 0 },
    ];

    filteredTrades.forEach(trade => {
      const pnl = trade.actual_profit_usd || 0;
      if (pnl < -50) pnlRanges[0].count++;
      else if (pnl < -20) pnlRanges[1].count++;
      else if (pnl < -5) pnlRanges[2].count++;
      else if (pnl < 0) pnlRanges[3].count++;
      else if (pnl < 5) pnlRanges[4].count++;
      else if (pnl < 20) pnlRanges[5].count++;
      else if (pnl < 50) pnlRanges[6].count++;
      else pnlRanges[7].count++;
    });

    // === STREAKS & PATTERNS ===
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempStreak = 0;
    let lastOutcome: string | null = null;

    filteredTrades
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(trade => {
        if (trade.outcome === 'won' || trade.outcome === 'lost') {
          if (trade.outcome === lastOutcome) {
            tempStreak++;
          } else {
            tempStreak = 1;
            lastOutcome = trade.outcome;
          }
          
          if (trade.outcome === 'won') {
            maxWinStreak = Math.max(maxWinStreak, tempStreak);
          } else {
            maxLossStreak = Math.max(maxLossStreak, tempStreak);
          }
        }
      });

    // === CUMULATIVE P&L PER STRATEGY OVER TIME ===
    // Get unique strategies from trades
    const uniqueStrategies = [...new Set(filteredTrades.map(t => t.strategy).filter(Boolean))];
    
    // Colors for different strategies
    const strategyColors: Record<string, string> = {
      'cross_platform_arb': '#22c55e',        // Green
      'polymarket_single_platform': '#8b5cf6', // Purple
      'kalshi_single_platform': '#3b82f6',    // Blue
      'rsi_strategy': '#f59e0b',              // Amber
      'mean_reversion': '#ec4899',            // Pink
      'momentum': '#06b6d4',                  // Cyan
      'dividend_growth': '#84cc16',           // Lime
      'whale_copy_trading': '#f97316',        // Orange
      'congressional_tracker': '#14b8a6',     // Teal
      'stock_mean_reversion': '#a855f7',      // Violet
    };
    
    // Build cumulative P&L data per day per strategy
    const cumulativePnlByDay: Record<string, Record<string, number>> = {};
    const runningTotals: Record<string, number> = {};
    
    // Initialize running totals
    uniqueStrategies.forEach(s => { runningTotals[s] = 0; });
    
    // Sort trades by date and build cumulative data
    [...filteredTrades]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(trade => {
        const date = new Date(trade.created_at).toISOString().split('T')[0];
        const strategy = trade.strategy || 'unknown';
        const pnl = trade.actual_profit_usd || 0;
        
        runningTotals[strategy] = (runningTotals[strategy] || 0) + pnl;
        
        if (!cumulativePnlByDay[date]) {
          cumulativePnlByDay[date] = { ...runningTotals };
        } else {
          cumulativePnlByDay[date] = { ...runningTotals };
        }
      });
    
    // Convert to chart-friendly format
    const cumulativeStrategyData = Object.entries(cumulativePnlByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, strategies]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        ...strategies,
      }));
    
    // Daily P&L per strategy (not cumulative)
    const dailyStrategyPnl: Record<string, Record<string, number>> = {};
    filteredTrades.forEach(trade => {
      const date = new Date(trade.created_at).toISOString().split('T')[0];
      const strategy = trade.strategy || 'unknown';
      const pnl = trade.actual_profit_usd || 0;
      
      if (!dailyStrategyPnl[date]) dailyStrategyPnl[date] = {};
      dailyStrategyPnl[date][strategy] = (dailyStrategyPnl[date][strategy] || 0) + pnl;
    });
    
    const dailyStrategyData = Object.entries(dailyStrategyPnl)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, strategies]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        ...strategies,
      }));

    return {
      // Overall metrics
      totalPnl,
      totalTrades,
      totalWins,
      totalLosses,
      totalVolume,
      overallWinRate,
      roi,
      currentBalance,
      bestTrade,
      worstTrade,
      avgTradeSize,
      avgProfit,
      avgWin,
      avgLoss,
      profitFactor,
      
      // Breakdowns
      strategyData,
      platformData,
      dailyData,
      pnlRanges,
      
      // NEW: Strategy line chart data
      cumulativeStrategyData,
      dailyStrategyData,
      uniqueStrategies,
      strategyColors,
      
      // Patterns
      maxWinStreak,
      maxLossStreak,
      
      // Pending/failed
      pendingTrades: filteredTrades.filter(t => t.outcome === 'pending').length,
      failedTrades: trades.filter(t => t.outcome === 'failed_execution').length,
    };
  }, [serverStats, trades, timeframe, startingBalance]);

  // Format strategy name for display
  function formatStrategyName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace('Polymarket', 'PM')
      .replace('Kalshi', 'K')
      .replace('Single', 'Single-Platform')
      .replace('Cross Platform', 'Cross-Platform');
  }

  if (statsLoading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 text-neon-blue animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Trading Data Yet</h2>
          <p className="text-gray-400 mb-6">
            Start trading to see your performance analytics here.
          </p>
          <Link 
            href="/strategies" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-neon-green text-dark-bg font-semibold rounded-lg hover:bg-neon-green/90 transition-colors"
          >
            <Zap className="w-5 h-5" />
            Enable Strategies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg bg-dark-card border border-dark-border hover:bg-dark-border transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-neon-blue" />
              Performance Analytics
            </h1>
            <p className="text-gray-400">Comprehensive trading performance analysis</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Indicator */}
          <div className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium",
            isSimulationMode 
              ? "bg-amber-500/20 text-amber-400" 
              : "bg-green-500/20 text-green-400"
          )}>
            {isSimulationMode ? '🧪 Simulation' : '⚡ Live'}
          </div>
          
          {/* Platform Filter */}
          <PlatformFilter
            selectedPlatforms={selectedPlatforms}
            onPlatformChange={setSelectedPlatforms}
          />
          
          {/* Trading Mode Filter */}
          <div className="flex rounded-lg border border-dark-border overflow-hidden">
            {(['all', 'paper', 'live'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  viewMode === mode
                    ? "bg-neon-blue/20 text-neon-blue"
                    : "bg-dark-card text-gray-400 hover:text-white"
                )}
              >
                {mode === 'all' ? 'All Data' : mode === 'paper' ? 'Paper' : 'Live'}
              </button>
            ))}
          </div>
          
          {/* Timeframe Filter */}
          <TimeRangeFilter value={timeframe} onChange={setTimeframe} />
          
          <button
            onClick={() => refetchStats()}
            className="p-2 rounded-lg bg-dark-card border border-dark-border hover:bg-dark-border transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* === MAIN KPI CARDS === */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Total P&L */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "card border-l-4",
            analytics.totalPnl >= 0 ? "border-l-green-500" : "border-l-red-500"
          )}
        >
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <DollarSign className="w-4 h-4" />
            TOTAL P&L
          </div>
          <div className={cn(
            "text-2xl font-bold",
            analytics.totalPnl >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {formatCurrency(analytics.totalPnl)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {analytics.totalPnl >= 0 ? '+' : ''}{analytics.roi.toFixed(2)}% ROI
          </div>
        </motion.div>

        {/* Win Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card border-l-4 border-l-blue-500"
        >
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Target className="w-4 h-4" />
            WIN RATE
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {analytics.overallWinRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {analytics.totalWins}W / {analytics.totalLosses}L
          </div>
        </motion.div>

        {/* Total Trades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card border-l-4 border-l-purple-500"
        >
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Activity className="w-4 h-4" />
            TOTAL TRADES
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {analytics.totalTrades}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {analytics.pendingTrades} pending
          </div>
        </motion.div>

        {/* Avg Trade */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card border-l-4 border-l-cyan-500"
        >
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <TrendingUp className="w-4 h-4" />
            AVG PROFIT
          </div>
          <div className={cn(
            "text-2xl font-bold",
            analytics.avgProfit >= 0 ? "text-cyan-400" : "text-red-400"
          )}>
            {formatCurrency(analytics.avgProfit)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            per trade
          </div>
        </motion.div>

        {/* Profit Factor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card border-l-4 border-l-yellow-500"
        >
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Award className="w-4 h-4" />
            PROFIT FACTOR
          </div>
          <div className={cn(
            "text-2xl font-bold",
            analytics.profitFactor >= 1.5 ? "text-yellow-400" : analytics.profitFactor >= 1 ? "text-gray-300" : "text-red-400"
          )}>
            {analytics.profitFactor === Infinity ? '∞' : analytics.profitFactor.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {analytics.profitFactor >= 1.5 ? 'Excellent' : analytics.profitFactor >= 1 ? 'Breakeven' : 'Needs work'}
          </div>
        </motion.div>

        {/* Current Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card border-l-4 border-l-emerald-500"
        >
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <DollarSign className="w-4 h-4" />
            BALANCE
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatCurrency(analytics.currentBalance)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            from {formatCurrency(startingBalance)}
          </div>
        </motion.div>
      </div>

      {/* === DETAILED METRICS ROW === */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Best Trade</div>
          <div className="text-lg font-bold text-green-400">{formatCurrency(analytics.bestTrade)}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Worst Trade</div>
          <div className="text-lg font-bold text-red-400">{formatCurrency(analytics.worstTrade)}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Avg Win</div>
          <div className="text-lg font-bold text-green-400">{formatCurrency(analytics.avgWin)}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Avg Loss</div>
          <div className="text-lg font-bold text-red-400">-{formatCurrency(analytics.avgLoss)}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Avg Size</div>
          <div className="text-lg font-bold text-white">{formatCurrency(analytics.avgTradeSize)}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Total Volume</div>
          <div className="text-lg font-bold text-white">{formatCurrency(analytics.totalVolume)}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Win Streak</div>
          <div className="text-lg font-bold text-green-400">{analytics.maxWinStreak}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-500 mb-1">Loss Streak</div>
          <div className="text-lg font-bold text-red-400">{analytics.maxLossStreak}</div>
        </div>
      </div>

      {/* === NEW: TRADINGVIEW-STYLE CUMULATIVE P&L CHART === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <CumulativePnLChart
          trades={trades}
          height={400}
          showByStrategy={true}
          className="w-full"
        />
      </motion.div>

      {/* === CHARTS ROW 1: Daily P&L + Distribution === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily P&L - TradingView Style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <DailyPnLChart
            trades={trades}
            height={300}
            className="w-full"
          />
        </motion.div>

        {/* P&L Distribution - Keep Recharts for histogram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-neon-yellow" />
            Trade P&L Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.pnlRanges}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="range" stroke="#666" tick={{ fontSize: 9 }} />
                <YAxis stroke="#666" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {analytics.pnlRanges.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index < 4 ? '#ef4444' : '#22c55e'} 
                      fillOpacity={0.3 + (Math.abs(index - 3.5) / 4) * 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* === CHARTS ROW 2: Strategy P&L + Win Rate === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L by Strategy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neon-green" />
            P&L by Strategy
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.strategyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#666" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" stroke="#999" width={140} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                  formatter={(value: number) => [formatCurrency(value), 'P&L']}
                />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {analytics.strategyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Win Rate by Strategy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-neon-blue" />
            Win Rate by Strategy
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.strategyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={10} height={80} />
                <YAxis stroke="#666" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [
                    name === 'winRate' ? `${value.toFixed(1)}%` : value,
                    name === 'winRate' ? 'Win Rate' : 'Trades'
                  ]}
                />
                <Bar dataKey="winRate" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Win Rate" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* === PLATFORM BREAKDOWN === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-neon-blue" />
          Performance by Platform
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {analytics.platformData.map((platform) => (
            <div 
              key={platform.name}
              className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border"
              style={{ borderLeftColor: platform.color, borderLeftWidth: '4px' }}
            >
              <div className="text-sm font-medium text-gray-300 mb-2">{platform.name}</div>
              <div className={cn(
                "text-xl font-bold mb-1",
                platform.pnl >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(platform.pnl)}
              </div>
              <div className="text-xs text-gray-500">
                {platform.trades} trades • {platform.winRate.toFixed(0)}% win rate
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* === STRATEGY LEADERBOARD === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-neon-green" />
            Strategy Leaderboard
          </h3>
        </div>
        <StrategyPerformanceTable tradingMode={tradingModeFilter} />
      </motion.div>

      {/* === ADVANCED ANALYTICS (PRO FEATURE) === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="border-t border-dark-border pt-8">
          <AdvancedAnalytics trades={trades} startingBalance={startingBalance} />
        </div>
      </motion.div>

      {/* Page CTA */}
      <PageCTA page="analytics" />
    </div>
  );
}
