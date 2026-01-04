'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Building2,
  Coins,
  BarChart3,
  Key,
  Settings,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useConnectionSummary, useConnectedPlatforms, useBotStatus, useSimulationStats, useRealTimeStats, useLiveBalances } from '@/lib/hooks';
import { useTier } from '@/lib/useTier';
import { usePlatforms } from '@/lib/PlatformContext';
import { TradingModeToggle } from '@/components/TradingModeToggle';
import { PlatformFilter } from '@/components/PlatformFilter';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PlatformBalance {
  platform: string;
  platform_type: string;
  total_usd: number;
  cash_balance: number;
  positions_value: number;
  positions_count: number;
  currency: string;
  error: string | null;
  last_updated: string;
}

interface AggregatedBalance {
  total_portfolio_usd: number;
  total_cash_usd: number;
  total_positions_usd: number;
  platforms: PlatformBalance[];
  updated_at: string;
}

interface BalanceHistory {
  total_portfolio_usd: number;
  snapshot_at: string;
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

const platformColors: Record<string, string> = {
  prediction_market: 'from-purple-500/20 to-blue-500/20 border-purple-500/30',
  crypto_exchange: 'from-orange-500/20 to-yellow-500/20 border-orange-500/30',
  stock_broker: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
};

export default function BalancesPage() {
  const [balance, setBalance] = useState<AggregatedBalance | null>(null);
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Get trading mode from tier context (SOURCE OF TRUTH)
  const { isSimulation: isUserSimMode, isLoading: tierLoading } = useTier();
  const tradingMode = isUserSimMode ? 'paper' : 'live';
  const isLiveMode = tradingMode === 'live';
  
  // Platform filtering context
  const { filterByPlatform, connectedIds } = usePlatforms();

  // Get connected platforms from centralized secrets
  const { data: connectedPlatforms = [] } = useConnectedPlatforms();
  const connectionSummary = useConnectionSummary();
  const { data: botStatus } = useBotStatus();
  const { data: simStats } = useSimulationStats();
  
  // Get real-time stats filtered by trading mode
  const { data: realTimeStats } = useRealTimeStats(undefined, tradingMode);
  
  // Fetch LIVE balances from connected exchanges
  const { data: liveBalances, isLoading: liveBalancesLoading } = useLiveBalances();
  
  // Use tier context as source of truth for simulation mode
  const isSimulation = isUserSimMode;
  const simulatedBalance = realTimeStats?.simulated_balance ?? simStats?.simulated_balance ?? 30000;
  
  // For LIVE mode: use actual exchange balances from useLiveBalances hook
  // For PAPER mode: use simulated balance from trades
  const displayBalance = isLiveMode ? (liveBalances?.total_usd ?? 0) : simulatedBalance;

  useEffect(() => {
    fetchBalances();
    fetchHistory();
  }, []);

  const fetchBalances = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('polybot_balances')
        .select('*')
        .eq('id', 1)
        .single();

      if (fetchError) throw fetchError;

      setBalance({
        total_portfolio_usd: parseFloat(data.total_portfolio_usd) || 0,
        total_cash_usd: parseFloat(data.total_cash_usd) || 0,
        total_positions_usd: parseFloat(data.total_positions_usd) || 0,
        platforms: data.platforms || [],
        updated_at: data.updated_at,
      });
    } catch (err: any) {
      console.error('Error fetching balances:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('polybot_balance_history')
        .select('total_portfolio_usd, snapshot_at')
        .order('snapshot_at', { ascending: false })
        .limit(30);

      if (fetchError) throw fetchError;
      setHistory(data || []);
    } catch (err: any) {
      console.error('Error fetching history:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBalances();
    await fetchHistory();
    setRefreshing(false);
  };

  // Calculate 24h change
  const lastBalance = history.length > 1 ? history[history.length - 1].total_portfolio_usd : 0;
  const change24h = balance && lastBalance > 0 
    ? ((balance.total_portfolio_usd - lastBalance) / lastBalance) * 100 
    : 0;

  // Group platforms by type - filtered by platform context
  const filteredPlatforms = useMemo(() => {
    if (!balance?.platforms) return [];
    
    // Filter by platform context (simulation shows all, live shows connected)
    let platforms = filterByPlatform(balance.platforms, 'platform');
    
    // Apply user-selected platform filter
    if (selectedPlatforms.length > 0) {
      platforms = platforms.filter(p => 
        selectedPlatforms.some(sp => p.platform.toLowerCase().includes(sp.toLowerCase()))
      );
    }
    
    return platforms;
  }, [balance?.platforms, filterByPlatform, selectedPlatforms]);

  const predictionMarkets = filteredPlatforms.filter(p => p.platform_type === 'prediction_market');
  const cryptoExchanges = filteredPlatforms.filter(p => p.platform_type === 'crypto_exchange');
  const stockBrokers = filteredPlatforms.filter(p => p.platform_type === 'stock_broker');

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    return {
      total_portfolio_usd: filteredPlatforms.reduce((sum, p) => sum + (p.total_usd || 0), 0),
      total_cash_usd: filteredPlatforms.reduce((sum, p) => sum + (p.cash_balance || 0), 0),
      total_positions_usd: filteredPlatforms.reduce((sum, p) => sum + (p.positions_value || 0), 0),
    };
  }, [filteredPlatforms]);

