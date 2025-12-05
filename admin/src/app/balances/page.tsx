'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

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

  // Group platforms by type
  const predictionMarkets = balance?.platforms.filter(p => p.platform_type === 'prediction_market') || [];
  const cryptoExchanges = balance?.platforms.filter(p => p.platform_type === 'crypto_exchange') || [];
  const stockBrokers = balance?.platforms.filter(p => p.platform_type === 'stock_broker') || [];

  if (loading) {
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
          </h1>
          <p className="text-gray-400 mt-1">
            Aggregated view of all connected trading accounts
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
              <p className="text-sm text-gray-400">Total Portfolio</p>
              <p className="text-3xl font-bold text-green-400 mt-1">
                ${balance?.total_portfolio_usd.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500/50" />
          </div>
          {change24h !== 0 && (
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
                ${balance?.total_cash_usd.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
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
                {balance?.platforms.length || 0}
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
          {predictionMarkets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictionMarkets.map((platform) => (
                <PlatformCard key={platform.platform} platform={platform} />
              ))}
            </div>
          ) : (
            <EmptyPlatformCard type="prediction_market" />
          )}
        </div>

        {/* Crypto Exchanges */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">₿</span>
            Crypto Exchanges
          </h2>
          {cryptoExchanges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cryptoExchanges.map((platform) => (
                <PlatformCard key={platform.platform} platform={platform} />
              ))}
            </div>
          ) : (
            <EmptyPlatformCard type="crypto_exchange" />
          )}
        </div>

        {/* Stock Brokers */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Stock Brokers
          </h2>
          {stockBrokers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockBrokers.map((platform) => (
                <PlatformCard key={platform.platform} platform={platform} />
              ))}
            </div>
          ) : (
            <EmptyPlatformCard type="stock_broker" />
          )}
        </div>
      </div>

      {/* Balance History Chart Placeholder */}
      {history.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-400" />
            Balance History
          </h2>
          <div className="h-48 flex items-center justify-center bg-gray-800/50 rounded-lg">
            <div className="text-center text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Chart visualization coming soon</p>
              <p className="text-sm mt-1">{history.length} data points available</p>
            </div>
          </div>
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
