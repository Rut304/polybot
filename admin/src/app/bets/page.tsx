'use client';

import { useState } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Eye,
  EyeOff,
  DollarSign,
  Clock,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Ban,
  ShoppingCart,
  Plus,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulatedTrades, usePositions, useDisabledMarkets, useManualTrades } from '@/lib/hooks';
import { formatCurrency, formatPercent, timeAgo, cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ManualTradeModal } from '@/components/ManualTradeModal';
import { useAuth } from '@/lib/auth';

type FilterType = 'all' | 'automated' | 'manual' | 'polymarket' | 'kalshi';
type StatusFilter = 'all' | 'pending' | 'won' | 'lost';

interface BetCardProps {
  bet: {
    id: number;
    position_id: string;
    polymarket_market_title?: string;
    kalshi_market_title?: string;
    polymarket_token_id?: string;
    kalshi_ticker?: string;
    trade_type: string;
    position_size_usd: number;
    expected_profit_usd: number;
    expected_profit_pct: number;
    outcome: 'pending' | 'won' | 'lost' | 'expired';
    actual_profit_usd: number | null;
    created_at: string;
    is_automated?: boolean;
  };
  onDisable: (id: string, hasPosition: boolean) => void;
  isDisabled?: boolean;
}

function BetCard({ bet, onDisable, isDisabled }: BetCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const isPoly = !!bet.polymarket_token_id;
  const isKalshi = !!bet.kalshi_ticker;
  const isBoth = isPoly && isKalshi;
  
  const platformColor = isBoth 
    ? 'from-polymarket to-kalshi' 
    : isPoly 
      ? 'border-polymarket' 
      : 'border-kalshi';
  
  const outcomeColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    won: 'bg-green-500/20 text-green-400 border-green-500/30',
    lost: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const hasPosition = bet.outcome === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "relative rounded-xl overflow-hidden transition-all",
        isDisabled && "opacity-50",
        isBoth 
          ? "bg-gradient-to-r from-polymarket/10 to-kalshi/10 border-2 border-transparent bg-clip-padding"
          : `bg-dark-card border-2 ${isPoly ? 'border-polymarket/50' : 'border-kalshi/50'}`
      )}
      style={isBoth ? {
        background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.15), rgba(0, 200, 83, 0.15))',
        borderImage: 'linear-gradient(135deg, #5865F2, #00C853) 1',
      } : undefined}
    >
      {/* Platform indicator strip */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        isBoth 
          ? "bg-gradient-to-r from-polymarket to-kalshi"
          : isPoly ? "bg-polymarket" : "bg-kalshi"
      )} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Platform logos */}
            <div className="flex -space-x-2">
              {isPoly && (
                <div className="w-8 h-8 rounded-lg bg-polymarket flex items-center justify-center ring-2 ring-dark-bg z-10">
                  <span className="text-sm font-bold text-white">P</span>
                </div>
              )}
              {isKalshi && (
                <div className="w-8 h-8 rounded-lg bg-kalshi flex items-center justify-center ring-2 ring-dark-bg">
                  <span className="text-sm font-bold text-white">K</span>
                </div>
              )}
            </div>
            
            {/* Automated indicator */}
            {bet.is_automated !== false && (
              <div className="px-2 py-0.5 bg-neon-blue/20 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3 text-neon-blue" />
                <span className="text-xs text-neon-blue font-medium">Auto</span>
              </div>
            )}
          </div>

          {/* Outcome badge */}
          <div className={cn("px-2 py-1 rounded-full border text-xs font-medium", outcomeColors[bet.outcome])}>
            {bet.outcome.charAt(0).toUpperCase() + bet.outcome.slice(1)}
          </div>
        </div>

        {/* Market title */}
        <h3 className="font-semibold mb-2 line-clamp-2">
          {bet.polymarket_market_title || bet.kalshi_market_title || 'Unknown Market'}
        </h3>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-500">Position</p>
            <p className="font-semibold">{formatCurrency(bet.position_size_usd)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Expected</p>
            <p className={cn("font-semibold", bet.expected_profit_usd >= 0 ? "text-neon-green" : "text-red-400")}>
              {bet.expected_profit_usd >= 0 ? '+' : ''}{formatCurrency(bet.expected_profit_usd)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Actual</p>
            <p className={cn(
              "font-semibold",
              bet.outcome === 'pending' ? "text-gray-400" : 
                (bet.actual_profit_usd || 0) >= 0 ? "text-neon-green" : "text-red-400"
            )}>
              {bet.outcome === 'pending' ? '—' : 
                `${(bet.actual_profit_usd || 0) >= 0 ? '+' : ''}${formatCurrency(bet.actual_profit_usd || 0)}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-dark-border">
          <span className="text-xs text-gray-500">
            <Clock className="w-3 h-3 inline mr-1" />
            {timeAgo(bet.created_at)}
          </span>
          
          <div className="flex gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 text-xs bg-dark-border rounded-lg hover:bg-dark-border/80 transition-colors flex items-center gap-1"
            >
              {expanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {expanded ? 'Less' : 'Details'}
            </button>
            
            <button
              onClick={() => onDisable(bet.position_id, hasPosition)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1",
                isDisabled 
                  ? "bg-neon-green/20 text-neon-green hover:bg-neon-green/30"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              )}
            >
              <Ban className="w-3 h-3" />
              {isDisabled ? 'Enable' : 'Disable'}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-dark-border space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="overflow-hidden">
                    <p className="text-gray-500">Trade Type</p>
                    <p className="font-medium truncate" title={bet.trade_type}>
                      {bet.trade_type.replace('realistic_arb_', '').replace('_', ' → ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Expected ROI</p>
                    <p className="font-medium">{formatPercent(bet.expected_profit_pct)}</p>
                  </div>
                  {isPoly && (
                    <div className="overflow-hidden">
                      <p className="text-gray-500">Polymarket ID</p>
                      <p className="font-mono text-xs truncate" title={bet.polymarket_token_id}>{bet.polymarket_token_id}</p>
                    </div>
                  )}
                  {isKalshi && (
                    <div className="overflow-hidden">
                      <p className="text-gray-500">Kalshi Ticker</p>
                      <p className="font-mono text-xs truncate" title={bet.kalshi_ticker}>{bet.kalshi_ticker}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Sell confirmation modal
function SellConfirmModal({ 
  bet, 
  onConfirm, 
  onCancel 
}: { 
  bet: BetCardProps['bet']; 
  onConfirm: () => void; 
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-md mx-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-8 h-8 text-yellow-500" />
          <h3 className="text-xl font-semibold">Position Open</h3>
        </div>
        <p className="text-gray-400 mb-4">
          You have an open position worth <strong className="text-white">{formatCurrency(bet.position_size_usd)}</strong> on this market.
        </p>
        <p className="text-gray-400 mb-6">
          Disabling this market will also <strong className="text-red-400">sell your position</strong> at current market prices. This may result in a loss.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowDownRight className="w-4 h-4" />
            Sell & Disable
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-dark-border rounded-lg hover:bg-dark-border/80 transition-colors"
          >
            Keep Position
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function BetsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: trades = [] } = useSimulatedTrades(100);
  const { data: manualTrades = [] } = useManualTrades(50);
  const { data: disabledMarkets = [] } = useDisabledMarkets();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [confirmSell, setConfirmSell] = useState<BetCardProps['bet'] | null>(null);
  const [showTradeModal, setShowTradeModal] = useState(false);

  const disabledIds = new Set(disabledMarkets.map((m: { market_id: string }) => m.market_id));

  // Toggle disabled market
  const toggleDisabled = useMutation({
    mutationFn: async ({ marketId, disable }: { marketId: string; disable: boolean }) => {
      if (disable) {
        const { error } = await supabase
          .from('polybot_disabled_markets')
          .insert({ market_id: marketId, disabled_at: new Date().toISOString() });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('polybot_disabled_markets')
          .delete()
          .eq('market_id', marketId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disabledMarkets'] });
    },
  });

  const handleDisable = (positionId: string, hasPosition: boolean) => {
    const bet = trades.find(t => t.position_id === positionId);
    if (!bet) return;

    const isCurrentlyDisabled = disabledIds.has(positionId);
    
    if (!isCurrentlyDisabled && hasPosition) {
      // Show confirmation if they have an open position
      setConfirmSell(bet);
    } else {
      toggleDisabled.mutate({ marketId: positionId, disable: !isCurrentlyDisabled });
    }
  };

  const confirmDisableAndSell = () => {
    if (confirmSell) {
      toggleDisabled.mutate({ marketId: confirmSell.position_id, disable: true });
      setConfirmSell(null);
    }
  };

  // Filter bets
  const filteredBets = trades.filter(bet => {
    // Text search
    if (search) {
      const searchLower = search.toLowerCase();
      const title = (bet.polymarket_market_title || bet.kalshi_market_title || '').toLowerCase();
      if (!title.includes(searchLower)) return false;
    }

    // Platform filter - check trade_type for actual platform used
    const tradeType = bet.trade_type?.toLowerCase() || '';
    if (filter === 'polymarket') {
      // Show only if it's purely polymarket or involves polymarket
      if (!tradeType.includes('polymarket') && !bet.polymarket_token_id) return false;
    }
    if (filter === 'kalshi') {
      // Show only if it involves kalshi
      if (!tradeType.includes('kalshi') && !bet.kalshi_ticker) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && bet.outcome !== statusFilter) return false;

    return true;
  });

  // Stats
  const stats = {
    totalBets: trades.length,
    pending: trades.filter(t => t.outcome === 'pending').length,
    won: trades.filter(t => t.outcome === 'won').length,
    lost: trades.filter(t => t.outcome === 'lost').length,
    totalPnL: trades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0),
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="w-8 h-8 text-neon-blue" />
              My Bets
            </h1>
            <p className="text-gray-400 mt-2">View and manage your automated and manual positions</p>
          </div>
          {isAdmin ? (
            <button
              onClick={() => setShowTradeModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-neon-blue to-neon-green text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Trade
            </button>
          ) : (
            <div className="px-6 py-3 bg-dark-card border border-dark-border text-gray-500 font-semibold rounded-xl flex items-center gap-2 cursor-not-allowed">
              <Lock className="w-5 h-5" />
              Read-Only Mode
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="card py-4">
            <p className="text-xs text-gray-500 mb-1">Total Bets</p>
            <p className="text-2xl font-bold">{stats.totalBets}</p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-gray-500 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-gray-500 mb-1">Won</p>
            <p className="text-2xl font-bold text-neon-green">{stats.won}</p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-gray-500 mb-1">Lost</p>
            <p className="text-2xl font-bold text-red-400">{stats.lost}</p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-gray-500 mb-1">Total P&L</p>
            <p className={cn("text-2xl font-bold", stats.totalPnL >= 0 ? "text-neon-green" : "text-red-400")}>
              {stats.totalPnL >= 0 ? '+' : ''}{formatCurrency(stats.totalPnL)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-neon-blue"
            />
          </div>

          {/* Platform filter */}
          <div className="flex bg-dark-card rounded-lg border border-dark-border p-1">
            {(['all', 'polymarket', 'kalshi'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  filter === f 
                    ? f === 'polymarket' ? 'bg-polymarket text-white'
                      : f === 'kalshi' ? 'bg-kalshi text-white'
                      : 'bg-dark-border text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {f === 'all' ? 'All' : f === 'polymarket' ? '🔵 Poly' : '🟢 Kalshi'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex bg-dark-card rounded-lg border border-dark-border p-1">
            {(['all', 'pending', 'won', 'lost'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  statusFilter === s ? 'bg-dark-border text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Bets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredBets.map((bet) => (
              <BetCard
                key={bet.position_id}
                bet={bet}
                onDisable={handleDisable}
                isDisabled={disabledIds.has(bet.position_id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {filteredBets.length === 0 && (
          <div className="text-center py-16">
            <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No bets found</h3>
            <p className="text-gray-500">
              {search ? 'Try a different search term' : 'The bot will place bets when it finds opportunities'}
            </p>
          </div>
        )}

        {/* Sell Confirmation Modal */}
        {confirmSell && (
          <SellConfirmModal
            bet={confirmSell}
            onConfirm={confirmDisableAndSell}
            onCancel={() => setConfirmSell(null)}
          />
        )}

        {/* Manual Trade Modal */}
        <ManualTradeModal
          isOpen={showTradeModal}
          onClose={() => setShowTradeModal(false)}
        />
      </div>
    </div>
  );
}
