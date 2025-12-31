'use client';

import { useUserExchanges } from '@/lib/hooks';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  TrendingUp, 
  BarChart2, 
  Target,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

// Exchange icons/logos (using emoji for now, can be replaced with actual logos)
const EXCHANGE_ICONS: Record<string, string> = {
  polymarket: '🔮',
  kalshi: '📊',
  alpaca: '🦙',
  binance: '🟡',
  bybit: '🔶',
  okx: '⬡',
  kraken: '🐙',
  coinbase: '🔵',
  kucoin: '🟢',
  ibkr: '🏛️',
  robinhood: '🪶',
  webull: '🐂',
};

interface ConnectedExchangesBadgeProps {
  compact?: boolean;
  showDetails?: boolean;
}

export function ConnectedExchangesBadge({ 
  compact = false, 
  showDetails = true 
}: ConnectedExchangesBadgeProps) {
  const { data: exchangesData, isLoading, error } = useUserExchanges();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-dark-card border border-dark-border rounded-xl">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Loading exchanges...</span>
      </div>
    );
  }

  if (error || !exchangesData) {
    // Don't show scary error on dashboard - just show subtle "loading" or skip
    // This prevents the red "Connect exchanges" banner when API is slow or has hiccups
    return null;
  }

  const { 
    connected_exchange_ids, 
    has_crypto, 
    has_stocks, 
    has_prediction_markets,
    total_connected 
  } = exchangesData;

  if (total_connected === 0) {
    return (
      <Link 
        href="/settings/exchanges"
        className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/20 transition-colors"
      >
        <AlertCircle className="w-4 h-4 text-yellow-400" />
        <span className="text-sm text-yellow-400">No exchanges connected</span>
      </Link>
    );
  }

  if (compact) {
    return (
      <Link 
        href="/settings/exchanges"
        className="flex items-center gap-2 px-3 py-1.5 bg-neon-green/10 border border-neon-green/30 rounded-xl hover:bg-neon-green/20 transition-colors"
      >
        <CheckCircle2 className="w-4 h-4 text-neon-green" />
        <span className="text-sm text-neon-green font-medium">{total_connected} Connected</span>
        <div className="flex -space-x-1">
          {connected_exchange_ids.slice(0, 3).map((id) => (
            <span key={id} className="text-xs" title={id}>
              {EXCHANGE_ICONS[id] || '📦'}
            </span>
          ))}
          {connected_exchange_ids.length > 3 && (
            <span className="text-xs text-gray-400">+{connected_exchange_ids.length - 3}</span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card border border-dark-border rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-neon-green" />
          <h3 className="font-semibold text-white">Connected Platforms</h3>
        </div>
        <Link 
          href="/settings/exchanges"
          className="text-xs text-neon-blue hover:text-neon-blue/80 transition-colors"
        >
          Manage →
        </Link>
      </div>

      {/* Platform type indicators */}
      <div className="flex flex-wrap gap-2 mb-3">
        {has_prediction_markets && (
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-lg">
            <Target className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-purple-400">Prediction Markets</span>
          </div>
        )}
        {has_crypto && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-lg">
            <TrendingUp className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-yellow-400">Crypto</span>
          </div>
        )}
        {has_stocks && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded-lg">
            <BarChart2 className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-blue-400">Stocks</span>
          </div>
        )}
      </div>

      {/* Connected exchanges list */}
      {showDetails && (
        <div className="flex flex-wrap gap-2">
          {connected_exchange_ids.map((id) => {
            const exchange = exchangesData.exchanges.find(e => e.id === id);
            return (
              <div 
                key={id}
                className="flex items-center gap-1.5 px-2 py-1 bg-dark-border rounded-lg"
                title={exchange?.name || id}
              >
                <span className="text-sm">{EXCHANGE_ICONS[id] || '📦'}</span>
                <span className="text-xs text-gray-300 capitalize">{exchange?.name || id}</span>
                <CheckCircle2 className="w-3 h-3 text-neon-green" />
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-dark-border">
        <p className="text-xs text-gray-400">
          {total_connected} platform{total_connected !== 1 ? 's' : ''} connected • 
          Data flows from all connected exchanges
        </p>
      </div>
    </motion.div>
  );
}

// Minimal inline badge for headers
export function ExchangeStatusDot() {
  const { data: exchangesData, isLoading } = useUserExchanges();

  if (isLoading) {
    return <span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />;
  }

  const connected = exchangesData?.total_connected || 0;
  
  if (connected === 0) {
    return (
      <span 
        className="w-2 h-2 rounded-full bg-yellow-500" 
        title="No exchanges connected" 
      />
    );
  }

  return (
    <span 
      className="w-2 h-2 rounded-full bg-neon-green" 
      title={`${connected} exchange${connected !== 1 ? 's' : ''} connected`} 
    />
  );
}
