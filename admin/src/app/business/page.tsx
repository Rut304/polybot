'use client';

import { useState, useMemo } from 'react';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Server,
  Cloud,
  CreditCard,
  Percent,
  Calendar,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Wallet,
  RefreshCw,
  PlayCircle,
  Banknote,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface CostItem {
  category: string;
  name: string;
  monthlyCost: number;
  annualCost: number;
  description: string;
  icon: string;
}

interface RevenueData {
  period: string;
  revenue: number;
  tradingPnL: number;
  fees: number;
  netProfit: number;
}

// Infrastructure and operational costs for RutRoh LLC
const FIXED_COSTS: CostItem[] = [
  // Cloud Infrastructure
  {
    category: 'Infrastructure',
    name: 'AWS Lightsail (Bot)',
    monthlyCost: 7,
    annualCost: 84,
    description: 'Container service for trading bot',
    icon: '☁️',
  },
  {
    category: 'Infrastructure',
    name: 'Vercel (Admin Dashboard)',
    monthlyCost: 0,
    annualCost: 0,
    description: 'Hobby tier - free',
    icon: '▲',
  },
  {
    category: 'Infrastructure',
    name: 'Supabase (Database)',
    monthlyCost: 0,
    annualCost: 0,
    description: 'Free tier - 500MB, 2 projects',
    icon: '🗄️',
  },
  {
    category: 'Infrastructure',
    name: 'GitHub (Repository)',
    monthlyCost: 0,
    annualCost: 0,
    description: 'Free tier for private repos',
    icon: '🐙',
  },
  {
    category: 'Infrastructure',
    name: 'Domain (if purchased)',
    monthlyCost: 1,
    annualCost: 12,
    description: 'Optional custom domain',
    icon: '🌐',
  },
  
  // Platform Fees (Variable - estimated)
  {
    category: 'Platform Fees',
    name: 'Kalshi Trading Fees',
    monthlyCost: 0, // Variable - calculated from trades
    annualCost: 0,
    description: '7% on profits, varies with trading volume',
    icon: '📊',
  },
  {
    category: 'Platform Fees',
    name: 'Polymarket Fees',
    monthlyCost: 0,
    annualCost: 0,
    description: '0% trading fees (gas costs on Polygon)',
    icon: '🎯',
  },
  
  // Data & APIs
  {
    category: 'Data & APIs',
    name: 'Market Data APIs',
    monthlyCost: 0,
    annualCost: 0,
    description: 'Currently using free tiers',
    icon: '📈',
  },
  
  // Business
  {
    category: 'Business',
    name: 'LLC Formation (One-time)',
    monthlyCost: 0,
    annualCost: 100, // Amortized
    description: 'State filing fees, varies by state',
    icon: '📋',
  },
  {
    category: 'Business',
    name: 'Registered Agent',
    monthlyCost: 10,
    annualCost: 120,
    description: 'Optional - required in some states',
    icon: '📬',
  },
  {
    category: 'Business',
    name: 'Accounting Software',
    monthlyCost: 0,
    annualCost: 0,
    description: 'Using spreadsheets/this dashboard',
    icon: '🧮',
  },
];

type TimeFrame = 'day' | 'week' | 'month' | 'year' | 'all';
type DataMode = 'simulated' | 'live';