  if (loading || tierLoading) {
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
            <Wallet className="text-green-400" />
            Portfolio Balances
            {/* Simulation/Live Badge - uses tier context, not platform context */}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              isUserSimMode 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}>
              {isUserSimMode ? '🧪 Paper Trading' : '⚡ Live Trading'}
            </span>
          </h1>
          <p className="text-gray-400 mt-1">
            {isUserSimMode 
              ? 'Viewing simulated balances (paper trading mode)'
              : `Viewing real balances from ${connectionSummary.totalConnected} connected platform${connectionSummary.totalConnected !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PlatformFilter
            selectedPlatforms={selectedPlatforms}
            onPlatformChange={setSelectedPlatforms}
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">
                {isLiveMode ? 'Live Portfolio' : 'Simulated Portfolio'}
              </p>
              <p className="text-3xl font-bold text-green-400 mt-1">
                ${displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500/50" />
          </div>
          {isLiveMode && change24h !== 0 && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${change24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change24h > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(change24h).toFixed(2)}% (24h)
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Cash Balance</p>
              <p className="text-2xl font-bold mt-1">
                ${isLiveMode 
                  ? (liveBalances?.total_cash_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                  : displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })
                }
              </p>
            </div>
            <Coins className="w-8 h-8 text-blue-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Available for trading</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">In Positions</p>
              <p className="text-2xl font-bold mt-1">
                ${balance?.total_positions_usd.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Active positions</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Connected Platforms</p>
              <p className="text-2xl font-bold mt-1">
                {connectionSummary.totalConnected}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-orange-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {balance?.updated_at ? new Date(balance.updated_at).toLocaleTimeString() : 'Never'}
          </p>
        </motion.div>
      </div>

      {/* Portfolio Distribution */}
      {balance && balance.platforms.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieChart className="text-purple-400" />
            Portfolio Distribution
          </h2>
          <div className="flex flex-wrap gap-3">
            {balance.platforms.map((platform) => {
              const percentage = balance.total_portfolio_usd > 0 
                ? (platform.total_usd / balance.total_portfolio_usd) * 100 
                : 0;
              return (
                <div 
                  key={platform.platform}
                  className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2"
                >
                  <span className="text-lg">{platformIcons[platform.platform.toLowerCase()] || '💰'}</span>
                  <span className="font-medium">{platform.platform}</span>
                  <span className="text-gray-400">{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Platform Sections */}
      <div className="space-y-6">
        {/* Prediction Markets */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Prediction Markets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectionSummary.predictionMarkets.map((platform) => (
              <ConnectedPlatformCard key={platform.name} platform={platform} isSimulation={isSimulation} />
            ))}
          </div>
        </div>

        {/* Crypto Exchanges */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">₿</span>
            Crypto Exchanges
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectionSummary.cryptoExchanges.map((platform) => (
              <ConnectedPlatformCard key={platform.name} platform={platform} isSimulation={isSimulation} />
            ))}
          </div>
        </div>

        {/* Stock Brokers */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Stock Brokers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectionSummary.stockBrokers.map((platform) => (
              <ConnectedPlatformCard key={platform.name} platform={platform} isSimulation={isSimulation} />
            ))}
          </div>
        </div>
      </div>

      {/* Balance History Chart */}
      {history.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-400" />
            Balance History
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={[...history].reverse().map(h => ({
                  date: new Date(h.snapshot_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: h.total_portfolio_usd,
                }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  width={60}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Portfolio Value']}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#balanceGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Last {history.length} snapshots
          </p>
        </div>
      )}
    </div>
  );
}

function PlatformCard({ platform }: { platform: PlatformBalance }) {
  const colorClass = platformColors[platform.platform_type] || 'border-gray-500/30';
  const icon = platformIcons[platform.platform.toLowerCase()] || '💰';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`card bg-gradient-to-br ${colorClass} p-5`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-bold">{platform.platform}</h3>
            <p className="text-xs text-gray-400 capitalize">
              {platform.platform_type.replace('_', ' ')}
            </p>
          </div>
        </div>
        {platform.error ? (
          <AlertCircle className="w-5 h-5 text-red-400" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        )}
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-400">Total Value</p>
          <p className="text-xl font-bold text-white">
            ${platform.total_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700/50">
          <div>
            <p className="text-xs text-gray-500">Cash</p>
            <p className="font-medium">${platform.cash_balance.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Positions</p>
            <p className="font-medium">{platform.positions_count} open</p>
          </div>
        </div>
        
        {platform.error && (
          <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400">
            {platform.error}
          </div>
        )}
        
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {new Date(platform.last_updated).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}

// New component that shows connection status from secrets
function ConnectedPlatformCard({ platform, isSimulation }: { platform: { name: string; type: string; icon: string; connected: boolean; keys_configured: string[]; keys_missing: string[] }; isSimulation: boolean }) {
  const colorClasses: Record<string, string> = {
    prediction_market: 'from-purple-500/20 to-blue-500/20 border-purple-500/30',
    crypto_exchange: 'from-orange-500/20 to-yellow-500/20 border-orange-500/30',
    stock_broker: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
  };
  
  const colorClass = colorClasses[platform.type] || 'border-gray-500/30';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`card bg-gradient-to-br ${colorClass} p-5`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{platform.icon}</span>
          <div>
            <h3 className="font-bold">{platform.name}</h3>
            <p className="text-xs text-gray-400 capitalize">
              {platform.type.replace('_', ' ')}
            </p>
          </div>
        </div>
        {platform.connected ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <AlertCircle className="w-5 h-5 text-yellow-400" />
        )}
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-400">Status</p>
          <p className={`text-lg font-bold ${platform.connected ? 'text-green-400' : 'text-yellow-400'}`}>
            {platform.connected ? 'Connected' : 'Not Configured'}
          </p>
        </div>
        
        {platform.connected ? (
          <div className="pt-3 border-t border-gray-700/50">
            <p className="text-xs text-gray-500 mb-2">API Keys Configured:</p>
            <div className="flex flex-wrap gap-1">
              {platform.keys_configured.map(key => (
                <span key={key} className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                  {key.replace(/_/g, ' ').toLowerCase()}
                </span>
              ))}
            </div>
            {isSimulation && (
              <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                <span>📝</span> Paper trading mode - no real trades
              </p>
            )}
          </div>
        ) : (
          <div className="pt-3 border-t border-gray-700/50">
            <p className="text-xs text-gray-500 mb-2">Missing Keys:</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {platform.keys_missing.map(key => (
                <span key={key} className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                  {key.replace(/_/g, ' ').toLowerCase()}
                </span>
              ))}
            </div>
            <Link 
              href="/secrets"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs transition-colors"
            >
              <Key className="w-3 h-3" />
              Configure API Keys
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EmptyPlatformCard({ type }: { type: string }) {
  const messages: Record<string, { title: string; link: string }> = {
    prediction_market: { title: 'Connect Polymarket or Kalshi', link: '/secrets' },
    crypto_exchange: { title: 'Connect a crypto exchange', link: '/secrets' },
    stock_broker: { title: 'Connect Alpaca or IBKR', link: '/secrets' },
  };
  
  const { title, link } = messages[type] || { title: 'Connect a platform', link: '/secrets' };
  
  return (
    <div className="card p-6 border-dashed border-2 border-gray-700 text-center">
      <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-3" />
      <p className="text-gray-400 mb-3">{title}</p>
      <a 
        href={link}
        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition-colors"
      >
        Configure API Keys
      </a>
    </div>
  );
}
