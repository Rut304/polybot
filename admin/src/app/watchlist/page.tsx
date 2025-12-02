'use client';

import { useState, useMemo } from 'react';
import { 
  Star, 
  TrendingUp, 
  TrendingDown,
  Trash2,
  Bell,
  BellOff,
  ExternalLink,
  Search,
  Plus,
  Edit2,
  BarChart3,
  Clock,
  DollarSign,
  Target,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useWatchlist, 
  useRemoveFromWatchlist,
  useUpdateWatchlistItem,
  useMarketPerformance,
  useMarketTrades,
} from '@/lib/hooks';
import { formatCurrency, formatPercent, cn, timeAgo } from '@/lib/utils';

interface MarketDetailModalProps {
  marketId: string | null;
  onClose: () => void;
}

function MarketDetailModal({ marketId, onClose }: MarketDetailModalProps) {
  const { data: allPerformance } = useMarketPerformance();
  const { data: trades = [] } = useMarketTrades(marketId || '');
  
  const performance = allPerformance?.find(p => p.market_id === marketId);
  
  if (!marketId || !performance) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold mb-2">{performance.market_title}</h2>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                performance.platform === 'polymarket' 
                  ? "bg-[#5865F2]/20 text-[#5865F2]"
                  : "bg-[#00C853]/20 text-[#00C853]"
              )}>
                {performance.platform}
              </span>
              <span className="text-sm text-gray-400">
                {performance.total_trades} trades
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-border rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-dark-bg/50 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Total P&L</div>
            <div className={cn(
              "text-xl font-bold",
              performance.total_pnl >= 0 ? "text-neon-green" : "text-red-400"
            )}>
              {formatCurrency(performance.total_pnl)}
            </div>
          </div>
          <div className="bg-dark-bg/50 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Win Rate</div>
            <div className="text-xl font-bold text-neon-blue">
              {performance.win_rate.toFixed(1)}%
            </div>
          </div>
          <div className="bg-dark-bg/50 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">W / L</div>
            <div className="text-xl font-bold">
              <span className="text-neon-green">{performance.winning_trades}</span>
              <span className="text-gray-500"> / </span>
              <span className="text-red-400">{performance.losing_trades}</span>
            </div>
          </div>
          <div className="bg-dark-bg/50 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Avg Trade</div>
            <div className="text-xl font-bold text-white">
              {formatCurrency(performance.avg_trade_size)}
            </div>
          </div>
        </div>
        
        {/* Recent Trades */}
        <div className="flex-1 overflow-hidden">
          <h3 className="font-semibold mb-3">Recent Trades</h3>
          <div className="overflow-y-auto max-h-[300px] space-y-2">
            {trades.map(trade => (
              <div 
                key={trade.id}
                className="bg-dark-bg/30 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    trade.outcome === 'won' && "bg-neon-green/20 text-neon-green",
                    trade.outcome === 'lost' && "bg-red-500/20 text-red-400",
                    trade.outcome === 'pending' && "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {trade.outcome?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm">{trade.trade_type}</div>
                    <div className="text-xs text-gray-500">{timeAgo(trade.created_at)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{formatCurrency(trade.position_size_usd)}</div>
                  <div className={cn(
                    "text-xs",
                    (trade.actual_profit_usd || 0) >= 0 ? "text-neon-green" : "text-red-400"
                  )}>
                    {trade.outcome !== 'pending' && formatCurrency(trade.actual_profit_usd || 0)}
                  </div>
                </div>
              </div>
            ))}
            {trades.length === 0 && (
              <div className="text-center text-gray-500 py-8">No trades found</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function WatchlistPage() {
  const { data: watchlist = [], isLoading } = useWatchlist();
  const { data: performance = [] } = useMarketPerformance();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const updateWatchlistItem = useUpdateWatchlistItem();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<string | null>(null);
  const [alertAbove, setAlertAbove] = useState<string>('');
  const [alertBelow, setAlertBelow] = useState<string>('');
  
  // Combine watchlist with performance data
  const enrichedWatchlist = useMemo(() => {
    return watchlist.map(item => {
      const perf = performance.find(p => p.market_id === item.market_id);
      return {
        ...item,
        total_trades: perf?.total_trades || 0,
        total_pnl: perf?.total_pnl || 0,
        win_rate: perf?.win_rate || 0,
      };
    });
  }, [watchlist, performance]);
  
  // Filter by search
  const filteredWatchlist = useMemo(() => {
    if (!searchQuery) return enrichedWatchlist;
    const query = searchQuery.toLowerCase();
    return enrichedWatchlist.filter(item => 
      item.market_title?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  }, [enrichedWatchlist, searchQuery]);
  
  const handleSaveAlert = (marketId: string) => {
    updateWatchlistItem.mutate({
      marketId,
      updates: {
        alert_above: alertAbove ? parseFloat(alertAbove) : undefined,
        alert_below: alertBelow ? parseFloat(alertBelow) : undefined,
      },
    });
    setEditingAlert(null);
    setAlertAbove('');
    setAlertBelow('');
  };
  
  return (
    <div className="p-8">
      {/* Market Detail Modal */}
      <AnimatePresence>
        {selectedMarket && (
          <MarketDetailModal
            marketId={selectedMarket}
            onClose={() => setSelectedMarket(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-400" />
            Watchlist
          </h1>
          <p className="text-gray-400 mt-2">Track markets and monitor your performance</p>
        </div>
        <a
          href="/markets"
          className="flex items-center gap-2 px-4 py-2 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-lg hover:bg-neon-green/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Markets
        </a>
      </div>
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search watchlist..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-dark-card border border-dark-border rounded-xl focus:border-neon-green/50 focus:outline-none transition-colors"
        />
      </div>
      
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{watchlist.length}</div>
              <div className="text-sm text-gray-400">Watching</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-green/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-neon-green" />
            </div>
            <div>
              <div className={cn(
                "text-2xl font-bold",
                enrichedWatchlist.reduce((sum, w) => sum + w.total_pnl, 0) >= 0 
                  ? "text-neon-green" 
                  : "text-red-400"
              )}>
                {formatCurrency(enrichedWatchlist.reduce((sum, w) => sum + w.total_pnl, 0))}
              </div>
              <div className="text-sm text-gray-400">Total P&L</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-blue/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-neon-blue" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {enrichedWatchlist.reduce((sum, w) => sum + w.total_trades, 0)}
              </div>
              <div className="text-sm text-gray-400">Total Trades</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-purple/20 rounded-lg">
              <Bell className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {watchlist.filter(w => w.alert_above || w.alert_below).length}
              </div>
              <div className="text-sm text-gray-400">Active Alerts</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Watchlist Items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full" />
        </div>
      ) : filteredWatchlist.length === 0 ? (
        <div className="card text-center py-16">
          <Star className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No markets in watchlist</h3>
          <p className="text-gray-400 mb-6">
            Add markets from the Markets browser to track them here
          </p>
          <a
            href="/markets"
            className="inline-flex items-center gap-2 px-6 py-3 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-lg hover:bg-neon-green/30 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Browse Markets
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWatchlist.map((item) => (
            <motion.div
              key={item.market_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card hover:border-neon-green/30 transition-colors cursor-pointer"
              onClick={() => setSelectedMarket(item.market_id)}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Market Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      item.platform === 'polymarket' 
                        ? "bg-[#5865F2]/20 text-[#5865F2]"
                        : "bg-[#00C853]/20 text-[#00C853]"
                    )}>
                      {item.platform}
                    </span>
                    {item.category && (
                      <span className="text-xs text-gray-500">{item.category}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-1 truncate">{item.market_title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Added {timeAgo(item.added_at)}
                    </span>
                    {item.notes && (
                      <span className="text-gray-500 truncate max-w-[200px]">
                        📝 {item.notes}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Trades</div>
                    <div className="text-lg font-bold">{item.total_trades}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Win Rate</div>
                    <div className="text-lg font-bold text-neon-blue">
                      {item.win_rate.toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">P&L</div>
                    <div className={cn(
                      "text-lg font-bold",
                      item.total_pnl >= 0 ? "text-neon-green" : "text-red-400"
                    )}>
                      {formatCurrency(item.total_pnl)}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {/* Alert Button */}
                  <button
                    onClick={() => {
                      if (editingAlert === item.market_id) {
                        setEditingAlert(null);
                      } else {
                        setEditingAlert(item.market_id);
                        setAlertAbove(item.alert_above?.toString() || '');
                        setAlertBelow(item.alert_below?.toString() || '');
                      }
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      item.alert_above || item.alert_below
                        ? "bg-neon-purple/20 text-neon-purple"
                        : "hover:bg-dark-border text-gray-400"
                    )}
                    title="Set price alert"
                  >
                    {item.alert_above || item.alert_below ? (
                      <Bell className="w-5 h-5" />
                    ) : (
                      <BellOff className="w-5 h-5" />
                    )}
                  </button>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromWatchlist.mutate(item.market_id)}
                    className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                    title="Remove from watchlist"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Alert Editor */}
              <AnimatePresence>
                {editingAlert === item.market_id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-dark-border">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="text-sm text-gray-400 mb-1 block">Alert above price</label>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-neon-green" />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="e.g., 0.65"
                              value={alertAbove}
                              onChange={(e) => setAlertAbove(e.target.value)}
                              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:border-neon-green/50 focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-sm text-gray-400 mb-1 block">Alert below price</label>
                          <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-400" />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="e.g., 0.35"
                              value={alertBelow}
                              onChange={(e) => setAlertBelow(e.target.value)}
                              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:border-neon-green/50 focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveAlert(item.market_id)}
                          className="px-4 py-2 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-lg hover:bg-neon-green/30 transition-colors mt-5"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
