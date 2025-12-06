'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Activity,
  Eye,
  Target,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { usePositions } from '@/lib/hooks';
import { Tooltip } from '@/components/Tooltip';

interface Position {
  id: string;
  platform: string;
  market: string;
  market_slug?: string;
  side: 'yes' | 'no' | 'long' | 'short' | 'buy' | 'sell';
  size: number;
  entry_price: number;
  current_price?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
  strategy: string;
  opened_at: string;
  status: 'open' | 'closing' | 'closed';
}

interface PositionStats {
  total_positions: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  winning_positions: number;
  losing_positions: number;
}

const platformIcons: Record<string, string> = {
  polymarket: '🎯',
  kalshi: '📊',
  binance: '🟡',
  bybit: '🔶',
  okx: '⚫',
  kraken: '🐙',
  coinbase: '🔵',
  kucoin: '🟢',
  alpaca: '🦙',
  ibkr: '🏛️',
};

const strategyColors: Record<string, string> = {
  single_platform_arb: 'bg-green-500/20 text-green-400',
  cross_platform_arb: 'bg-blue-500/20 text-blue-400',
  funding_rate_arb: 'bg-yellow-500/20 text-yellow-400',
  grid_trading: 'bg-teal-500/20 text-teal-400',
  pairs_trading: 'bg-pink-500/20 text-pink-400',
  market_making: 'bg-purple-500/20 text-purple-400',
  news_arbitrage: 'bg-orange-500/20 text-orange-400',
  copy_trading: 'bg-indigo-500/20 text-indigo-400',
  manual: 'bg-gray-500/20 text-gray-400',
};

// Sample data for demo - used when no real positions exist
const samplePositions: Position[] = [
  {
    id: '1',
    platform: 'Polymarket',
    market: 'Will Bitcoin reach $100k in 2024?',
    market_slug: 'btc-100k-2024',
    side: 'yes',
    size: 100,
    entry_price: 0.65,
    current_price: 0.72,
    unrealized_pnl: 10.77,
    unrealized_pnl_pct: 10.77,
    strategy: 'single_platform_arb',
    opened_at: new Date(Date.now() - 3600000).toISOString(),
    status: 'open',
  },
  {
    id: '2',
    platform: 'Binance',
    market: 'BTC/USDT',
    side: 'long',
    size: 500,
    entry_price: 42150,
    current_price: 43200,
    unrealized_pnl: 12.47,
    unrealized_pnl_pct: 2.49,
    strategy: 'funding_rate_arb',
    opened_at: new Date(Date.now() - 86400000).toISOString(),
    status: 'open',
  },
  {
    id: '3',
    platform: 'Binance',
    market: 'BTC/USDT-PERP',
    side: 'short',
    size: 500,
    entry_price: 42180,
    current_price: 43200,
    unrealized_pnl: -12.10,
    unrealized_pnl_pct: -2.42,
    strategy: 'funding_rate_arb',
    opened_at: new Date(Date.now() - 86400000).toISOString(),
    status: 'open',
  },
];

// Tooltips for position fields
const FIELD_TOOLTIPS = {
  size: 'Total USD value of this position',
  entry: 'Price when position was opened',
  current: 'Current market price',
  pnl: 'Unrealized profit/loss = (Current - Entry) × Size',
  strategy: 'Trading strategy that opened this position',
  side: 'YES/NO for predictions, LONG/SHORT for perpetuals',
};

