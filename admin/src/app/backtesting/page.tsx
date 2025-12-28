'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical,
  Play,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  BarChart3,
  Trash2,
  Eye,
  Plus,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface Backtest {
  id: string;
  name: string;
  strategy_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_date: string;
  end_date: string;
  initial_capital?: number;
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  total_pnl?: number;
  max_drawdown?: number;
  sharpe_ratio?: number;
  win_rate?: number;
  avg_trade_return?: number;
  results?: {
    equity_curve: { date: string; equity: number }[];
    monthly_returns: Record<string, number>;
  };
  trades?: any[];
  created_at: string;
  error_message?: string;
}

const STRATEGIES = [
  { value: 'polymarket_single', label: 'Polymarket Single', description: 'Trade individual prediction markets' },
  { value: 'kalshi_single', label: 'Kalshi Single', description: 'Event-based prediction markets' },
  { value: 'cross_platform', label: 'Cross-Platform Arbitrage', description: 'Find price discrepancies' },
  { value: 'overlapping_arb', label: 'Overlapping Arbitrage', description: 'Related market arbitrage' },
  { value: 'rsi', label: 'RSI Strategy', description: 'Mean reversion based on RSI' },
  { value: 'momentum', label: 'Momentum', description: 'Follow the trend' },
  { value: 'congressional', label: 'Congressional Tracker', description: 'Mirror Congress trades' },
];