export default function BusinessPage() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('month');
  const [showCostBreakdown, setShowCostBreakdown] = useState(true);
  const [dataMode, setDataMode] = useState<DataMode>('simulated');

  // Calculate date range based on timeframe
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    
    switch (timeFrame) {
      case 'day':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
      default:
        start = new Date(2024, 0, 1); // Start of 2024
    }
    
    return { startDate: start, endDate: now };
  }, [timeFrame]);

  // Fetch trading data
  const { data: tradingData, isLoading } = useQuery({
    queryKey: ['businessPnL', startDate.toISOString(), endDate.toISOString(), dataMode],
    queryFn: async () => {
      // For live mode, fetch from polybot_trades (real trades)
      // For simulated mode, fetch from polybot_simulated_trades
      const tableName = dataMode === 'live' ? 'polybot_trades' : 'polybot_simulated_trades';
      
      const { data, error } = await supabase
        .from(tableName)
        .select('created_at, actual_profit_usd, position_size_usd, outcome')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching trading data:', error);
        return [];
      }

      return data || [];
    },
  });

  // Calculate trading metrics
  const tradingMetrics = useMemo(() => {
    if (!tradingData || tradingData.length === 0) {
      return {
        totalRevenue: 0,
        totalLosses: 0,
        totalFees: 0,
        netPnL: 0,
        totalTrades: 0,
        winRate: 0,
        avgTradeSize: 0,
        totalVolume: 0,
      };
    }

    const wins = tradingData.filter((t: any) => t.outcome === 'won');
    const losses = tradingData.filter((t: any) => t.outcome === 'lost');
    
    const totalRevenue = wins.reduce((sum: number, t: any) => 
      sum + (parseFloat(t.actual_profit_usd) || 0), 0);
    const totalLosses = losses.reduce((sum: number, t: any) => 
      sum + Math.abs(parseFloat(t.actual_profit_usd) || 0), 0);
    // Estimate fees: 7% of revenue for Kalshi, minimal for Polymarket
    const totalFees = totalRevenue * 0.07;
    const totalVolume = tradingData.reduce((sum: number, t: any) => 
      sum + (parseFloat(t.position_size_usd) || 0), 0);

    return {
      totalRevenue,
      totalLosses,
      totalFees,
      netPnL: totalRevenue - totalLosses - totalFees,
      totalTrades: tradingData.length,
      winRate: tradingData.length > 0 
        ? (wins.length / (wins.length + losses.length)) * 100 
        : 0,
      avgTradeSize: tradingData.length > 0 
        ? totalVolume / tradingData.length 
        : 0,
      totalVolume,
    };
  }, [tradingData]);

  // Calculate infrastructure costs for the period
  const infraCosts = useMemo(() => {
    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const monthFraction = days / 30;
    
    const totalMonthly = FIXED_COSTS.reduce((sum, cost) => sum + cost.monthlyCost, 0);
    const periodCost = totalMonthly * monthFraction;
    
    return {
      periodCost,
      monthlyRate: totalMonthly,
      annualRate: totalMonthly * 12,
      days,
    };
  }, [startDate, endDate]);

  // Net business profit
  const netBusinessProfit = tradingMetrics.netPnL - infraCosts.periodCost;

  // Group costs by category
  const costsByCategory = useMemo(() => {
    const grouped: Record<string, CostItem[]> = {};
    FIXED_COSTS.forEach(cost => {
      if (!grouped[cost.category]) {
        grouped[cost.category] = [];
      }
      grouped[cost.category].push(cost);
    });
    return grouped;
  }, []);

  // Calculate ROI
  const roi = useMemo(() => {
    if (infraCosts.periodCost === 0) return tradingMetrics.netPnL > 0 ? Infinity : 0;
    return ((netBusinessProfit / infraCosts.periodCost) * 100);
  }, [netBusinessProfit, infraCosts.periodCost]);

  // Time period labels
  const periodLabel = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    all: 'All Time',
  }[timeFrame];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="text-blue-400" />
            RutRoh LLC
            {dataMode === 'simulated' && (
              <span className="text-sm font-normal bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md">
                📊 Simulated P&L
              </span>
            )}
            {dataMode === 'live' && (
              <span className="text-sm font-normal bg-green-500/20 text-green-400 px-2 py-1 rounded-md">
                💵 Live Trading
              </span>
            )}
          </h1>
          <p className="text-gray-400 mt-1">
            Business P&L • Infrastructure Costs • Performance Metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Data Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setDataMode('simulated')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                dataMode === 'simulated'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              Simulated
            </button>
            <button
              onClick={() => setDataMode('live')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                dataMode === 'live'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Live
            </button>
          </div>
          
          <div className="h-6 w-px bg-gray-700" />
          
          <div className="flex gap-2">
            {(['day', 'week', 'month', 'year', 'all'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timeFrame === tf
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Info Banner for Live Mode with No Trades */}
      {dataMode === 'live' && tradingData?.length === 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
          <Banknote className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200">
            <strong>Live Trading Mode:</strong> No live trades have been executed yet. 
            Infrastructure costs are still being tracked. Switch to Simulated mode to see 
            paper trading performance.
          </div>
        </div>
      )}

      {/* Main P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card p-5 ${netBusinessProfit >= 0 
            ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30' 
            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Net Business Profit</p>
              <p className={`text-3xl font-bold mt-1 ${netBusinessProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${netBusinessProfit >= 0 ? '+' : ''}{netBusinessProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {netBusinessProfit >= 0 ? (
              <ArrowUpRight className="w-8 h-8 text-green-500/50" />
            ) : (
              <ArrowDownRight className="w-8 h-8 text-red-500/50" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">{periodLabel} • After all costs</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Trading P&L</p>
              <p className={`text-2xl font-bold mt-1 ${tradingMetrics.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${tradingMetrics.netPnL >= 0 ? '+' : ''}{tradingMetrics.netPnL.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">{tradingMetrics.totalTrades} trades</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Infrastructure Costs</p>
              <p className="text-2xl font-bold mt-1 text-orange-400">
                -${infraCosts.periodCost.toFixed(2)}
              </p>
            </div>
            <Server className="w-8 h-8 text-orange-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">${infraCosts.monthlyRate}/mo rate</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">ROI</p>
              <p className={`text-2xl font-bold mt-1 ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {roi === Infinity ? '∞' : `${roi.toFixed(0)}%`}
              </p>
            </div>
            <Percent className="w-8 h-8 text-purple-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Return on infrastructure</p>
        </motion.div>
      </div>

      {/* Trading Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-400" />
            Trading Performance
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Win Rate</p>
              <p className="text-2xl font-bold text-green-400">
                {tradingMetrics.winRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Total Volume</p>
              <p className="text-2xl font-bold">
                ${tradingMetrics.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Gross Revenue</p>
              <p className="text-2xl font-bold text-green-400">
                +${tradingMetrics.totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Total Losses</p>
              <p className="text-2xl font-bold text-red-400">
                -${tradingMetrics.totalLosses.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Platform Fees</p>
              <p className="text-2xl font-bold text-orange-400">
                -${tradingMetrics.totalFees.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Avg Trade Size</p>
              <p className="text-2xl font-bold">
                ${tradingMetrics.avgTradeSize.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* P&L Breakdown */}
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieChart className="text-purple-400" />
            P&L Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Trading Gains
              </span>
              <span className="font-bold text-green-400">
                +${tradingMetrics.totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
              <span className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                Trading Losses
              </span>
              <span className="font-bold text-red-400">
                -${tradingMetrics.totalLosses.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-400" />
                Platform Fees
              </span>
              <span className="font-bold text-orange-400">
                -${tradingMetrics.totalFees.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
              <span className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-400" />
                Infrastructure
              </span>
              <span className="font-bold text-blue-400">
                -${infraCosts.periodCost.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border-t-2 border-gray-600">
              <span className="flex items-center gap-2 font-bold">
                <Calculator className="w-4 h-4" />
                Net Profit
              </span>
              <span className={`font-bold text-lg ${netBusinessProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${netBusinessProfit >= 0 ? '+' : ''}{netBusinessProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Costs Breakdown */}
      <div className="card">
        <button
          onClick={() => setShowCostBreakdown(!showCostBreakdown)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Server className="text-orange-400" />
            Infrastructure Cost Breakdown
            <span className="text-sm font-normal text-gray-400">
              (${infraCosts.monthlyRate}/month)
            </span>
          </h2>
          <RefreshCw className={`w-5 h-5 text-gray-400 transition-transform ${showCostBreakdown ? 'rotate-180' : ''}`} />
        </button>
        
        {showCostBreakdown && (
          <div className="p-4 pt-0 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(costsByCategory).map(([category, costs]) => (
                <div key={category}>
                  <h3 className="font-semibold mb-3 text-gray-300 flex items-center gap-2">
                    {category === 'Infrastructure' && <Cloud className="w-4 h-4" />}
                    {category === 'Platform Fees' && <CreditCard className="w-4 h-4" />}
                    {category === 'Data & APIs' && <BarChart3 className="w-4 h-4" />}
                    {category === 'Business' && <Building2 className="w-4 h-4" />}
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {costs.map((cost, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span>{cost.icon}</span>
                          <span>{cost.name}</span>
                        </span>
                        <span className={cost.monthlyCost > 0 ? 'text-orange-400' : 'text-green-400'}>
                          {cost.monthlyCost > 0 ? `$${cost.monthlyCost}/mo` : 'Free'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-400">Daily Cost</p>
                  <p className="text-xl font-bold text-orange-400">
                    ${(infraCosts.monthlyRate / 30).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Monthly Cost</p>
                  <p className="text-xl font-bold text-orange-400">
                    ${infraCosts.monthlyRate.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Annual Cost</p>
                  <p className="text-xl font-bold text-orange-400">
                    ${infraCosts.annualRate.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profitability Analysis */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calculator className="text-green-400" />
          Profitability Analysis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-2">Break-Even Point</h3>
            <p className="text-2xl font-bold">
              ${infraCosts.periodCost.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Min trading profit needed to cover costs
            </p>
            <div className="mt-2">
              {tradingMetrics.netPnL >= infraCosts.periodCost ? (
                <span className="text-green-400 text-sm">✓ Above break-even</span>
              ) : (
                <span className="text-red-400 text-sm">✗ Below break-even</span>
              )}
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-2">Profit Margin</h3>
            <p className={`text-2xl font-bold ${netBusinessProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {tradingMetrics.totalRevenue > 0 
                ? ((netBusinessProfit / tradingMetrics.totalRevenue) * 100).toFixed(1)
                : 0}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Net profit / Gross revenue
            </p>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-2">Cost Efficiency</h3>
            <p className="text-2xl font-bold">
              {tradingMetrics.totalTrades > 0 
                ? `$${(infraCosts.periodCost / tradingMetrics.totalTrades).toFixed(4)}`
                : '$0'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Infrastructure cost per trade
            </p>
          </div>
        </div>
      </div>

      {/* Projections */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="text-blue-400" />
          Annual Projections (Based on {periodLabel} Performance)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400">Projected Revenue</p>
            <p className="text-2xl font-bold text-green-400">
              ${((tradingMetrics.totalRevenue / infraCosts.days) * 365).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500">/year</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400">Projected Costs</p>
            <p className="text-2xl font-bold text-orange-400">
              ${infraCosts.annualRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500">/year</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400">Projected Net Profit</p>
            <p className={`text-2xl font-bold ${netBusinessProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${((netBusinessProfit / infraCosts.days) * 365).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500">/year</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400">Annual ROI</p>
            <p className={`text-2xl font-bold ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {roi === Infinity ? '∞' : `${roi.toFixed(0)}%`}
            </p>
            <p className="text-xs text-gray-500">return on investment</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center">
          * Projections based on current {infraCosts.days}-day performance. Actual results may vary.
        </p>
      </div>
    </div>
  );
}