export default function PositionsPage() {
  const { data: dbPositions, isLoading, refetch } = usePositions();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'prediction' | 'crypto' | 'stock'>('all');
  const [strategyFilter, setStrategyFilter] = useState<string | null>(null);
  
  // Use ONLY database positions - no sample data fallback (that creates confusion)
  const positions: Position[] = (dbPositions && dbPositions.length > 0) 
    ? dbPositions.map((p: any) => ({
        id: p.id || p.position_id,
        platform: p.platform || 'Unknown',
        market: p.market_title || p.market || 'Unknown',
        market_slug: p.market_id,
        side: p.side || 'buy',
        size: parseFloat(p.current_value) || parseFloat(p.cost_basis) || 0,
        entry_price: parseFloat(p.avg_price) || 0,
        current_price: parseFloat(p.current_price) || parseFloat(p.avg_price) || 0,
        unrealized_pnl: parseFloat(p.unrealized_pnl) || 0,
        unrealized_pnl_pct: p.cost_basis > 0 ? (parseFloat(p.unrealized_pnl) / parseFloat(p.cost_basis)) * 100 : 0,
        strategy: p.strategy || (p.is_automated ? 'automated' : 'manual'),
        opened_at: p.created_at,
        status: 'open' as const,
      }))
    : []; // Empty array - no fake sample data

  // Calculate stats
  const stats = {
    total_positions: positions.length,
    total_value: positions.reduce((sum, p) => sum + p.size, 0),
    total_pnl: positions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0),
    total_pnl_pct: positions.reduce((sum, p) => sum + p.size, 0) > 0 
      ? (positions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0) / positions.reduce((sum, p) => sum + p.size, 0)) * 100 
      : 0,
    winning_positions: positions.filter(p => (p.unrealized_pnl || 0) > 0).length,
    losing_positions: positions.filter(p => (p.unrealized_pnl || 0) < 0).length,
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Filter positions
  const filteredPositions = positions.filter(p => {
    if (filter === 'prediction' && !['polymarket', 'kalshi'].includes(p.platform.toLowerCase())) return false;
    if (filter === 'crypto' && ['polymarket', 'kalshi', 'alpaca', 'ibkr'].includes(p.platform.toLowerCase())) return false;
    if (filter === 'stock' && !['alpaca', 'ibkr'].includes(p.platform.toLowerCase())) return false;
    if (strategyFilter && p.strategy !== strategyFilter) return false;
    return true;
  });

  // Get unique strategies for filter
  const strategies = [...new Set(positions.map(p => p.strategy))];

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="text-purple-400" />
            Open Positions
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor all active trading positions across platforms
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Open Positions</p>
              <p className="text-2xl font-bold mt-1">{stats.total_positions}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-400">Total Value</p>
                <p className="text-2xl font-bold mt-1">
                  ${stats.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500/50" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`card ${stats.total_pnl >= 0 ? 'bg-gradient-to-br from-green-500/10' : 'bg-gradient-to-br from-red-500/10'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Unrealized P&L</p>
                <p className={`text-2xl font-bold mt-1 ${stats.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl.toFixed(2)}
                </p>
              </div>
              {stats.total_pnl >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-500/50" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500/50" />
              )}
            </div>
            <p className={`text-xs mt-1 ${stats.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.total_pnl_pct >= 0 ? '+' : ''}{stats.total_pnl_pct.toFixed(2)}%
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Winning</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{stats.winning_positions}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500/50" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Losing</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{stats.losing_positions}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/50" />
            </div>
          </motion.div>
        </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">Filter:</span>
        </div>
        <div className="flex gap-2">
          {(['all', 'prediction', 'crypto', 'stock'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        
        {strategies.length > 1 && (
          <>
            <div className="h-6 w-px bg-gray-700" />
            <select
              value={strategyFilter || ''}
              onChange={(e) => setStrategyFilter(e.target.value || null)}
              className="bg-gray-700 text-sm rounded-lg px-3 py-1.5 border border-gray-600"
              aria-label="Filter by strategy"
              title="Filter by strategy"
            >
              <option value="">All Strategies</option>
              {strategies.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Positions Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    Side
                    <Tooltip content={FIELD_TOOLTIPS.side}>
                      <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    Size
                    <Tooltip content={FIELD_TOOLTIPS.size}>
                      <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    Entry
                    <Tooltip content={FIELD_TOOLTIPS.entry}>
                      <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    Current
                    <Tooltip content={FIELD_TOOLTIPS.current}>
                      <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    P&L
                    <Tooltip content={FIELD_TOOLTIPS.pnl}>
                      <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    Strategy
                    <Tooltip content={FIELD_TOOLTIPS.strategy}>
                      <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredPositions.length > 0 ? (
                  filteredPositions.map((position, index) => (
                    <motion.tr
                      key={position.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-gray-800 hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {platformIcons[position.platform.toLowerCase()] || '💰'}
                          </span>
                          <span className="font-medium">{position.platform}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate">{position.market}</p>
                          {position.market_slug && (
                            <p className="text-xs text-gray-500">{position.market_slug}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                          ['yes', 'long', 'buy'].includes(position.side.toLowerCase())
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {position.side}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium">
                        ${position.size.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-gray-400">
                        ${position.entry_price.toLocaleString(undefined, { 
                          minimumFractionDigits: position.entry_price < 1 ? 4 : 2 
                        })}
                      </td>
                      <td className="px-4 py-4">
                        ${position.current_price?.toLocaleString(undefined, { 
                          minimumFractionDigits: (position.current_price || 0) < 1 ? 4 : 2 
                        }) || '-'}
                      </td>
                      <td className="px-4 py-4">
                        {position.unrealized_pnl !== undefined ? (
                          <div className={position.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            <div className="flex items-center gap-1">
                              {position.unrealized_pnl >= 0 ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                              ${Math.abs(position.unrealized_pnl).toFixed(2)}
                            </div>
                            <p className="text-xs opacity-75">
                              {position.unrealized_pnl_pct !== undefined && (
                                <>({position.unrealized_pnl_pct >= 0 ? '+' : ''}{position.unrealized_pnl_pct.toFixed(2)}%)</>
                              )}
                            </p>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${strategyColors[position.strategy] || 'bg-gray-500/20 text-gray-400'}`}>
                          {position.strategy.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(position.opened_at).toLocaleDateString()}
                        </div>
                        <p className="text-xs">
                          {new Date(position.opened_at).toLocaleTimeString()}
                        </p>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No open positions</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Positions will appear here when strategies execute trades
                      </p>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Strategy Legend</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(strategyColors).map(([strategy, color]) => (
            <span key={strategy} className={`px-2 py-1 rounded text-xs ${color}`}>
              {strategy.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