export default function BacktestingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewBacktest, setShowNewBacktest] = useState(false);
  const [selectedBacktest, setSelectedBacktest] = useState<Backtest | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    strategy_type: 'kalshi_single',
    start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    initial_capital: 10000,
    position_size: 5,
    stop_loss: 10,
    take_profit: 20,
  });

  // Fetch backtests
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['backtests', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/backtests', {
        headers: { 'x-user-id': user?.id || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch backtests');
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 5000, // Poll for status updates
  });

  // Create backtest mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/backtests', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create backtest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtests'] });
      setShowNewBacktest(false);
      setFormData({
        name: '',
        strategy_type: 'kalshi_single',
        start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        initial_capital: 10000,
        position_size: 5,
        stop_loss: 10,
        take_profit: 20,
      });
    },
  });

  // Delete backtest mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/backtests?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      if (!res.ok) throw new Error('Failed to delete backtest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtests'] });
      setSelectedBacktest(null);
    },
  });

  // Fetch single backtest details
  const { data: backtestDetails } = useQuery({
    queryKey: ['backtest', selectedBacktest?.id],
    queryFn: async () => {
      const res = await fetch(`/api/backtests?id=${selectedBacktest?.id}`, {
        headers: { 'x-user-id': user?.id || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch backtest');
      return res.json();
    },
    enabled: !!selectedBacktest?.id && selectedBacktest?.status === 'completed',
  });

  const backtests: Backtest[] = data?.backtests || [];

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FlaskConical className="w-7 h-7 text-neon-green" />
              Backtesting
            </h1>
            <p className="text-gray-400 mt-1">Test strategies with historical data</p>
          </div>
          <button
            onClick={() => setShowNewBacktest(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neon-green text-black font-medium rounded-lg hover:bg-neon-green/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Backtest
          </button>
        </div>

        {/* Backtests List */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
            </div>
          ) : backtests.length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
              <FlaskConical className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Backtests Yet</h3>
              <p className="text-gray-400 mb-6">Create your first backtest to see how strategies would have performed.</p>
              <button
                onClick={() => setShowNewBacktest(true)}
                className="px-6 py-2 bg-neon-green text-black font-medium rounded-lg hover:bg-neon-green/90"
              >
                Create Backtest
              </button>
            </div>
          ) : (
            backtests.map((bt) => (
              <motion.div
                key={bt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-dark-card border rounded-xl p-6 cursor-pointer transition-all hover:border-neon-green/50",
                  selectedBacktest?.id === bt.id ? "border-neon-green" : "border-dark-border"
                )}
                onClick={() => setSelectedBacktest(bt)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-2 rounded-lg",
                      bt.status === 'completed' && "bg-emerald-500/10",
                      bt.status === 'running' && "bg-blue-500/10",
                      bt.status === 'pending' && "bg-yellow-500/10",
                      bt.status === 'failed' && "bg-red-500/10"
                    )}>
                      {bt.status === 'completed' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                      {bt.status === 'running' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                      {bt.status === 'pending' && <Clock className="w-5 h-5 text-yellow-400" />}
                      {bt.status === 'failed' && <XCircle className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{bt.name}</h3>
                      <p className="text-sm text-gray-400">
                        {STRATEGIES.find(s => s.value === bt.strategy_type)?.label || bt.strategy_type}
                        <span className="mx-2">•</span>
                        {bt.start_date} to {bt.end_date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {bt.status === 'completed' && (
                      <>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">P&L</p>
                          <p className={cn(
                            "font-semibold",
                            (bt.total_pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {(bt.total_pnl || 0) >= 0 ? '+' : ''}${(bt.total_pnl || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Win Rate</p>
                          <p className="font-semibold text-white">{(bt.win_rate || 0).toFixed(1)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Trades</p>
                          <p className="font-semibold text-white">{bt.total_trades || 0}</p>
                        </div>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(bt.id);
                      }}
                      title="Delete backtest"
                      aria-label="Delete backtest"
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Backtest Details Modal */}
        {selectedBacktest && selectedBacktest.status === 'completed' && backtestDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">{selectedBacktest.name} - Results</h2>
              <button
                onClick={() => setSelectedBacktest(null)}
                title="Close details"
                aria-label="Close details"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Total P&L</p>
                <p className={cn(
                  "text-2xl font-bold",
                  (backtestDetails.total_pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {(backtestDetails.total_pnl || 0) >= 0 ? '+' : ''}${(backtestDetails.total_pnl || 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-white">{(backtestDetails.win_rate || 0).toFixed(1)}%</p>
              </div>
              <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Max Drawdown</p>
                <p className="text-2xl font-bold text-red-400">-{(backtestDetails.max_drawdown || 0).toFixed(1)}%</p>
              </div>
              <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-white">{(backtestDetails.sharpe_ratio || 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Equity Curve */}
            {backtestDetails.results?.equity_curve && (
              <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-4">Equity Curve</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={backtestDetails.results.equity_curve}>
                      <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666"
                        tickFormatter={(val) => new Date(val).toLocaleDateString()}
                      />
                      <YAxis stroke="#666" tickFormatter={(val) => `$${val.toLocaleString()}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        labelFormatter={(val) => new Date(val).toLocaleDateString()}
                        formatter={(val: number) => [`$${val.toFixed(2)}`, 'Equity']}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="#10b981"
                        fill="url(#equityGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Trade List */}
            {backtestDetails.trades && backtestDetails.trades.length > 0 && (
              <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-4">Trades ({backtestDetails.trades.length})</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-400 border-b border-dark-border sticky top-0 bg-dark-bg">
                      <tr>
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Market</th>
                        <th className="text-left py-2 px-3">Side</th>
                        <th className="text-right py-2 px-3">Entry</th>
                        <th className="text-right py-2 px-3">Exit</th>
                        <th className="text-right py-2 px-3">P&L</th>
                        <th className="text-left py-2 px-3">Exit Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestDetails.trades.slice(0, 50).map((trade: any, i: number) => (
                        <tr key={i} className="border-b border-dark-border/50">
                          <td className="py-2 px-3 text-gray-300">
                            {new Date(trade.trade_date).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 text-white">{trade.symbol || trade.market_title}</td>
                          <td className={cn(
                            "py-2 px-3 font-medium",
                            trade.side === 'buy' ? "text-emerald-400" : "text-red-400"
                          )}>
                            {trade.side?.toUpperCase()}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-300">${trade.entry_price?.toFixed(4)}</td>
                          <td className="py-2 px-3 text-right text-gray-300">${trade.exit_price?.toFixed(4)}</td>
                          <td className={cn(
                            "py-2 px-3 text-right font-medium",
                            trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-gray-400 capitalize">{trade.exit_reason?.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* New Backtest Modal */}
        {showNewBacktest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-dark-card border border-dark-border rounded-xl p-6 w-full max-w-lg"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">New Backtest</h2>
                <button
                  onClick={() => setShowNewBacktest(false)}
                  title="Close modal"
                  aria-label="Close modal"
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Backtest"
                    className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-green"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Strategy</label>
                  <select
                    id="strategy-select"
                    title="Select strategy"
                    value={formData.strategy_type}
                    onChange={(e) => setFormData({ ...formData, strategy_type: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-neon-green"
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Start Date</label>
                    <input
                      type="date"
                      id="start-date"
                      title="Start date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-neon-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">End Date</label>
                    <input
                      type="date"
                      id="end-date"
                      title="End date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-neon-green"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Initial Capital ($)</label>
                    <input
                      type="number"
                      id="initial-capital"
                      title="Initial capital"
                      placeholder="10000"
                      value={formData.initial_capital}
                      onChange={(e) => setFormData({ ...formData, initial_capital: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-neon-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Position Size (%)</label>
                    <input
                      type="number"
                      id="position-size"
                      title="Position size percentage"
                      placeholder="5"
                      value={formData.position_size}
                      onChange={(e) => setFormData({ ...formData, position_size: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-neon-green"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Stop Loss (%)</label>
                    <input
                      type="number"
                      id="stop-loss"
                      title="Stop loss percentage"
                      placeholder="10"
                      value={formData.stop_loss}
                      onChange={(e) => setFormData({ ...formData, stop_loss: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-neon-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Take Profit (%)</label>
                    <input
                      type="number"
                      id="take-profit"
                      title="Take profit percentage"
                      placeholder="20"
                      value={formData.take_profit}
                      onChange={(e) => setFormData({ ...formData, take_profit: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-neon-green"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowNewBacktest(false)}
                    className="flex-1 px-4 py-2 bg-dark-bg border border-dark-border text-gray-300 rounded-lg hover:bg-dark-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createMutation.mutate(formData)}
                    disabled={!formData.name || createMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neon-green text-black font-medium rounded-lg hover:bg-neon-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run Backtest
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
